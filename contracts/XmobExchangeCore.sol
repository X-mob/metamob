// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "./interfaces/NftCommon.sol";
import "./interfaces/Weth9.sol";
import "./interfaces/WyvernProxyRegister.sol";
import "./interfaces/WyvernExchange.sol";
import "./interfaces/Seaport.sol";
import "./interfaces/XmobManageInterface.sol";

contract XmobExchangeCore is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    using SafeMath for uint256;

    string public constant VERSION = "1.0.0";

    /** @dev bytes4(keccak256("isValidSignature(bytes32,bytes)") */
    bytes4 internal constant MAGICVALUE = 0x1626ba7e;

    bytes internal constant MAGIC_SIGNATURE = "0x42";

    /** @dev seaport Opensea proxy  */
    //todo: change to const for production
    address public SEAPORT_CORE = 0x00000000006c3852cbEf3e08E8dF289169EdE581;

    /** @dev WETH ERC20 */
    //todo: change to const for production
    address public WETH_ADDR = 0xc778417E063141139Fce010982780140Aa0cD5Ab;

    /** @dev Fee Account */
    address public creator;
    address public token;
    uint256 public amountTotal;
    uint256 public raisedTotal;
    uint256 public takeProfitPrice;
    uint256 public stopLossPrice;
    uint256 public raisedAmountDeadline;
    uint256 public deadline;
    uint256 public cost;
    uint256 public fee;
    bool public canClaim;
    string public mobName;

    address[] public members;

    mapping(address => uint256) public memberDetails;

    mapping(address => uint256) public settlements;

    mapping(bytes32 => bool) public registerOrderHash;

    event MemberJoin(address member, uint256 value);
    event Exchanged(address indexed buyer, address indexed seller);
    event Settlement(uint256 total, uint256 time);
    event DepositEth(address sender, uint256 amt);
    event Claim(address member, uint256 amt);
    event Divestment(address member, uint256 amt);

    /**
     * @notice Oracle authority check
     */
    modifier onlyOracle() {
        require(
            XmobManageInterface(owner()).oracles(msg.sender),
            "Unauthorized"
        );

        _;
    }

    // Whether the raising has been completed
    modifier fundRaisingCompleted() {
        require(raisedTotal == amountTotal, "Not started");
        _;
    }

    // @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {
        canClaim = false;
    }

    function initialize(
        address _creator,
        address _token,
        uint256 _fee,
        uint256 _raisedTotal,
        uint256 _takeProfitPrice,
        uint256 _stopLossPrice,
        uint256 _raisedAmountDeadline,
        uint256 _deadline,
        string memory _mobName
    ) public payable initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        require(_fee < _raisedTotal, "Fee error");
        require(_deadline > _raisedAmountDeadline, "Deadline error");
        require(_raisedAmountDeadline > block.timestamp, "EndTime gt now");

        creator = _creator;
        token = _token;
        fee = _fee;
        raisedTotal = _raisedTotal;
        takeProfitPrice = _takeProfitPrice;
        stopLossPrice = _stopLossPrice;
        deadline = _deadline;
        raisedAmountDeadline = _raisedAmountDeadline;
        mobName = _mobName;

        if (msg.value > 0) {
            memberDeposit(_creator, msg.value);
        }

        // Approve All Token Nft-Id For SeaportCore contract
        NftCommon(_token).setApprovalForAll(SEAPORT_CORE, true);

        // todo: un-comment this
        // Approve Weth for openseaCore contract
        //WETH9Interface(WETH_ADDR).approve(SEAPORT_CORE, raisedTotal);
    }

    /**
     * @notice UUPS upgrade authorize
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        view
        override
    {
        require(
            newImplementation != address(0) && msg.sender == owner(),
            "auth upgrade failed"
        );
    }

    //weth swap
    receive() external payable {
        if (msg.value > 0) {
            emit DepositEth(msg.sender, msg.value);
        }
    }

    /**
     * @notice members join pay ETH
     */
    function joinPay(address member) public payable {
        memberDeposit(member, msg.value);
    }

    function memberDeposit(address addr, uint256 amt) internal {
        require(amt > 0, "Value must gt 0");
        require(raisedAmountDeadline > block.timestamp, "Fundraising closed");
        require(raisedTotal > amountTotal, "Insufficient quota");
        require(raisedTotal >= amountTotal + amt, "Exceeding the limit");

        if (memberDetails[addr] == 0) {
            members.push(addr);
        }
        memberDetails[addr] = memberDetails[addr] + amt;

        amountTotal += amt;

        //swap to WETH
        WETH9Interface(WETH_ADDR).deposit{value: amt}();

        emit MemberJoin(addr, amt);
    }

    /** @notice withdraw stake  */
    function divestment() public {
        require(block.timestamp > raisedAmountDeadline, "fund raising");
        require(memberDetails[msg.sender] > 0, "no share");

        WETH9Interface weth9 = WETH9Interface(WETH_ADDR);
        uint256 wamt = weth9.balanceOf(address(this));
        if (wamt > 0) {
            weth9.withdraw(wamt);
        }

        uint256 amt = memberDetails[msg.sender];
        memberDetails[msg.sender] = 0;
        amountTotal -= amt;

        payable(msg.sender).transfer(amt);

        emit Divestment(msg.sender, amt);
    }

    // simple eth_to_erc721 buying
    function buyNow(BasicOrderParameters calldata parameters)
        external
        payable
        fundRaisingCompleted
        returns (bool isFulFilled)
    {
        require(
            parameters.basicOrderType == BasicOrderType.ETH_TO_ERC721_FULL_OPEN,
            "wrong order type"
        );
        require(parameters.offerToken == token, "buying wrong token");
        require(
            parameters.fulfillerConduitKey == bytes32(0),
            "fulfillerConduitKey must be zero"
        );

        // convert weth to eth for buying since it is eth_to_erc721 type
        WETH9Interface weth9 = WETH9Interface(WETH_ADDR);
        uint256 amt = weth9.balanceOf(address(this));
        if (amt > 0) {
            weth9.withdraw(amt);
        }

        // let admin take manage fee
        if (cost == 0 && fee > 0) {
            cost = fee;
            payable(owner()).transfer(fee);
        }

        bool isSuccess = SeaportInterface(SEAPORT_CORE).fulfillBasicOrder{
            value: address(this).balance
        }(parameters);

        if (isSuccess) {
            emit Exchanged(address(this), parameters.offerer);
        }

        return isSuccess;
    }

    // submit sell orders on chain
    // only the offerer require no signature
    function validateSellOrders(Order[] calldata orders)
        external
        returns (bool isValidated)
    {
        _verifySellOrders(orders);

        // submit order ot seaport
        return SeaportInterface(SEAPORT_CORE).validate(orders);
    }

    function _verifySellOrders(Order[] calldata orders) internal view {
        // Skip overflow check as for loop is indexed starting at zero.
        unchecked {
            // Read length of the orders array from memory and place on stack.
            uint256 totalOrders = orders.length;

            // Iterate over each order.
            for (uint256 i = 0; i < totalOrders; ) {
                // Retrieve the order.
                Order calldata order = orders[i];
                // Retrieve the order parameters.
                OrderParameters calldata orderParameters = order.parameters;

                // check order parameters
                require(
                    orderParameters.offerer == address(this),
                    "wrong offerer"
                );
                require(orderParameters.zone == address(0), "zone != 0");
                require(
                    orderParameters.zoneHash == bytes32(0),
                    "zoneHash != 0"
                );
                require(orderParameters.offer.length == 1, "offer length !=1");
                require(
                    orderParameters.consideration.length == 1,
                    "consideration length !=1"
                );
                require(
                    orderParameters.orderType == OrderType.FULL_OPEN,
                    "wrong orderType"
                );
                require(
                    orderParameters.conduitKey == bytes32(0),
                    "conduitKey != 0"
                );
                require(
                    orderParameters.totalOriginalConsiderationItems ==
                        uint256(1),
                    "OriginalConsider != 1"
                );

                _verifyOfferItem(orderParameters.offer[0]);
                _verifyConsiderationItem(orderParameters.consideration[0]);

                // Increment counter inside body of the loop for gas efficiency.
                ++i;
            }
        }
    }

    function _verifyOfferItem(OfferItem calldata offer) internal view {
        require(offer.itemType == ItemType.ERC721, "wrong offer.ItemType");
        require(offer.token == token, "wrong offer.token");
        require(offer.startAmount == 1, "wrong offer.startAmount");
        require(offer.endAmount == 1, "wrong offer.endAmount");
    }

    // only accept ether
    function _verifyConsiderationItem(ConsiderationItem calldata consider)
        internal
        view
    {
        require(
            consider.itemType == ItemType.NATIVE,
            "wrong consider.ItemType"
        );
        require(consider.token == address(0), "wrong consider.token");

        // TODO: introduce price Oracle to enable stopLossPrice selling
        require(
            consider.startAmount >= takeProfitPrice,
            "wrong consider.startAmount"
        );
        require(
            consider.endAmount >= takeProfitPrice,
            "wrong consider.endAmount"
        );

        require(
            consider.recipient == address(this),
            "wrong consider.recipient"
        );
    }

    // register sell orders for later isValidSignature checking
    function registerSellOrder(Order[] calldata orders) external {
        _verifySellOrders(orders);

        // Skip overflow check as for loop is indexed starting at zero.
        unchecked {
            // Read length of the orders array from memory and place on stack.
            uint256 totalOrders = orders.length;
            uint256 counter = SeaportInterface(SEAPORT_CORE).getCounter(
                address(this)
            );

            // Iterate over each order.
            for (uint256 i = 0; i < totalOrders; ) {
                Order calldata order = orders[i];
                OrderParameters calldata orderParameters = order.parameters;

                OrderComponents memory orderComponents = OrderComponents(
                    orderParameters.offerer,
                    orderParameters.zone,
                    orderParameters.offer,
                    orderParameters.consideration,
                    orderParameters.orderType,
                    orderParameters.startTime,
                    orderParameters.endTime,
                    orderParameters.zoneHash,
                    orderParameters.salt,
                    orderParameters.conduitKey,
                    counter
                );

                // register orderHash
                bytes32 orderHash = SeaportInterface(SEAPORT_CORE).getOrderHash(
                    orderComponents
                );
                registerOrderHash[orderHash] = true;

                // Increment counter inside body of the loop for gas efficiency.
                ++i;
            }
        }
    }

    /** TODO
     * @notice Verifies that the signer is the owner of the signing contract.
     */
    function isValidSignature(bytes32 _orderHash, bytes calldata _signature)
        external
        view
        returns (bytes4)
    {
        //TODO ECDSA ECDSA.recover(hash, v, r, s);

        // only allow seaport contract to check
        require(msg.sender == SEAPORT_CORE, "only seaport");
        // must use special signature placeholder
        require(
            keccak256(_signature) == keccak256(MAGIC_SIGNATURE),
            "unallow signature"
        );

        if (registerOrderHash[_orderHash] == true) {
            return MAGICVALUE;
        }
        return 0x1726ba12;
    }

    /** @dev Distribute profits */
    function settlementAllocation(bool takeTransferFee) external {
        require(canClaim == false, "already can claim");

        WETH9Interface weth9 = WETH9Interface(WETH_ADDR);

        uint256 amt = weth9.balanceOf(address(this));
        if (amt > 0) {
            weth9.withdraw(amt);
        }

        amt = address(this).balance;
        require(amt > 0, "Amt must gt 0");

        canClaim = true;

        // check if fee is needed
        if (takeTransferFee && cost == 0 && fee > 0) {
            cost = fee;
            amt = address(this).balance - fee;
            payable(owner()).transfer(fee);
        }

        for (uint256 i = 0; i < members.length; i++) {
            uint256 share = memberDetails[members[i]];
            settlements[members[i]] = (amt / amountTotal) * share;
        }

        emit Settlement(amt, block.timestamp);
    }

    /** @dev receive income  */
    function claim() public {
        require(canClaim == true, "claim not started");

        uint256 amt = settlements[msg.sender];
        if (amt > 0) {
            settlements[msg.sender] = 0;
            emit Claim(msg.sender, amt);
        }

        bool isAllClaimed = true;
        for (uint256 i = 0; i < members.length; i++) {
            if (settlements[members[i]] > 0) {
                isAllClaimed = false;
            }
        }
        if (isAllClaimed) {
            canClaim = false;
        }

        if (amt > 0) {
            payable(msg.sender).transfer(amt);
        }
    }

    function mobItem()
        public
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256
        )
    {
        return (
            amountTotal,
            raisedTotal,
            takeProfitPrice,
            stopLossPrice,
            deadline,
            raisedAmountDeadline
        );
    }

    function balanceAll() public view returns (uint256, uint256) {
        uint256 eth = address(this).balance;
        uint256 wethbalance = WETH9Interface(WETH_ADDR).balanceOf(
            address(this)
        );
        return (eth, wethbalance);
    }

    function oracles(address addr) public view returns (bool) {
        return XmobManageInterface(owner()).oracles(addr);
    }

    // todo: remove this
    // only for local test
    function setWeth9Address(address weth9) external {
        WETH_ADDR = weth9;
    }

    // todo: remove this
    // only for local test
    function setSeaportAddress(address seaport) external {
        SEAPORT_CORE = seaport;
        // Approve All Token Nft-Id For SeaportCore contract
        NftCommon(token).setApprovalForAll(SEAPORT_CORE, true);
    }
}

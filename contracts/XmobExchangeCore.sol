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

    string public constant version = "1.0.0";

    /** @dev bytes4(keccak256("isValidSignature(bytes32,bytes)") */
    bytes4 internal constant MAGICVALUE = 0x1626ba7e;

    /** @dev Wyvern Token transfer Opensea   */
    address constant wyvernTokenTransferProxy =
        0xCdC9188485316BF6FA416d02B4F680227c50b89e;

    /** @dev WyvernExchange Opensea core  */
    address constant wyvernExhcangeCore =
        0xdD54D660178B28f6033a953b0E55073cFA7e3744;

    /** @dev WyvernProxyRegister Opensea proxy  */
    address constant wyvernProxyRegister =
        0x1E525EEAF261cA41b809884CBDE9DD9E1619573A;

    /** @dev seaport Opensea proxy  */
    address constant seaportCore = 0x00000000006c3852cbEf3e08E8dF289169EdE581;

    /** @dev WETH ERC20 */
    address constant weth = 0xc778417E063141139Fce010982780140Aa0cD5Ab;

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
    bool public settlementState;
    string public mobName;

    address[] public members;

    mapping(address => uint256) public memberDetails;

    mapping(address => uint256) public settlements;

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
    modifier completed() {
        require(raisedTotal == amountTotal, "Not started");
        _;
    }

    // @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

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

        //Approve All Token Nft-Id For SeaportCore contract
        NftCommon(_token).setApprovalForAll(seaportCore, true);

        //Approve Weth for opensea wyvernTokenTransferProxy
        //WETH9(weth).approve(wyvernTokenTransferProxy, raisedTotal);
    }

    /**
     * @notice UUPS upgrade authorize
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        view
        override
    {
        require(newImplementation != address(0) && msg.sender == owner());
    }

    /** TODO
     * @notice Verifies that the signer is the owner of the signing contract.
     */
    function isValidSignature(bytes32 _hash, bytes calldata _signature)
        external
        view
        returns (bytes4)
    {
        //TODO ECDSA ECDSA.recover(hash, v, r, s);

        if (
            XmobManageInterface(owner()).oracles(
                ECDSA.recover(_hash, _signature)
            )
        ) {
            return MAGICVALUE;
        }
        return 0x1726ba12;
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
    function joinPay(address member) public payable onlyOwner {
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
        WETH9(weth).deposit{value: amt}();

        emit MemberJoin(addr, amt);
    }

    /** @notice withdraw stake  */
    function divestment() public {
        require(block.timestamp > raisedAmountDeadline, "fund raising");
        require(memberDetails[msg.sender] > 0, "no share");

        WETH9 weth9 = WETH9(weth);
        uint256 wamt = weth9.balanceOf(address(this));
        if (wamt > 0) {
            weth9.withdraw(wamt);
        }

        uint256 amt = memberDetails[msg.sender];
        memberDetails[msg.sender] = 0;

        payable(msg.sender).transfer(amt);

        emit Divestment(msg.sender, amt);
    }

    /**
     * @dev orders atomicMatch_ Buy Now
     * addrs [0]:wyern [1]:maker [2]:taker [3]:feeRecipient [4]:target [5]:staticTarget [6]:paymentToken
     * uints [0]:makerRelayerFee [1]:takerRelayerFee [2]:makerProtocolFee [3]:takerProtocolFee [4]:basePrice [5]:extra [6]:listingTime [7]:expirationTime [8]:salt
     * feeMethod Order feeMethod 0:ProtocolFee 1:SplitFee
     * side Order side 1:sell 0:buy
     * saleKind Order saleKind 0:FixedPrice 1:DutchAuction
     * howToCall Order howToCall 0:Call 1:DelegateCall
     * data Order calldata
     * replacementPattern Order replacementPattern
     * staticExtradata Order staticExtradata
     */
    function exchange(
        address[14] memory addrs,
        uint256[18] memory uints,
        uint8[8] memory feeMethodsSidesKindsHowToCalls,
        bytes memory calldataBuy,
        bytes memory calldataSell,
        bytes memory replacementPatternBuy,
        bytes memory replacementPatternSell,
        bytes memory staticExtradataBuy,
        bytes memory staticExtradataSell,
        uint8[2] memory vs,
        bytes32[5] memory rssMetadata
    ) public payable onlyOracle completed {
        require(
            addrs[8] == address(this) || addrs[1] == address(this),
            "Maker not exists"
        );

        WETH9 weth9 = WETH9(weth);
        uint256 amt = weth9.balanceOf(address(this));

        if (amt > 0) {
            if (addrs[6] == address(0)) {
                weth9.withdraw(amt);
            } else {
                weth9.withdraw(fee);
            }
        }

        //buying
        if (addrs[1] == address(this) && cost == 0 && fee > 0) {
            payable(owner()).transfer(fee);
            cost = fee;
        }

        WyvernExchange(wyvernExhcangeCore).atomicMatch_{
            value: address(this).balance
        }(
            addrs,
            uints,
            feeMethodsSidesKindsHowToCalls,
            calldataBuy,
            calldataSell,
            replacementPatternBuy,
            replacementPatternSell,
            staticExtradataBuy,
            staticExtradataSell,
            vs,
            rssMetadata
        );

        emit Exchanged(addrs[1], addrs[8]);
    }

    function buyNow(BasicOrderParameters calldata parameters)
        external
        payable
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

        return
            SeaportInterface(seaportCore).fulfillBasicOrder{
                value: address(this).balance
            }(parameters);
    }

    /** @dev Distribute profits */
    function settlementAllocation(bool transferFee) public onlyOracle {
        WETH9 weth9 = WETH9(weth);

        uint256 amt = weth9.balanceOf(address(this));
        if (amt > 0) {
            weth9.withdraw(amt);
        }

        amt = address(this).balance;
        require(amt > 0, "Amt must gt 0");

        if (transferFee && cost == 0 && fee > 0) {
            payable(owner()).transfer(fee);
            cost = fee;
            amt = address(this).balance;
        }

        for (uint256 i = 0; i < members.length; i++) {
            uint256 share = memberDetails[members[i]];
            settlements[members[i]] = share / amountTotal;
        }

        settlementState = true;

        emit Settlement(amt, block.timestamp);
    }

    /** @dev receive income  */
    function claim() public {
        uint256 amt = settlements[msg.sender];
        if (amt > 0) {
            settlements[msg.sender] = 0;

            payable(msg.sender).transfer(amt);

            emit Claim(msg.sender, amt);
        }

        bool state = true;
        for (uint256 i = 0; i < members.length; i++) {
            if (settlements[members[i]] > 0) {
                state = false;
            }
        }
        if (state) {
            settlementState = false;
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
        uint256 wethbalance = WETH9(weth).balanceOf(address(this));
        return (eth, wethbalance);
    }

    function oracles(address addr) public view returns (bool) {
        return XmobManageInterface(owner()).oracles(addr);
    }
}

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

    /** @dev seaport Opensea proxy  */
    address public constant SEAPORT_CORE =
        0x00000000006c3852cbEf3e08E8dF289169EdE581;

    /** @dev WETH ERC20 */
    address public constant WETH_ADDR =
        0xc778417E063141139Fce010982780140Aa0cD5Ab;

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

        // Approve All Token Nft-Id For SeaportCore contract
        NftCommon(_token).setApprovalForAll(SEAPORT_CORE, true);

        // Approve Weth for openseaCore contract
        //WETH9(weth).approve(seaportCore, raisedTotal);
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
        WETH9(WETH_ADDR).deposit{value: amt}();

        emit MemberJoin(addr, amt);
    }

    /** @notice withdraw stake  */
    function divestment() public {
        require(block.timestamp > raisedAmountDeadline, "fund raising");
        require(memberDetails[msg.sender] > 0, "no share");

        WETH9 weth9 = WETH9(WETH_ADDR);
        uint256 wamt = weth9.balanceOf(address(this));
        if (wamt > 0) {
            weth9.withdraw(wamt);
        }

        uint256 amt = memberDetails[msg.sender];
        memberDetails[msg.sender] = 0;

        payable(msg.sender).transfer(amt);

        emit Divestment(msg.sender, amt);
    }

    // simple eth_to_erc721 buying
    function buyNow(BasicOrderParameters calldata parameters)
        external
        payable
        completed
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
        WETH9 weth9 = WETH9(WETH_ADDR);
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

    /** @dev Distribute profits */
    function settlementAllocation(bool transferFee) public onlyOracle {
        WETH9 weth9 = WETH9(WETH_ADDR);

        uint256 amt = weth9.balanceOf(address(this));
        if (amt > 0) {
            weth9.withdraw(amt);
        }

        amt = address(this).balance;
        require(amt > 0, "Amt must gt 0");

        settlementState = true;

        for (uint256 i = 0; i < members.length; i++) {
            uint256 share = memberDetails[members[i]];
            settlements[members[i]] = share / amountTotal;
        }

        if (transferFee && cost == 0 && fee > 0) {
            cost = fee;
            amt = address(this).balance;
            payable(owner()).transfer(fee);
        }

        emit Settlement(amt, block.timestamp);
    }

    /** @dev receive income  */
    function claim() public {
        uint256 amt = settlements[msg.sender];
        if (amt > 0) {
            settlements[msg.sender] = 0;
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
        uint256 wethbalance = WETH9(WETH_ADDR).balanceOf(address(this));
        return (eth, wethbalance);
    }

    function oracles(address addr) public view returns (bool) {
        return XmobManageInterface(owner()).oracles(addr);
    }
}

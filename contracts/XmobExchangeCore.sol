// SPDX-License-Identifier: MIT
pragma solidity ^0.8.5;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "./interfaces/NftCommon.sol";
import "./interfaces/Weth.sol";
import "./interfaces/WyvernProxyRegister.sol";
import "./interfaces/WyvernExchange.sol";

interface XmobManage {
    function oricles(address addr) external view returns(bool);
}

contract XmobExchagneCore is Initializable, OwnableUpgradeable, UUPSUpgradeable{

    string constant public version = "1.0.0";

    /** @dev WyvernExchange Opensea core  */
    WyvernExchange private wyvernExhcange = WyvernExchange(0xdD54D660178B28f6033a953b0E55073cFA7e3744);

    /** @dev WyvernProxyRegister Opensea proxy  */
    WyvernProxyRegister private wyvernProxyRegister = WyvernProxyRegister(0x1E525EEAF261cA41b809884CBDE9DD9E1619573A);

    /** @dev WETH ERC20 */
    WETH private weth = WETH(0xc778417E063141139Fce010982780140Aa0cD5Ab);
    
    /** @dev bytes4(keccak256("isValidSignature(bytes32,bytes)") */
    bytes4 constant internal MAGICVALUE = 0x1626ba7e;

     /** @dev Fee Account */
    address public feeRecipient;
    address public creater;
    address public paymentToken;
    address public token;
    uint256 public amountTotal;
    uint256 public raisedTotal;
    uint256 public takeProfitPrice;
    uint256 public stopLossPrice;
    uint256 public endTime;
    uint256 public cost;
    uint256 public fee;
    bool    public settlementState;

    bytes   public callData;
    string  public mobName;

    address[] public members;

    mapping(address => uint) public memberDetails;

    mapping(bytes32 => bool) public signatureHashs;

    mapping(address => uint256) public settlements;

    event MemberJoin(address member, uint256 value);
    event Exchanged(address indexed buyer, address indexed seller, bytes32 indexed hash);
    event Settlement(uint256 total, uint256 time);
    event DepositEth(address sender, uint256 amt);
    event Claim(address member, uint amt);


    /** 
     * @notice Oracle authority check
     */
    modifier onlyOricle(){
        require(XmobManage(owner()).oricles(msg.sender),"Unauthorized");

        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

     
    function initialize(
        address _creater,
        address _paymentToken,
        address _token,
        uint _fee,
        uint _raisedTotal,
        uint _takeProfitPrice,
        uint _stopLossPrice,
        uint _endTime,
        bytes memory _callData,
        string memory _mobName    
    ) initializer public payable {
        __Ownable_init();
        __UUPSUpgradeable_init();

        require(_fee < _raisedTotal,"Fee error");
        require(_endTime > block.timestamp,"EndTime gt now");

        feeRecipient = msg.sender;
        creater = _creater;
        paymentToken = _paymentToken;
        token = _token;
        fee = _fee;
        raisedTotal = _raisedTotal;
        takeProfitPrice = _takeProfitPrice;
        stopLossPrice = _stopLossPrice;
        endTime = _endTime;
        callData = _callData;
        mobName = _mobName;

        if(msg.value > 0){
            memberDeposit(_creater, msg.value);
        }
    }


    /**
    * @notice UUPS upgrade authorize
    */
    function _authorizeUpgrade(address newImplementation) internal view override
    {
        require(newImplementation != address(0));
        require(msg.sender == owner());
    }    


    /** TODO
    * @notice Verifies that the signer is the owner of the signing contract.
    */
    function isValidSignature(
        bytes32 _hash,
        bytes calldata _signature
    ) external view returns (bytes4) {
        // Variables are not scoped in Solidity.
        if(signatureHashs[_hash] && _signature.length > 0){
            return MAGICVALUE;
        } else {
            return 0xffffffff;
        }
    }

    //weth swap
    receive () payable external{
        emit DepositEth(msg.sender, msg.value);
    }

    fallback () payable external {
        emit DepositEth(msg.sender, msg.value);
    }

    /**
     * @notice members join pay ETH
     */
    function joinPay() payable public
    {
        memberDeposit(msg.sender, msg.value);
    }

    function balance()public view returns(uint){
        return address(this).balance;
    }

    function memberDeposit(address addr, uint amt) internal 
    {
        require(amt > 0,"Value must gt 0");
        require(raisedTotal > amountTotal,"Insufficient quota");
        require(raisedTotal >= amountTotal + amt,"Exceeding the limit");

        if(memberDetails[addr] == 0){
            members.push(addr);
        }
        memberDetails[addr] = memberDetails[addr] + amt;

        amountTotal += amt;

        emit MemberJoin(addr, amt);
    }


    /**
     * @dev orders atomicMatch_ (buy now or Bid)
     */
    function exchange (
        address[14] memory addrs,
        uint[18] memory uints, 
        uint8[8] memory feeMethodsSidesKindsHowToCalls,
        bytes memory calldataBuy,
        bytes memory calldataSell,
        bytes memory replacementPatternBuy,
        bytes memory replacementPatternSell,
        bytes memory staticExtradataBuy,
        bytes memory staticExtradataSell,
        uint8[2] memory vs,
        bytes32[5] memory rssMetadata,
        bytes32 hash
       )
        public
        payable
        onlyOricle
        returns(bytes32)
    {
        require(raisedTotal == amountTotal,"Not started");
        require(keccak256(calldataBuy) == keccak256(callData),"Calldata  mismatch");
        require(addrs[1] == address(this) || addrs[8] == address(this),"Maker not exists");

        signatureHashs[hash] = true;
        
        //buying
        if(addrs[1] == address(this) && cost == 0){
            payable(feeRecipient).transfer(fee);
            cost = fee;
        }

        wyvernExhcange.atomicMatch_{value:address(this).balance}(addrs,uints,feeMethodsSidesKindsHowToCalls,calldataBuy,calldataSell,replacementPatternBuy,replacementPatternSell,staticExtradataBuy,staticExtradataSell,vs,rssMetadata);

        emit Exchanged(addrs[1], addrs[8], hash);

        return hash;
    }

  
    /**
     * @dev Signature authorization to bid or sell
     * @param addrs [0]:wyern [1]:maker [2]:taker [3]:feeRecipient [4]:target [5]:staticTarget [6]:paymentToken
     * @param uints [0]:makerRelayerFee [1]:takerRelayerFee [2]:makerProtocolFee [3]:takerProtocolFee [4]:basePrice [5]:extra [6]:listingTime [7]:expirationTime [8]:salt 
     * @param feeMethod Order feeMethod 0:ProtocolFee 1:SplitFee
     * @param side Order side 1:sell 0:buy
     * @param saleKind Order saleKind 0:FixedPrice 1:DutchAuction
     * @param howToCall Order howToCall 0:Call 1:DelegateCall
     * @param data Order calldata 
     * @param replacementPattern Order replacementPattern
     * @param staticExtradata Order staticExtradata
     */
    function publish (
        address[7] memory addrs,
        uint[9] memory uints,
        uint8 feeMethod,
        uint8 side,
        uint8 saleKind,
        uint8 howToCall,
        bytes memory data,
        bytes memory replacementPattern,
        bytes memory staticExtradata)
        public
        onlyOricle
    {
        require(raisedTotal == amountTotal,"Not started");
        if(side == 0){
            require(keccak256(data) == keccak256(callData),"Calldata  mismatch");
        }

        bytes32 hash = wyvernExhcange.hashToSign_(addrs, uints, feeMethod, side, saleKind, howToCall, data, replacementPattern, staticExtradata);
        require(! signatureHashs[hash],"Already exists");

        address WyvernProxy = wyvernProxyRegister.proxies(address(this));
        if(WyvernProxy == address(0)){
            WyvernProxy = wyvernProxyRegister.registerProxy();
        }

        NftCommon nft = NftCommon(token);
        if(side == 1 && ! nft.isApprovedForAll(address(this), WyvernProxy)){
            nft.setApprovalForAll(WyvernProxy,true);
        }

        // buy
        if(side == 0){
            uint amount = address(this).balance;
            amount = amount > amountTotal ? amount : amountTotal;
            amount = amount - fee;
            if(amount > 0){
                weth.deposit{value:amount}();
                weth.approve(WyvernProxy, amount);
            }   
        }

        signatureHashs[hash] = true;
    }    


    /** @dev Distribute profits */
    function settlementAllocation(bool transferFee) public onlyOricle {

        require(! settlementState, "Settlement not completed");
        settlementState = true;

        uint256 amt = weth.balanceOf(address(this));
        if(amt > 0){
            weth.withdraw(amt);
        }
        amt = address(this).balance;
        require(amt > 0,"Amt must gt 0");

        if(transferFee && cost == 0){
            payable(feeRecipient).transfer(fee);
            cost = fee;
            amt = address(this).balance;
        }

        for(uint i=0; i<members.length; i++){
            uint256 share = memberDetails[members[i]];
            settlements[members[i]] = amt / amountTotal * share;
        }

        emit Settlement(amt, block.timestamp);
    }

    /** @dev receive income  */
    function claim() public {

        uint amt = settlements[msg.sender];
        require(amt > 0, "Insufficient recoverable funds");
        settlements[msg.sender] = 0;

        payable(msg.sender).transfer(amt);

        emit Claim(msg.sender, amt);

        bool state = true;
        for(uint i=0; i<=members.length; i++){
           if(settlements[members[i]] > 0){
               state = false;
           }
        }

        if(state){
            settlementState = false;
        }
    }

    function info() 
        public 
        view 
        returns(uint, uint, uint, uint, uint)
    {
        return (amountTotal, raisedTotal, takeProfitPrice, stopLossPrice, endTime);
    }
}

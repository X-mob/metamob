// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./XmobExchangeProxy.sol";

contract XmobMange is Ownable {

    address public exchangeProxy;

    uint8 feeRate;

    uint256 mobsTotal;

    mapping(address => Mob) public mobs;
    mapping(uint => address) public mobsById;

    mapping(address => bool) public oricles;

    struct Mob{
        uint raisedTotal;
        address creater;
        string name;
    }

    event SetProxy(address proxy);
    event Excuted(address indexed target, uint amt, bytes data, bytes result);
    event Withdraw(address addr, uint amt);
    event SetOricle(address indexed admin, bool state);
    event FeeSet(uint8 feeRate);
    event MobCreate(address indexed creater, address indexed token, uint indexed tokenId, address proxy, uint raisedTotal, uint takeProfitPrice, uint stopLossPrice, uint endTime, string name);
    event DepositEth(address sender, uint256 amt);


    constructor(address proxy){
        setProxy(proxy);
    }


    receive () payable external{
        emit DepositEth(msg.sender, msg.value);
    }

    fallback () payable external {
        emit DepositEth(msg.sender, msg.value);
    }


    /**
     * @dev create mob
     */
    function createMob(
        address _paymentToken,
        address _token,
        uint _tokenId,
        uint _raisedTotal,
        uint _takeProfitPrice,
        uint _stopLossPrice,
        uint _endTime,
        bytes memory _callData,
        string memory _mobName) 
        public 
        payable
        returns(uint)
    {
        require(_endTime > block.timestamp && _takeProfitPrice > _stopLossPrice && _raisedTotal > 0,"Params error");

        uint fee = _raisedTotal * feeRate / 1000;

        XmobExchangeProxy mob = new XmobExchangeProxy{value:msg.value}(
            exchangeProxy, 
            abi.encodeWithSelector(
                bytes4(keccak256(bytes("initialize(address,address,address,uint256,uint256,uint256,uint256,uint256,bytes,string)"))),
                msg.sender,
                _paymentToken,
                _token,
                fee,
                _raisedTotal,
                _takeProfitPrice,
                _stopLossPrice,
                _endTime,
                _callData,
                _mobName
            )
        );

        mobsTotal += 1;

        mobsById[mobsTotal] = address(mob);

        Mob storage mobInfo = mobs[address(mob)];
        mobInfo.creater = msg.sender;
        mobInfo.raisedTotal = _raisedTotal;
        mobInfo.name = _mobName;   
        
        emit MobCreate(
            msg.sender,
            _token,
            _tokenId,
            address(mob),
            _raisedTotal,
            _takeProfitPrice,
            _stopLossPrice,
            _endTime,
            _mobName
        );

        return mobsTotal;
    }

    /** @dev set fee */
    function setFee(uint8 _feeRate) public onlyOwner 
    {
        require(_feeRate < 1000);
        feeRate = _feeRate; 
        emit FeeSet(feeRate);
    }
    
     /** @dev XmobExchang manager */
    function  setOricle(address oricle, bool state) public onlyOwner 
    {
        require(oricles[oricle] != state);

        oricles[oricle] = state;

        emit SetOricle(oricle, state);
    }


    /** @dev exchange core proxy  */
    function _setProxy(address proxy) public onlyOwner 
    {
        setProxy(proxy);
    }


    function setProxy(address proxy) internal 
    {
        uint size;
        assembly {
            size := extcodesize(proxy)
        }
        require(size > 0);
        
        exchangeProxy = proxy;  
        emit SetProxy(proxy);
    }

    
    /** @dev Administrator withdraws management fee  */
    function withdraw(address addr, uint amt) public onlyOwner
    {
        payable(addr).transfer(amt);   
        emit Withdraw(addr, amt);
    }


    /** @dev target call  */
    function excute(address[] memory addrs, uint[] memory amts, bytes[] memory datas) public onlyOwner
    {
        require(addrs.length == datas.length && amts.length == addrs.length);

        for(uint i=0; i<addrs.length; i++){ 
            (bool success, bytes memory result) = address(addrs[i]).call(datas[i]);
            require(success);
            emit Excuted(addrs[i], amts[i], datas[i], result);
        }
    }
}
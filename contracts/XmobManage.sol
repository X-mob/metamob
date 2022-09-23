// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./XmobExchangeProxy.sol";
import "./lib/Constants.sol";
import "./lib/MobStruct.sol";

contract XmobManage is Ownable {
    // initial exchangeCore contract address
    address public exchangeCore;

    uint8 public feeRate; //1000/1000

    uint256 public mobsTotal;

    mapping(uint256 => address) public mobsById;

    event XMobProxySet(address proxy);
    event Withdraw(address addr, uint256 amt);
    event FeeRateSet(uint8 feeRate);
    event MobCreate(
        address indexed creator,
        address indexed token,
        uint256 indexed tokenId,
        address proxy,
        uint256 id,
        uint256 raiseTarget,
        uint256 takeProfitPrice,
        uint256 stopLossPrice,
        uint256 fee,
        uint256 deadline,
        uint256 raiseDeadline,
        uint8 targetMode,
        string name
    );
    event DepositEth(address sender, uint256 amt);

    constructor(address _exchangeCore) {
        _setXMobProxy(_exchangeCore);
    }

    receive() external payable {
        if (msg.value > 0) {
            emit DepositEth(msg.sender, msg.value);
        }
    }

    fallback() external payable {
        if (msg.value > 0) {
            emit DepositEth(msg.sender, msg.value);
        }
    }

    /**
     * @dev create mob
     */
    function createMob(
        address _token,
        uint256 _tokenId,
        uint256 _raiseTarget,
        uint256 _takeProfitPrice,
        uint256 _stopLossPrice,
        uint64 _raiseDeadline,
        uint64 _deadline,
        uint8 _targetMode,
        string memory _name
    ) public payable returns (address) {
        uint256 fee = calcFee(_raiseTarget);

        XmobExchangeProxy mob = new XmobExchangeProxy{value: msg.value}(
            exchangeCore,
            abi.encodeWithSelector(
                bytes4(
                    keccak256(
                        bytes(
                            "initialize(address,address,uint256,uint256,uint256,uint256,uint256,uint64,uint64,uint8,string)"
                        )
                    )
                ),
                msg.sender,
                _token,
                _tokenId,
                fee,
                _raiseTarget,
                _takeProfitPrice,
                _stopLossPrice,
                _raiseDeadline,
                _deadline,
                _targetMode,
                _name
            )
        );

        mobsTotal += 1;
        mobsById[mobsTotal] = address(mob);

        emit MobCreate(
            msg.sender,
            _token,
            _tokenId,
            address(mob),
            mobsTotal,
            _raiseTarget,
            _takeProfitPrice,
            _stopLossPrice,
            fee,
            _deadline,
            _raiseDeadline,
            _targetMode,
            _name
        );

        return address(mob);
    }

    /** @dev set fee */
    function setFeeRate(uint8 _feeRate) public onlyOwner {
        // note: fee rate can be 0
        require(_feeRate < 1000, "feeRate gt 1000");
        feeRate = _feeRate;
        emit FeeRateSet(feeRate);
    }

    function calcFee(uint256 _raiseTarget) public view returns (uint256 fee) {
        require(_raiseTarget >= MINIMAL_RAISE_TARGET, "raiseTarget too small");

        fee = (_raiseTarget * feeRate) / 1000;
        if (feeRate != 0 && fee < MINIMAL_FEE) {
            fee = MINIMAL_FEE;
        }
        return fee;
    }

    /** @dev exchange core proxy  */
    function _setXMobProxy(address _exchangeCore) internal {
        uint256 size;
        assembly {
            size := extcodesize(_exchangeCore)
        }
        require(size > 0, "not contract");

        exchangeCore = _exchangeCore;
        emit XMobProxySet(_exchangeCore);
    }

    /** @dev exchange core proxy but external */
    function setXMobProxy(address _exchangeCore) public onlyOwner {
        _setXMobProxy(_exchangeCore);
    }

    /** @dev Administrator withdraws management fee  */
    function withdraw(address addr, uint256 amt) public onlyOwner {
        payable(addr).transfer(amt);
        emit Withdraw(addr, amt);
    }
}

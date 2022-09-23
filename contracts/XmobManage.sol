// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./XmobExchangeProxy.sol";

contract XmobManage is Ownable {
    // initial exchangeCore contract address
    address public exchangeCore;

    uint8 public feeRate; //1000/1000

    uint256 public mobsTotal;

    mapping(address => Mob) public mobs;
    mapping(uint256 => address) public mobsById;

    struct Mob {
        uint256 raisedTotal;
        uint256 raisedAmountDeadline;
        uint256 deadline;
        uint256 fee;
        address creator;
        string name;
    }

    event ProxySet(address proxy);
    event Withdraw(address addr, uint256 amt);
    event FeeSet(uint8 feeRate);
    event MobCreate(
        address indexed creator,
        address indexed token,
        uint256 indexed tokenId,
        address proxy,
        uint256 raisedTotal,
        uint256 takeProfitPrice,
        uint256 stopLossPrice,
        uint256 fee,
        uint256 deadline,
        uint256 raisedAmountDeadline,
        string name
    );
    event DepositEth(address sender, uint256 amt);

    constructor(address _exchangeCore) {
        setProxy(_exchangeCore);
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
        uint256 _raisedTotal,
        uint256 _takeProfitPrice,
        uint256 _stopLossPrice,
        uint256 _raisedAmountDeadline,
        uint256 _deadline,
        string memory _mobName
    ) public payable returns (address) {
        require(
            _deadline > block.timestamp &&
                _takeProfitPrice > _stopLossPrice &&
                _raisedTotal > 0,
            "Params error"
        );

        uint256 fee = (_raisedTotal * feeRate) / 1000;

        XmobExchangeProxy mob = new XmobExchangeProxy{value: msg.value}(
            exchangeCore,
            abi.encodeWithSelector(
                bytes4(
                    keccak256(
                        bytes(
                            "initialize(address,address,uint256,uint256,uint256,uint256,uint256,uint256,string)"
                        )
                    )
                ),
                msg.sender,
                _token,
                fee,
                _raisedTotal,
                _takeProfitPrice,
                _stopLossPrice,
                _raisedAmountDeadline,
                _deadline,
                _mobName
            )
        );

        mobsTotal += 1;

        mobsById[mobsTotal] = address(mob);

        Mob storage mobInfo = mobs[address(mob)];
        mobInfo.creator = msg.sender;
        mobInfo.raisedTotal = _raisedTotal;
        mobInfo.name = _mobName;
        mobInfo.raisedAmountDeadline = _raisedAmountDeadline;
        mobInfo.deadline = _deadline;
        mobInfo.fee = fee;

        emit MobCreate(
            mobInfo.creator,
            _token,
            _tokenId,
            address(mob),
            _raisedTotal,
            _takeProfitPrice,
            _stopLossPrice,
            mobInfo.fee,
            mobInfo.deadline,
            mobInfo.raisedAmountDeadline,
            mobInfo.name
        );

        return address(mob);
    }

    /** @dev set fee */
    function setFee(uint8 _feeRate) public onlyOwner {
        require(_feeRate < 1000, "feeRate gt 1000");
        feeRate = _feeRate;
        emit FeeSet(feeRate);
    }

    /** @dev exchange core proxy  */
    function _setProxy(address _exchangeCore) public onlyOwner {
        setProxy(_exchangeCore);
    }

    /** @dev set core proxy  */
    function setProxy(address _exchangeCore) internal {
        uint256 size;
        assembly {
            size := extcodesize(_exchangeCore)
        }
        require(size > 0, "not contract");

        exchangeCore = _exchangeCore;
        emit ProxySet(_exchangeCore);
    }

    /** @dev Administrator withdraws management fee  */
    function withdraw(address addr, uint256 amt) public onlyOwner {
        payable(addr).transfer(amt);
        emit Withdraw(addr, amt);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./XmobExchangeProxy.sol";

import "./interfaces/XmobExchangeCoreInterface.sol";

contract XmobManage is Ownable {
    address public exchangeProxy;

    uint8 public feeRate; //1000/1000

    uint256 public mobsTotal;

    mapping(address => Mob) public mobs;
    mapping(uint256 => address) public mobsById;

    mapping(address => bool) public oracles;

    struct Mob {
        uint256 raisedTotal;
        uint256 rasiedAmountDeadline;
        uint256 deadline;
        uint256 fee;
        address creator;
        string name;
    }

    event SetProxy(address proxy);
    event Excuted(
        address indexed target,
        uint256 amt,
        bytes data,
        bytes result
    );
    event Withdraw(address addr, uint256 amt);
    event SetOracle(address indexed admin, bool state);
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
        uint256 rasiedAmountDeadline,
        string name
    );
    event MobDeposit(address indexed mob, address indexed sender, uint256 amt);
    event DepositEth(address sender, uint256 amt);

    constructor(address proxy) {
        setProxy(proxy);
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
        uint256 _rasiedAmountDeadline,
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
            exchangeProxy,
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
                _rasiedAmountDeadline,
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
        mobInfo.rasiedAmountDeadline = _rasiedAmountDeadline;
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
            mobInfo.rasiedAmountDeadline,
            mobInfo.name
        );

        if (msg.value > 0) {
            emit MobDeposit(address(mob), msg.sender, msg.value);
        }

        return address(mob);
    }

    /** @dev depost eth for mob */
    function mobDeposit(address mob) public payable {
        require(msg.value > 0, "ETH gt 0");

        Mob storage mobInfo = mobs[mob];
        require(mobInfo.creator != address(0), "Mob not exists");
        require(mobInfo.deadline > block.timestamp, "Mob Expired");

        XmobExchangeCoreInterface mobCore = XmobExchangeCoreInterface(mob);

        require(
            mobCore.amountTotal() + msg.value <= mobInfo.raisedTotal,
            "Insufficient quota"
        );

        mobCore.joinPay{value: msg.value}(msg.sender);

        emit MobDeposit(mob, msg.sender, msg.value);
    }

    /** @dev set fee */
    function setFee(uint8 _feeRate) public onlyOwner {
        require(_feeRate < 1000);
        feeRate = _feeRate;
        emit FeeSet(feeRate);
    }

    /** @dev XmobExchang manager */
    function setOracle(address oracle, bool state) public onlyOwner {
        require(oracles[oracle] != state);

        oracles[oracle] = state;

        emit SetOracle(oracle, state);
    }

    /** @dev exchange core proxy  */
    function _setProxy(address proxy) public onlyOwner {
        setProxy(proxy);
    }

    /** @dev set core proxy  */
    function setProxy(address proxy) internal {
        uint256 size;
        assembly {
            size := extcodesize(proxy)
        }
        require(size > 0);

        exchangeProxy = proxy;
        emit SetProxy(proxy);
    }

    /** @dev Administrator withdraws management fee  */
    function withdraw(address addr, uint256 amt) public onlyOwner {
        payable(addr).transfer(amt);
        emit Withdraw(addr, amt);
    }

    /** @dev target call  */
    function excute(
        address[] memory addrs,
        uint256[] memory amts,
        bytes[] memory datas
    ) public onlyOwner {
        require(addrs.length == datas.length && amts.length == addrs.length);

        for (uint256 i = 0; i < addrs.length; i++) {
            (bool success, bytes memory result) = address(addrs[i]).call(
                datas[i]
            );
            require(success);
            emit Excuted(addrs[i], amts[i], datas[i], result);
        }
    }
}

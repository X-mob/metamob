import { expect } from "chai";
import { ethers } from "hardhat";

describe("XmobExchangeCore", function () {
  it("Should return the version after deployed", async function () {
    const ExchangeCore = await ethers.getContractFactory("XmobExchangeCore");
    const exchangeCore = await ExchangeCore.deploy();
    await exchangeCore.deployed();

    expect(await exchangeCore.VERSION()).to.equal("1.0.0");
  });

  it("Should failed at initializing XmobExchangeCore directly", async function () {
    const ExchangeCore = await ethers.getContractFactory("XmobExchangeCore");
    const exchangeCore = await ExchangeCore.deploy();
    await exchangeCore.deployed();

    const [owner] = await ethers.getSigners();

    const _creator = owner.address;
    const _token = "0x" + "00".repeat(20);
    const _fee = 1;
    const _raisedTotal = ethers.utils.parseEther("0.0001");
    const _takeProfitPrice = 25;
    const _stopLossPrice = 1;
    const _raisedAmountDeadline = Date.now() + 1000000;
    const _deadline = Date.now() + 10000000;
    const _mobName = "test mob";

    await expect(
      exchangeCore
        .connect(owner)
        .initialize(
          _creator,
          _token,
          _fee,
          _raisedTotal,
          _takeProfitPrice,
          _stopLossPrice,
          _raisedAmountDeadline,
          _deadline,
          _mobName,
          {
            value: ethers.utils.parseEther("0.0001"), // 0.1 eth,
          }
        )
    ).to.be.revertedWith("Initializable: contract is already initialized");
  });

  it("Init a new mob process", async function () {
    // deploy test ERC721 token
    const TestERC721 = await ethers.getContractFactory("TestERC721");
    const testERC721 = await TestERC721.deploy();
    await testERC721.deployed();

    // deploy core metamob contracts
    const ExchangeCore = await ethers.getContractFactory("XmobExchangeCore");
    const exchangeCore = await ExchangeCore.deploy();
    await exchangeCore.deployed();

    const XmobManage = await ethers.getContractFactory("XmobManage");
    const xmobManage = await XmobManage.deploy(exchangeCore.address);
    await xmobManage.deployed();

    const [owner] = await ethers.getSigners();

    const _token = testERC721.address;
    const _tokenId = 1;
    const _raisedTotal = ethers.utils.parseEther("0.0001");
    const _takeProfitPrice = 25;
    const _stopLossPrice = 1;
    const _raisedAmountDeadline = Date.now() + 100000;
    const _deadline = _raisedAmountDeadline + 100000;
    const _mobName = "test mob";

    const createTx = await xmobManage
      .connect(owner)
      .createMob(
        _token,
        _tokenId,
        _raisedTotal,
        _takeProfitPrice,
        _stopLossPrice,
        _raisedAmountDeadline,
        _deadline,
        _mobName
      );
    const receipt = await createTx.wait();
    const topic = xmobManage.interface.getEventTopic("MobCreate");
    const logs = receipt.logs
      .filter((log) => log.topics.at(0) === topic)
      .map((log) => xmobManage.interface.parseLog(log));
    expect(logs.length).to.be.equal(1);

    const mobsTotal = await xmobManage.mobsTotal();
    expect(mobsTotal).to.be.equal(1);

    const proxy = await xmobManage.mobsById(mobsTotal);
    expect(logs[0].args.proxy).to.be.equal(proxy);
  });

  it("Mob full life cycle", async function () {
    const [owner, m1, m2, m3, n5] = await ethers.getSigners();

    // deploy WETH9 contract
    const Weth9 = await ethers.getContractFactory("WETH9");
    const weth9 = await Weth9.deploy();
    await weth9.deployed();

    // deploy test ERC721 token
    const TestERC721 = await ethers.getContractFactory("TestERC721");
    const testERC721 = await TestERC721.deploy();
    await testERC721.deployed();

    // deploy core metamob contracts
    const ExchangeCore = await ethers.getContractFactory("XmobExchangeCore");
    const exchangeCore = await ExchangeCore.deploy();
    await exchangeCore.deployed();

    const XmobManage = await ethers.getContractFactory("XmobManage");
    const xmobManage = await XmobManage.deploy(exchangeCore.address);
    await xmobManage.deployed();

    // create a mob
    const _token = testERC721.address;
    const _tokenId = 1;
    const _raisedTotal = ethers.utils.parseEther("3");
    const _takeProfitPrice = 25;
    const _stopLossPrice = 1;
    const _raisedAmountDeadline = Date.now() + 100000;
    const _deadline = _raisedAmountDeadline + 100000;
    const _mobName = "test mob";

    const createTx = await xmobManage
      .connect(owner)
      .createMob(
        _token,
        _tokenId,
        _raisedTotal,
        _takeProfitPrice,
        _stopLossPrice,
        _raisedAmountDeadline,
        _deadline,
        _mobName
      );
    const receipt = await createTx.wait();
    const topic = xmobManage.interface.getEventTopic("MobCreate");
    const logs = receipt.logs
      .filter((log) => log.topics.at(0) === topic)
      .map((log) => xmobManage.interface.parseLog(log));
    expect(logs.length).to.be.equal(1);

    const mobsTotal = await xmobManage.mobsTotal();
    expect(mobsTotal).to.be.equal(1);

    const proxy = await xmobManage.mobsById(mobsTotal);
    expect(logs[0].args.proxy).to.be.equal(proxy);

    // set fee
    const feeRate = 20;
    await (await xmobManage.setFee(feeRate)).wait();
    expect(await xmobManage.feeRate()).to.be.equal(feeRate);

    const mob = await ethers.getContractAt("XmobExchangeCore", proxy);
    // set weth9 address for test
    await (await mob.setWeth9Address(weth9.address)).wait();
    expect(await mob.WETH_ADDR()).to.be.equal(weth9.address);

    // member deposit
    const depositValue = ethers.utils.parseEther("1");
    {
      const tx = await mob
        .connect(m1)
        .joinPay(m1.address, { value: depositValue });
      await tx.wait();
      expect(await mob.memberDetails(m1.address)).to.be.equal(depositValue);
    }

    {
      const tx = await mob
        .connect(m2)
        .joinPay(m2.address, { value: depositValue });
      await tx.wait();
      expect(await mob.memberDetails(m2.address)).to.be.equal(depositValue);
    }

    {
      const tx = await mob
        .connect(m3)
        .joinPay(m3.address, { value: depositValue });
      await tx.wait();
      expect(await mob.memberDetails(m3.address)).to.be.equal(depositValue);
    }

    {
      const depositValue = ethers.utils.parseEther("0.0001");
      expect(
        mob.connect(n5).joinPay(m1.address, { value: depositValue })
      ).to.be.revertedWith("Insufficient quota");
    }

    // set oracle for owner address
    await (await xmobManage.setOracle(owner.address, true)).wait();
    expect(await xmobManage.oracles(owner.address)).to.be.equal(true);

    // check mob balances
    {
      const balances = await mob.balanceAll();
      expect(balances[0]).to.be.equal(ethers.utils.parseEther("0"));
      expect(balances[1]).to.be.equal(_raisedTotal);
    }

    // distribute fund and claim
    {
      // distribute
      const beforeBal = await mob.provider.getBalance(m1.address);
      await (await mob.connect(owner).settlementAllocation(false)).wait();
      expect(await mob.settlements(m1.address)).to.be.equal(depositValue);

      // claim
      await (await mob.connect(m1).claim()).wait();
      const afterBal = await mob.provider.getBalance(m1.address);
      const diff = afterBal.sub(beforeBal).toString();
      // consider gas fee, which should be less than 0.1 normally
      expect(diff).to.be.gte(depositValue.sub(ethers.utils.parseEther("0.1")));
      // the balance difference should be less than the fund return
      expect(diff).to.be.lte(depositValue);
    }
  });

  // todo: add new function to support advance buying

  // todo: complete isValidSignature to get rid of oracle, validate the selling param
});

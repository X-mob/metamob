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
});

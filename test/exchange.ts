import { expect } from "chai";
import { constants } from "ethers";
import { ethers } from "hardhat";
import {
  WETH9,
  TestERC721,
  XmobExchangeCore,
  XmobManage,
  Seaport,
  ConduitController,
} from "../typechain-types";
import {
  checkCreateMob,
  SeaportFixtures,
  seaportFixture,
} from "../scripts/utils";
import { initSomeWalletAccount } from "../scripts/utils/helper";
import { deploy } from "../scripts/deploy";

describe("XmobExchangeCore", function () {
  let weth9: WETH9;
  let testERC721: TestERC721;
  let conduitController: ConduitController;
  let seaport: Seaport;
  let exchangeCore: XmobExchangeCore;
  let xmobManage: XmobManage;

  let createMobAndNftOrder: SeaportFixtures["createMobAndNftOrder"];
  let createMobSellingOrder: SeaportFixtures["createMobSellingOrder"];

  beforeEach(async () => {
    // deploy all contracts
    const contracts = await deploy();
    weth9 = contracts.weth9;
    testERC721 = contracts.testERC721;
    conduitController = contracts.conduitController;
    seaport = contracts.seaport;
    exchangeCore = contracts.exchangeCore;
    xmobManage = contracts.xmobManage;

    const { chainId } = await ethers.provider.getNetwork();
    ({ createMobAndNftOrder, createMobSellingOrder } = await seaportFixture(
      chainId,
      seaport
    ));
  });

  it("Should return the version after deployed", async function () {
    expect(await exchangeCore.VERSION()).to.equal("1.0.0");
  });

  it("Should failed at initializing XmobExchangeCore directly", async function () {
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
    const [owner] = await ethers.getSigners();

    const _token = testERC721.address;
    const _tokenId = 1;
    const _raisedTotal = ethers.utils.parseEther("0.0001");
    const _takeProfitPrice = 25;
    const _stopLossPrice = 1;
    const _raisedAmountDeadline = Date.now() + 100000;
    const _deadline = _raisedAmountDeadline + 100000;
    const _mobName = "test mob";

    await checkCreateMob(owner, xmobManage, {
      _token,
      _tokenId,
      _raisedTotal,
      _takeProfitPrice,
      _stopLossPrice,
      _raisedAmountDeadline,
      _deadline,
      _mobName,
    });
  });

  it("Mob full life cycle", async function () {
    const [owner, m1, m2, m3, n5] = await ethers.getSigners();

    // create a mob
    const _token = testERC721.address;
    const _tokenId = 1;
    const _raisedTotal = ethers.utils.parseEther("3");
    const _takeProfitPrice = 25;
    const _stopLossPrice = 1;
    const _raisedAmountDeadline = Date.now() + 100000;
    const _deadline = _raisedAmountDeadline + 100000;
    const _mobName = "test mob";

    const mob = await checkCreateMob(
      owner,
      xmobManage,
      {
        _token,
        _tokenId,
        _raisedTotal,
        _takeProfitPrice,
        _stopLossPrice,
        _raisedAmountDeadline,
        _deadline,
        _mobName,
      },
      weth9.address,
      seaport.address
    );

    // set fee
    const feeRate = 20;
    await (await xmobManage.setFee(feeRate)).wait();
    expect(await xmobManage.feeRate()).to.be.equal(feeRate);

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

    expect(
      mob.connect(n5).joinPay(m1.address, { value: depositValue })
    ).to.be.revertedWith("Insufficient quota");

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
      await (await mob.settlementAllocation(false)).wait();
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

  it("Mob buyNow => validateSelling => claim flow", async function () {
    const [owner, randomUser] = await ethers.getSigners();

    // init some account wallets
    const [seller, buyer1, buyer2, buyer3, secondBuyer] =
      await initSomeWalletAccount(5);

    // create a mob and order
    const token = testERC721.address;
    const tokenId = 1024;
    const firstHandPrice = ethers.utils.parseEther("3");
    const secondHandPrice = ethers.utils.parseEther("6");
    const earn = ethers.utils.parseEther("1");
    const depositValue = ethers.utils.parseEther("1");

    const _raisedTotal = firstHandPrice;
    const _takeProfitPrice = secondHandPrice;
    const _stopLossPrice = 1;
    const _raisedAmountDeadline = Date.now() + 100000;
    const _deadline = _raisedAmountDeadline + 100000;

    const { mob, basicOrderParameters } = await createMobAndNftOrder(
      { admin: owner, seller, buyer1, buyer2, buyer3 },
      { token, tokenId, testERC721 },
      { seaport, xmobManage, weth9 },
      {
        depositValue,
        firstHandPrice,
        _raisedTotal,
        _raisedAmountDeadline,
        _takeProfitPrice,
        _stopLossPrice,
        _deadline,
      }
    );

    // buyNow
    await (await mob.connect(randomUser).buyNow(basicOrderParameters)).wait();
    expect(await testERC721.balanceOf(mob.address)).to.equal(1);
    expect(await testERC721.ownerOf(tokenId)).to.be.equal(mob.address);

    // try validating invalid under-price order
    const { order: invalidOrder } = await createMobSellingOrder({
      mob,
      token,
      tokenId,
      sellingPrice: secondHandPrice.sub(1),
    });
    await expect(mob.validateSellOrders([invalidOrder])).to.be.revertedWith(
      "wrong consider.startAmount"
    );

    // selling from mob
    const { order } = await createMobSellingOrder({
      mob,
      token,
      tokenId,
      sellingPrice: secondHandPrice,
    });
    await (await mob.validateSellOrders([order])).wait();
    await (
      await seaport
        .connect(secondBuyer)
        .fulfillOrder(order, constants.HashZero, { value: secondHandPrice })
    ).wait();
    expect(await testERC721.ownerOf(tokenId)).to.be.equal(secondBuyer.address);
    expect(await testERC721.balanceOf(mob.address)).to.equal(0);
    expect((await mob.balanceAll())[0]).to.equal(secondHandPrice);
    expect((await mob.balanceAll())[1]).to.equal(0);

    // settlement
    expect(await mob.amountTotal()).to.equal(firstHandPrice);
    expect(await mob.memberDetails(buyer1.address)).to.equal(depositValue);

    await (await mob.connect(randomUser).settlementAllocation(false)).wait();

    expect(await mob.settlements(buyer1.address)).to.equal(
      ethers.utils.parseEther("2")
    );
    expect(await mob.settlements(buyer2.address)).to.equal(
      ethers.utils.parseEther("2")
    );
    expect(await mob.settlements(buyer3.address)).to.equal(
      ethers.utils.parseEther("2")
    );

    const beforeBal = await mob.provider.getBalance(buyer1.address);

    // claim
    await (await mob.connect(buyer1).claim()).wait();
    await (await mob.connect(buyer2).claim()).wait();
    await (await mob.connect(buyer3).claim()).wait();

    // buyer1 earn check
    const afterBal = await mob.provider.getBalance(buyer1.address);
    const diff = afterBal.sub(beforeBal).toString();
    // consider gas fee, which should be less than 0.1 normally
    expect(diff).to.be.gte(
      depositValue.add(earn).sub(ethers.utils.parseEther("0.1"))
    );
    // the balance difference should be less than the fund return
    expect(diff).to.be.lte(depositValue.add(earn));

    // contract should left no money
    expect((await mob.balanceAll())[0]).to.equal(0);
    expect((await mob.balanceAll())[1]).to.equal(0);
  });

  it("Mob buyNow => registerSellingOrder => claim flow", async function () {
    const [owner, randomUser] = await ethers.getSigners();

    // init some account wallets
    const [seller, buyer1, buyer2, buyer3, secondBuyer] =
      await initSomeWalletAccount(5);

    // create a mob and order
    const token = testERC721.address;
    const tokenId = 1024;
    const firstHandPrice = ethers.utils.parseEther("3");
    const secondHandPrice = ethers.utils.parseEther("6");
    const earn = ethers.utils.parseEther("1");
    const depositValue = ethers.utils.parseEther("1");

    const _raisedTotal = firstHandPrice;
    const _takeProfitPrice = secondHandPrice;
    const _stopLossPrice = 1;
    const _raisedAmountDeadline = Date.now() + 100000;
    const _deadline = _raisedAmountDeadline + 100000;

    const { mob, basicOrderParameters } = await createMobAndNftOrder(
      { admin: owner, seller, buyer1, buyer2, buyer3 },
      { token, tokenId, testERC721 },
      { seaport, xmobManage, weth9 },
      {
        depositValue,
        firstHandPrice,
        _raisedTotal,
        _raisedAmountDeadline,
        _takeProfitPrice,
        _stopLossPrice,
        _deadline,
      }
    );

    // buyNow
    await (await mob.connect(randomUser).buyNow(basicOrderParameters)).wait();
    expect(await testERC721.balanceOf(mob.address)).to.equal(1);
    expect(await testERC721.ownerOf(tokenId)).to.be.equal(mob.address);

    // try registering invalid under-price order
    const { order: invalidOrder } = await createMobSellingOrder({
      mob,
      token,
      tokenId,
      sellingPrice: secondHandPrice.sub(1),
    });
    await expect(mob.registerSellOrder([invalidOrder])).to.be.revertedWith(
      "wrong consider.startAmount"
    );

    // selling from mob
    const { order } = await createMobSellingOrder({
      mob,
      token,
      tokenId,
      sellingPrice: secondHandPrice,
    });

    await (await mob.registerSellOrder([order])).wait();

    await (
      await seaport
        .connect(secondBuyer)
        .fulfillOrder(order, constants.HashZero, { value: secondHandPrice })
    ).wait();

    expect(await testERC721.ownerOf(tokenId)).to.be.equal(secondBuyer.address);
    expect(await testERC721.balanceOf(mob.address)).to.equal(0);
    expect((await mob.balanceAll())[0]).to.equal(secondHandPrice);
    expect((await mob.balanceAll())[1]).to.equal(0);

    // settlement
    expect(await mob.amountTotal()).to.equal(firstHandPrice);
    expect(await mob.memberDetails(buyer1.address)).to.equal(depositValue);

    await (await mob.connect(randomUser).settlementAllocation(false)).wait();

    expect(await mob.settlements(buyer1.address)).to.equal(
      ethers.utils.parseEther("2")
    );
    expect(await mob.settlements(buyer2.address)).to.equal(
      ethers.utils.parseEther("2")
    );
    expect(await mob.settlements(buyer3.address)).to.equal(
      ethers.utils.parseEther("2")
    );

    const beforeBal = await mob.provider.getBalance(buyer1.address);

    // claim
    await (await mob.connect(buyer1).claim()).wait();
    await (await mob.connect(buyer2).claim()).wait();
    await (await mob.connect(buyer3).claim()).wait();

    // buyer1 earn check
    const afterBal = await mob.provider.getBalance(buyer1.address);
    const diff = afterBal.sub(beforeBal).toString();
    // consider gas fee, which should be less than 0.1 normally
    expect(diff).to.be.gte(
      depositValue.add(earn).sub(ethers.utils.parseEther("0.1"))
    );
    // the balance difference should be less than the fund return
    expect(diff).to.be.lte(depositValue.add(earn));

    // contract should left no money
    expect((await mob.balanceAll())[0]).to.equal(0);
    expect((await mob.balanceAll())[1]).to.equal(0);
  });

  // todo: add new function to support advance buying
});

import { expect } from "chai";
import { constants } from "ethers";
import { ethers } from "hardhat";
import {
  TestERC721,
  XmobExchangeCore,
  XmobManage,
  Seaport,
} from "../typechain-types";
import {
  checkCreateMob,
  SeaportFixtures,
  seaportFixture,
  ZERO_BYTE32,
} from "../scripts/utils";
import { initSomeWalletAccount } from "../scripts/utils/helper";
import { deploy } from "../scripts/deploy";
import { TargetMode } from "../scripts/utils/type";
import { setFeeRate } from "../scripts/setup";

describe("XmobExchangeCore", function () {
  let testERC721: TestERC721;
  let seaport: Seaport;
  let exchangeCore: XmobExchangeCore;
  let xmobManage: XmobManage;

  let createMobAndNftOrder: SeaportFixtures["createMobAndNftOrder"];
  let createMobSellingOrder: SeaportFixtures["createMobSellingOrder"];

  beforeEach(async () => {
    // deploy all contracts
    const contracts = await deploy();
    testERC721 = contracts.testERC721;
    seaport = contracts.seaport;
    exchangeCore = contracts.exchangeCore;
    xmobManage = contracts.xmobManage;

    // setup
    await setFeeRate(xmobManage.address, 0);

    // utils functions exports
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
    const _tokenId = 1;
    const _fee = 1;
    const _raiseTarget = ethers.utils.parseEther("0.0001");
    const _takeProfitPrice = 25;
    const _stopLossPrice = 1;
    const _raiseDeadline = Date.now() + 1000000;
    const _deadline = Date.now() + 10000000;
    const _targetMode = TargetMode.FULL_OPEN;
    const _name = "test mob";

    await expect(
      exchangeCore
        .connect(owner)
        .initialize(
          _creator,
          _token,
          _tokenId,
          _fee,
          _raiseTarget,
          _takeProfitPrice,
          _stopLossPrice,
          _raiseDeadline,
          _deadline,
          _targetMode,
          _name,
          {
            value: ethers.utils.parseEther("0.0001"), // 0.1 eth,
          }
        )
    ).to.be.revertedWith("Initializable: contract is already initialized");
  });

  it("Init a new mob", async function () {
    const [owner] = await ethers.getSigners();

    const _token = testERC721.address;
    const _tokenId = 1;
    const _raiseTarget = ethers.utils.parseEther("0.001");
    const _takeProfitPrice = 25;
    const _stopLossPrice = 1;
    const _raiseDeadline = Date.now() + 100000;
    const _deadline = _raiseDeadline + 100000;
    const _targetMode = TargetMode.FULL_OPEN;
    const _name = "test mob";

    await checkCreateMob(owner, xmobManage, {
      _token,
      _tokenId,
      _raiseTarget,
      _takeProfitPrice,
      _stopLossPrice,
      _raiseDeadline: _raiseDeadline,
      _deadline,
      _targetMode,
      _name,
    });
  });

  it("Mob buyBasicOrder => validateSelling => claim flow", async function () {
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

    const _raiseTarget = firstHandPrice;
    const _takeProfitPrice = secondHandPrice;
    const _stopLossPrice = 1;
    const _raiseDeadline = Date.now() + 100000;
    const _deadline = _raiseDeadline + 100000;
    const _targetMode = TargetMode.FULL_OPEN;

    const { mob, basicOrderParameters } = await createMobAndNftOrder(
      { admin: owner, seller, buyer1, buyer2, buyer3 },
      { token, tokenId, testERC721 },
      { seaport, xmobManage },
      {
        depositValue,
        firstHandPrice,
        _raiseTarget,
        _raiseDeadline,
        _takeProfitPrice,
        _stopLossPrice,
        _deadline,
        _targetMode,
      }
    );

    // buyBasicOrder
    await (
      await mob.connect(randomUser).buyBasicOrder(basicOrderParameters)
    ).wait();
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
    expect(await ethers.provider.getBalance(mob.address)).to.equal(
      secondHandPrice
    );

    // settlement
    expect((await mob.metadata()).raisedAmount).to.equal(firstHandPrice);
    expect(await mob.memberDetails(buyer1.address)).to.equal(depositValue);

    await (await mob.connect(randomUser).settlementAllocation()).wait();

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
    expect(await ethers.provider.getBalance(mob.address)).to.equal(0);
  });

  it("Mob buyBasicOrder => registerSellingOrder => claim flow", async function () {
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

    const _raiseTarget = firstHandPrice;
    const _takeProfitPrice = secondHandPrice;
    const _stopLossPrice = 1;
    const _raiseDeadline = Date.now() + 100000;
    const _deadline = _raiseDeadline + 100000;
    const _targetMode = TargetMode.FULL_OPEN;

    const { mob, basicOrderParameters } = await createMobAndNftOrder(
      { admin: owner, seller, buyer1, buyer2, buyer3 },
      { token, tokenId, testERC721 },
      { seaport, xmobManage },
      {
        depositValue,
        firstHandPrice,
        _raiseTarget,
        _raiseDeadline,
        _takeProfitPrice,
        _stopLossPrice,
        _deadline,
        _targetMode,
      }
    );

    // buyNow
    await (
      await mob.connect(randomUser).buyBasicOrder(basicOrderParameters)
    ).wait();
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
    expect(await ethers.provider.getBalance(mob.address)).to.equal(
      secondHandPrice
    );

    // settlement
    expect((await mob.metadata()).raisedAmount).to.equal(firstHandPrice);
    expect(await mob.memberDetails(buyer1.address)).to.equal(depositValue);

    await (await mob.connect(randomUser).settlementAllocation()).wait();

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
    expect(await ethers.provider.getBalance(mob.address)).to.equal(0);
  });

  it("Mob buyOrder => registerSellingOrder => claim flow", async function () {
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

    const _raiseTarget = firstHandPrice;
    const _takeProfitPrice = secondHandPrice;
    const _stopLossPrice = 1;
    const _raiseDeadline = Date.now() + 100000;
    const _deadline = _raiseDeadline + 100000;
    const _targetMode = TargetMode.RESTRICT;

    const { mob, order } = await createMobAndNftOrder(
      { admin: owner, seller, buyer1, buyer2, buyer3 },
      { token, tokenId, testERC721 },
      { seaport, xmobManage },
      {
        depositValue,
        firstHandPrice,
        _raiseTarget,
        _raiseDeadline,
        _takeProfitPrice,
        _stopLossPrice,
        _deadline,
        _targetMode,
      }
    );

    // buyNow
    await (await mob.connect(randomUser).buyOrder(order, ZERO_BYTE32)).wait();
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
    const { order: sellingOrder } = await createMobSellingOrder({
      mob,
      token,
      tokenId,
      sellingPrice: secondHandPrice,
    });
    await (await mob.registerSellOrder([sellingOrder])).wait();

    await (
      await seaport
        .connect(secondBuyer)
        .fulfillOrder(sellingOrder, constants.HashZero, {
          value: secondHandPrice,
        })
    ).wait();

    expect(await testERC721.ownerOf(tokenId)).to.be.equal(secondBuyer.address);
    expect(await testERC721.balanceOf(mob.address)).to.equal(0);
    expect(await ethers.provider.getBalance(mob.address)).to.equal(
      secondHandPrice
    );

    // settlement
    expect((await mob.metadata()).raisedAmount).to.equal(firstHandPrice);
    expect(await mob.memberDetails(buyer1.address)).to.equal(depositValue);

    await (await mob.connect(randomUser).settlementAllocation()).wait();

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
    expect(await ethers.provider.getBalance(mob.address)).to.equal(0);
  });

  // todo: add new function to support advance buying
});

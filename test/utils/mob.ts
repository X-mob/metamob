import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { XmobExchangeCore, XmobManage } from "../../typechain-types";
import { expect } from "chai";

export interface CreateMobParams {
  _token: string;
  _tokenId: number;
  _raisedTotal: BigNumber;
  _takeProfitPrice: number | BigNumber;
  _stopLossPrice: number | BigNumber;
  _raisedAmountDeadline: number;
  _deadline: number;
  _mobName: string;
}

export async function checkCreateMob(
  signer: SignerWithAddress,
  xmobManage: XmobManage,
  params: CreateMobParams,
  weth9Addr?: string,
  seaportAddr?: string
): Promise<XmobExchangeCore> {
  const {
    _token,
    _tokenId,
    _raisedTotal,
    _takeProfitPrice,
    _stopLossPrice,
    _raisedAmountDeadline,
    _deadline,
    _mobName,
  } = params;

  const originMobsTotal = await xmobManage.mobsTotal();

  const createTx = await xmobManage
    .connect(signer)
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
    .filter((log) => log.topics[0] === topic)
    .map((log) => xmobManage.interface.parseLog(log));
  expect(logs.length).to.be.equal(1);

  const mobsTotal = await xmobManage.mobsTotal();
  expect(mobsTotal.sub(originMobsTotal)).to.be.equal(1);

  const proxy = await xmobManage.mobsById(mobsTotal);
  expect(logs[0].args.proxy).to.be.equal(proxy);

  const mob = await ethers.getContractAt("XmobExchangeCore", proxy);

  if (weth9Addr) {
    // set weth9 address for test
    await (await mob.setWeth9Address(weth9Addr)).wait();
    expect(await mob.WETH_ADDR()).to.be.equal(weth9Addr);
  }
  if (seaportAddr) {
    // set seaport address for test
    await (await mob.setSeaportAddress(seaportAddr)).wait();
    expect(await mob.SEAPORT_CORE()).to.be.equal(seaportAddr);
  }

  return mob;
}

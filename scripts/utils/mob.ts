import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { XmobExchangeCore, XmobManage } from "../../typechain-types";
import { expect } from "chai";
import { TargetMode } from "./type";

export interface CreateMobParams {
  _token: string;
  _tokenId: number;
  _raiseTarget: BigNumber;
  _takeProfitPrice: number | BigNumber;
  _stopLossPrice: number | BigNumber;
  _raiseDeadline: number;
  _deadline: number;
  _targetMode: TargetMode;
  _name: string;
}

export async function checkCreateMob(
  signer: SignerWithAddress,
  xmobManage: XmobManage,
  params: CreateMobParams,
  seaportAddr?: string
): Promise<XmobExchangeCore> {
  const {
    _token,
    _tokenId,
    _raiseTarget,
    _takeProfitPrice,
    _stopLossPrice,
    _raiseDeadline,
    _deadline,
    _targetMode,
    _name,
  } = params;

  const originMobsTotal = await xmobManage.mobsTotal();

  const createTx = await xmobManage
    .connect(signer)
    .createMob(
      _token,
      _tokenId,
      _raiseTarget,
      _takeProfitPrice,
      _stopLossPrice,
      _raiseDeadline,
      _deadline,
      _targetMode.valueOf(),
      _name
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

  if (seaportAddr) {
    // set seaport address for test
    await (await mob.setSeaportAddress(seaportAddr)).wait();
    expect(await mob.SEAPORT_CORE()).to.be.equal(seaportAddr);
  }

  return mob;
}

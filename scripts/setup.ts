// this script contains some contract setup jobs

import { ethers } from "hardhat";

export async function setFeeRate(address: string) {
  const feeRate = 20;
  const XmobManage = await ethers.getContractFactory("XmobManage");
  const xmobManage = XmobManage.attach(address);
  await (await xmobManage.setFee(feeRate)).wait();
}

export async function setSeaport(
  seaportAddr: string,
  xmobManageAddress: string,
  mobId: number
) {
  const XmobManage = await ethers.getContractFactory("XmobManage");
  const xmobManage = XmobManage.attach(xmobManageAddress);

  const address = await xmobManage.mobsById(mobId);
  const Mob = await ethers.getContractFactory("XmobExchangeCore");
  const mob = Mob.attach(address);

  // set seaport address for test
  await (await mob.setSeaportAddress(seaportAddr)).wait();
}

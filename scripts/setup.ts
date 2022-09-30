// this script contains some contract setup jobs

import { ethers } from "hardhat";

export async function setFeeRate(address: string, feeRate: number = 20) {
  const XmobManage = await ethers.getContractFactory("XmobManage");
  const xmobManage = XmobManage.attach(address);
  await (await xmobManage.setFeeRate(feeRate)).wait();
}

export async function setSeaport(
  seaportAddr: string,
  xmobManageAddress: string,
  mobId: number
) {
  const XmobManage = await ethers.getContractFactory("XmobManage");
  const xmobManage = XmobManage.attach(xmobManageAddress);

  const address = await xmobManage.mobsById(mobId);
  setSeaportForMob(address, seaportAddr);
}

export async function setSeaportForMob(
  mobAddress: string,
  seaportAddr: string
) {
  const Mob = await ethers.getContractFactory("XmobExchangeCore");
  const mob = Mob.attach(mobAddress);

  // set seaport address for test
  await (await mob.setSeaportAddress(seaportAddr)).wait();
}

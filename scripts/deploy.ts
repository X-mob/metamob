import { ethers } from "hardhat";

export async function deploy() {
  // deploy core metamob contracts
  const xmobManage = await deployMetamob();
  const deps = await deployDeps();

  return {
    ...deps,
    ...xmobManage,
  };
}

export async function deployDeps() {
  // deploy Seaport contract
  const Conduit = await ethers.getContractFactory("ConduitController");
  const conduitController = await Conduit.deploy();
  await conduitController.deployed();

  const Seaport = await ethers.getContractFactory("Seaport");
  const seaport = await Seaport.deploy(conduitController.address);
  await seaport.deployed();

  // deploy test ERC721 token
  const TestERC721 = await ethers.getContractFactory("TestERC721");
  const testERC721 = await TestERC721.deploy();
  await testERC721.deployed();

  return {
    seaport,
    conduitController,
    testERC721,
  };
}

export async function deployMetamob() {
  // deploy core metamob contracts
  const ExchangeCore = await ethers.getContractFactory("XmobExchangeCore");
  const exchangeCore = await ExchangeCore.deploy();
  await exchangeCore.deployed();

  const XmobManage = await ethers.getContractFactory("XmobManage");
  const xmobManage = await XmobManage.deploy(exchangeCore.address);
  await xmobManage.deployed();
  return {
    xmobManage,
    exchangeCore,
  };
}

async function main() {
  const contracts = await deployMetamob();
  const keys = Object.keys(contracts);
  for (const key of keys) {
    console.log(`${key}: ${(contracts as any)[key].address}`);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

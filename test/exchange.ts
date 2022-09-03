import { expect } from "chai";
import { ethers } from "hardhat";

describe("XmobExchagneCore", function () {
  it("Should return the version after deployed", async function () {
    const ExchangeCore = await ethers.getContractFactory("XmobExchagneCore");
    const exchangeCore = await ExchangeCore.deploy();
    await exchangeCore.deployed();

    expect(await exchangeCore.version()).to.equal("1.0.0");
  });
});

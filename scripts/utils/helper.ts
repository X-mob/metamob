import crypto from "crypto";
import { BigNumber, BigNumberish } from "ethers";
import type { JsonRpcProvider } from "@ethersproject/providers";
import { ethers } from "hardhat";

export const randomHex = (bytes = 32) => {
  return "0x" + crypto.randomBytes(bytes).toString("hex");
};

export const toBN = (n: BigNumberish) => BigNumber.from(toHex(n));

export const toHex = (n: BigNumberish, numBytes: number = 0) => {
  const asHexString = BigNumber.isBigNumber(n)
    ? n.toHexString().slice(2)
    : typeof n === "string"
    ? hexRegex.test(n)
      ? n.replace(/0x/, "")
      : Number(n).toString(16)
    : Number(n).toString(16);
  return `0x${asHexString.padStart(numBytes * 2, "0")}`;
};

export const toKey = (n: BigNumberish) => toHex(n, 32);

const hexRegex = /[A-Fa-fx]/g;

const TEN_THOUSAND_ETH = ethers.utils
  .parseEther("10000")
  .toHexString()
  .replace("0x0", "0x");

export const faucet = async (address: string, provider: JsonRpcProvider) => {
  await provider.send("hardhat_setBalance", [address, TEN_THOUSAND_ETH]);
};

export const initSomeWalletAccount = async (n = 5) => {
  // init some account wallets
  const wallets = new Array(n)
    .fill(0)
    .map((_) => new ethers.Wallet(randomHex(32), ethers.provider));
  for (const wallet of wallets) {
    await faucet(wallet.address, ethers.provider);
  }
  return wallets;
};

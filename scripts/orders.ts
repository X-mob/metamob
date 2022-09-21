import { constants } from "ethers";
import { ethers } from "hardhat";
import { getBasicOrderParameters, seaportFixture } from "./utils";
import { capitalizeFirstLetter } from "./utils/helper";
import { BasicOrderType, ItemType, OrderType } from "./utils/type";

const seaportAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const testERC721Address = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

const privateKey =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const tokenId = "756";
const sellPrice = ethers.utils.parseEther("2");

const seller = new ethers.Wallet(privateKey, ethers.provider);

async function run() {
  await createBasicOrder();
}

export async function createOrder(mint = true) {
  const Seaport = await ethers.getContractFactory("Seaport");
  const seaport = Seaport.attach(seaportAddress);
  const TestERC721 = await ethers.getContractFactory("TestERC721");
  const testERC721 = TestERC721.attach(testERC721Address);

  const { chainId } = await ethers.provider.getNetwork();
  const { createOrder, getOfferOrConsiderationItem } = await seaportFixture(
    chainId,
    seaport
  );

  // start creating order
  if (mint) {
    await testERC721.connect(seller).mint(seller.address, tokenId);
    await testERC721.connect(seller).setApprovalForAll(seaport.address, true);
  }

  const offer = getOfferOrConsiderationItem(
    ItemType.ERC721,
    testERC721Address,
    tokenId,
    1,
    1
  );
  const consideration = getOfferOrConsiderationItem(
    ItemType.NATIVE,
    constants.AddressZero,
    undefined,
    sellPrice,
    sellPrice,
    seller.address
  );

  const { order } = await createOrder(
    seller,
    [offer],
    [consideration],
    OrderType.FULL_OPEN,
    undefined,
    seller
  );

  for (const [key, value] of Object.entries(order)) {
    console.log(
      `${capitalizeFirstLetter(key)}: ${
        value instanceof BigInt ? value.toString(10) : value
      }`
    );
  }
}

export async function createBasicOrder(mint = true) {
  const Seaport = await ethers.getContractFactory("Seaport");
  const seaport = Seaport.attach(seaportAddress);
  const TestERC721 = await ethers.getContractFactory("TestERC721");
  const testERC721 = TestERC721.attach(testERC721Address);

  const { chainId } = await ethers.provider.getNetwork();
  const { createOrder, getOfferOrConsiderationItem } = await seaportFixture(
    chainId,
    seaport
  );

  // start creating order
  if (mint) {
    await testERC721.connect(seller).mint(seller.address, tokenId);
    await testERC721.connect(seller).setApprovalForAll(seaport.address, true);
  }

  const offer = getOfferOrConsiderationItem(
    ItemType.ERC721,
    testERC721Address,
    tokenId,
    1,
    1
  );
  const consideration = getOfferOrConsiderationItem(
    ItemType.NATIVE,
    constants.AddressZero,
    undefined,
    sellPrice,
    sellPrice,
    seller.address
  );

  const { order } = await createOrder(
    seller,
    [offer],
    [consideration],
    OrderType.FULL_OPEN,
    undefined,
    seller
  );

  const basicOrderParameters = await getBasicOrderParameters(
    BasicOrderType.ETH_TO_ERC721_FULL_OPEN,
    order
  );

  for (const [key, value] of Object.entries(basicOrderParameters)) {
    console.log(
      `${capitalizeFirstLetter(key)}: ${
        value instanceof BigInt ? value.toString(10) : value
      }`
    );
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

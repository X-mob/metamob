import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { calculateOrderHashSignDigest } from "./utils";
import { ItemType, Order, OrderComponents, OrderType } from "./utils/type";

const orderData = {
  parameters: {
    offerer: "0xe5b04618314cea51c1e5b51f487b74a201829a71",
    zone: "0x0000000000000000000000000000000000000000",
    zoneHash:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    startTime: "1664547392",
    endTime: "1680185792",
    orderType: 0,
    salt: "0x0000000000000000000000000000000000000000000000000000000000000001",
    conduitKey:
      "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000",
    offer: [
      {
        itemType: 2,
        token: "0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b",
        identifierOrCriteria: "1199390",
        startAmount: "1",
        endAmount: "1",
      },
    ],
    consideration: [
      {
        itemType: 0,
        token: "0x0000000000000000000000000000000000000000",
        identifierOrCriteria: "0",
        startAmount: "2000000000000000",
        endAmount: "2000000000000000",
        recipient: "0xE5B04618314cea51c1E5B51F487b74a201829A71",
      },
      {
        itemType: 0,
        token: "0x0000000000000000000000000000000000000000",
        identifierOrCriteria: "0",
        startAmount: "2000000000000000",
        endAmount: "2000000000000000",
        recipient: "0x0000a26b00c1F0DF003000390027140000fAa719",
      },
    ],
    totalOriginalConsiderationItems: 2,
    counter: 0,
  },
  signature: "0x30783432",
};

export function apiToOrder(order: typeof orderData): Order {
  return {
    parameters: {
      offerer: order.parameters.offerer,
      zone: order.parameters.zone,
      zoneHash: order.parameters.zoneHash,
      startTime: order.parameters.startTime,
      endTime: order.parameters.endTime,
      orderType: OrderType.FULL_OPEN,
      salt: order.parameters.salt,
      conduitKey: order.parameters.conduitKey,
      offer: [
        {
          itemType: ItemType.ERC721,
          token: order.parameters.offer[0].token,
          identifierOrCriteria: BigNumber.from(
            order.parameters.offer[0].identifierOrCriteria
          ),
          startAmount: BigNumber.from(order.parameters.offer[0].startAmount),
          endAmount: BigNumber.from(order.parameters.offer[0].endAmount),
        },
      ],
      consideration: [
        {
          itemType: ItemType.NATIVE,
          token: order.parameters.consideration[0].token,
          identifierOrCriteria: BigNumber.from(
            order.parameters.consideration[0].identifierOrCriteria
          ),
          startAmount: BigNumber.from(
            order.parameters.consideration[0].startAmount
          ),
          endAmount: BigNumber.from(
            order.parameters.consideration[0].endAmount
          ),
          recipient: order.parameters.consideration[0].recipient,
        },

        {
          itemType: ItemType.NATIVE,
          token: order.parameters.consideration[1].token,
          identifierOrCriteria: BigNumber.from(
            order.parameters.consideration[1].identifierOrCriteria
          ),
          startAmount: BigNumber.from(
            order.parameters.consideration[1].startAmount
          ),
          endAmount: BigNumber.from(
            order.parameters.consideration[1].endAmount
          ),
          recipient: order.parameters.consideration[1].recipient,
        },
      ],
      totalOriginalConsiderationItems: 2,
    },
    signature: order.signature,
  };
}

async function run() {
  const order = apiToOrder(orderData);
  const orderParameters = order.parameters;
  const counter = BigNumber.from("0");

  const orderComponents: OrderComponents = {
    ...orderParameters,
    counter,
  };

  const network = await ethers.getDefaultProvider().getNetwork();
  const chainId = network.chainId;
  if (chainId == null) {
    throw new Error("chain id is null");
  }

  const seaportAddress = "0x00000000006c3852cbEf3e08E8dF289169EdE581";

  const hash = calculateOrderHashSignDigest(
    orderComponents,
    chainId,
    seaportAddress
  );
  console.log("calc digestHash: ", hash);

  const mob = await ethers.getContractAt(
    "XmobExchangeCore",
    order.parameters.offerer
  );
  const isRegister = await mob.registerOrderHashDigest(hash);
  console.log("is register: ", isRegister);
}

run();

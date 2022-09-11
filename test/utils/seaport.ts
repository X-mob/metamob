// most of code are taken from https://github.com/ProjectOpenSea/seaport/blob/1.1/test/utils/fixtures/marketplace.ts

import { expect } from "chai";
import { BigNumber, BigNumberish, constants, Contract, Wallet } from "ethers";
import { Seaport } from "../../typechain-types";
import { randomHex, toBN, toKey } from "./helper";
import {
  AdditionalRecipient,
  BasicOrderParameters,
  BasicOrderType,
  ConsiderationItem,
  ItemType,
  OfferItem,
  Order,
  OrderComponents,
} from "./type";

const VERSION = "1.1";
const MAGIC_SIGNATURE = "0x42";

export const seaportFixture = async (chainId: number, seaport: Seaport) => {
  // Required for EIP712 signing
  const domainData = {
    name: process.env.REFERENCE ? "Consideration" : "Seaport",
    version: VERSION,
    chainId,
    verifyingContract: seaport.address,
  };

  const signOrder = async (
    orderComponents: OrderComponents,
    signer: Wallet | Contract
  ) => {
    const signature = await signer._signTypedData(
      domainData,
      orderType,
      orderComponents
    );
    return signature;
  };

  const createOrder = async (
    offerer: Wallet | Contract,
    offer: OfferItem[],
    consideration: ConsiderationItem[],
    orderType: number,
    timeFlag?: string | null,
    signer?: Wallet,
    zoneHash = constants.HashZero,
    conduitKey = constants.HashZero,
    zone: string = constants.AddressZero,
    useMagicSignature = false
  ) => {
    const counter = await seaport.getCounter(offerer.address);

    const salt = randomHex();
    const startTime =
      timeFlag !== "NOT_STARTED" ? 0 : toBN("0xee00000000000000000000000000");
    const endTime =
      timeFlag !== "EXPIRED" ? toBN("0xff00000000000000000000000000") : 1;

    const orderParameters = {
      offerer: offerer.address,
      zone,
      offer,
      consideration,
      totalOriginalConsiderationItems: consideration.length,
      orderType,
      zoneHash,
      salt,
      conduitKey,
      startTime,
      endTime,
    };

    const orderComponents = {
      ...orderParameters,
      counter,
    };

    const orderHash = await seaport.getOrderHash(orderComponents);
    const { isValidated, isCancelled, totalFilled, totalSize } =
      await seaport.getOrderStatus(orderHash);

    expect(isCancelled).to.equal(false);

    const orderStatus = {
      isValidated,
      isCancelled,
      totalFilled,
      totalSize,
    };

    const sig = useMagicSignature
      ? MAGIC_SIGNATURE
      : await signOrder(orderComponents, signer ?? offerer);

    const order = {
      parameters: orderParameters,
      signature: sig,
      numerator: 1, // only used for advanced orders
      denominator: 1, // only used for advanced orders
      extraData: "0x", // only used for advanced orders
    };

    // How much ether (at most) needs to be supplied when fulfilling the order
    const value = offer
      .map((x) =>
        x.itemType === 0
          ? x.endAmount.gt(x.startAmount)
            ? x.endAmount
            : x.startAmount
          : toBN(0)
      )
      .reduce((a, b) => a.add(b), toBN(0))
      .add(
        consideration
          .map((x) =>
            x.itemType === 0
              ? x.endAmount.gt(x.startAmount)
                ? x.endAmount
                : x.startAmount
              : toBN(0)
          )
          .reduce((a, b) => a.add(b), toBN(0))
      );

    return {
      order,
      orderHash,
      value,
      orderStatus,
      orderComponents,
    };
  };

  const createBasicOrderWithMagicSignature = async (
    offerer: Wallet | Contract,
    offer: OfferItem,
    consideration: ConsiderationItem,
    orderType: BasicOrderType,
    totalOriginalAdditionalRecipients: number,
    additionalRecipients: AdditionalRecipient[],
    timeFlag?: string | null,
    zoneHash = constants.HashZero,
    offererConduitKey = constants.HashZero,
    fulfillerConduitKey = constants.HashZero,
    zone: string = constants.AddressZero
  ) => {
    const salt = randomHex();
    const startTime =
      timeFlag !== "NOT_STARTED" ? 0 : toBN("0xee00000000000000000000000000");
    const endTime =
      timeFlag !== "EXPIRED" ? toBN("0xff00000000000000000000000000") : 1;

    const basicOrderParameters = {
      offerer: offerer.address,
      zone,
      offerToken: offer.token,
      offerIdentifier: offer.identifierOrCriteria,
      offerAmount: offer.startAmount,
      considerationToken: consideration.token,
      considerationIdentifier: consideration.identifierOrCriteria,
      considerationAmount: consideration.startAmount,
      basicOrderType: orderType,
      zoneHash,
      salt,
      offererConduitKey,
      fulfillerConduitKey,
      startTime,
      endTime,
      totalOriginalAdditionalRecipients,
      additionalRecipients,
      signature: MAGIC_SIGNATURE,
    };

    return basicOrderParameters;
  };

  const getOfferOrConsiderationItem = <
    RecipientType extends string | undefined = undefined
  >(
    itemType: ItemType = ItemType.NATIVE,
    token: string = constants.AddressZero,
    tokenId: BigNumberish = 0,
    startAmount: BigNumberish = 1,
    endAmount: BigNumberish = 1,
    recipient?: RecipientType
  ): RecipientType extends string ? ConsiderationItem : OfferItem => {
    const offerItem: OfferItem = {
      itemType,
      token,
      identifierOrCriteria: toBN(tokenId),
      startAmount: toBN(startAmount),
      endAmount: toBN(endAmount),
    };
    if (typeof recipient === "string") {
      return {
        ...offerItem,
        recipient: recipient as string,
      } as ConsiderationItem;
    }
    return offerItem as any;
  };

  return {
    signOrder,
    createOrder,
    getOfferOrConsiderationItem,
    createBasicOrderWithMagicSignature,
  };
};

export type SeaportFixtures = Awaited<ReturnType<typeof seaportFixture>>;

export const getBasicOrderParameters = (
  basicOrderRouteType: BasicOrderType,
  order: Order,
  fulfillerConduitKey: string | boolean = false,
  tips: { amount: BigNumber; recipient: string }[] = []
): BasicOrderParameters => ({
  offerer: order.parameters.offerer,
  zone: order.parameters.zone,
  basicOrderType: order.parameters.orderType + 4 * basicOrderRouteType,
  offerToken: order.parameters.offer[0].token,
  offerIdentifier: order.parameters.offer[0].identifierOrCriteria,
  offerAmount: order.parameters.offer[0].endAmount,
  considerationToken: order.parameters.consideration[0].token,
  considerationIdentifier:
    order.parameters.consideration[0].identifierOrCriteria,
  considerationAmount: order.parameters.consideration[0].endAmount,
  startTime: order.parameters.startTime,
  endTime: order.parameters.endTime,
  zoneHash: order.parameters.zoneHash,
  salt: order.parameters.salt,
  totalOriginalAdditionalRecipients: BigNumber.from(
    order.parameters.consideration.length - 1
  ),
  signature: order.signature,
  offererConduitKey: order.parameters.conduitKey,
  fulfillerConduitKey: toKey(
    typeof fulfillerConduitKey === "string" ? fulfillerConduitKey : 0
  ),
  additionalRecipients: [
    ...order.parameters.consideration
      .slice(1)
      .map(({ endAmount, recipient }) => ({ amount: endAmount, recipient })),
    ...tips,
  ],
});

export const orderType = Object.freeze({
  OrderComponents: [
    { name: "offerer", type: "address" },
    { name: "zone", type: "address" },
    { name: "offer", type: "OfferItem[]" },
    { name: "consideration", type: "ConsiderationItem[]" },
    { name: "orderType", type: "uint8" },
    { name: "startTime", type: "uint256" },
    { name: "endTime", type: "uint256" },
    { name: "zoneHash", type: "bytes32" },
    { name: "salt", type: "uint256" },
    { name: "conduitKey", type: "bytes32" },
    { name: "counter", type: "uint256" },
  ],
  OfferItem: [
    { name: "itemType", type: "uint8" },
    { name: "token", type: "address" },
    { name: "identifierOrCriteria", type: "uint256" },
    { name: "startAmount", type: "uint256" },
    { name: "endAmount", type: "uint256" },
  ],
  ConsiderationItem: [
    { name: "itemType", type: "uint8" },
    { name: "token", type: "address" },
    { name: "identifierOrCriteria", type: "uint256" },
    { name: "startAmount", type: "uint256" },
    { name: "endAmount", type: "uint256" },
    { name: "recipient", type: "address" },
  ],
});

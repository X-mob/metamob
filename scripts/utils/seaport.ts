// most of code are taken from https://github.com/ProjectOpenSea/seaport/blob/1.1/test/utils/fixtures/marketplace.ts

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, BigNumberish, constants, Contract, Wallet } from "ethers";
import { keccak256, toUtf8Bytes, _TypedDataEncoder } from "ethers/lib/utils";
import {
  Seaport,
  TestERC721,
  XmobExchangeCore,
  XmobManage,
} from "../../typechain-types";
import { randomHex, toBN, toKey } from "./helper";
import { checkCreateMob } from "./mob";
import {
  AdditionalRecipient,
  BasicOrderParameters,
  BasicOrderType,
  ConsiderationItem,
  ItemType,
  OfferItem,
  Order,
  OrderComponents,
  OrderType,
  TargetMode,
} from "./type";

const VERSION = "1.1";
const MAGIC_SIGNATURE = "0x30783432"; // 0x42

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

  const getAndVerifyOrderHash = async (orderComponents: OrderComponents) => {
    const orderHash = await seaport.getOrderHash(orderComponents);
    const derivedOrderHash = calculateOrderHash(orderComponents);
    expect(orderHash).to.equal(derivedOrderHash);
    return orderHash;
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

    const orderHash = await getAndVerifyOrderHash(orderComponents);
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

  const createMobAndNftOrder = async (
    {
      admin,
      seller,
      buyer1,
      buyer2,
      buyer3,
    }: {
      admin: SignerWithAddress;
      seller: Wallet;
      buyer1: Wallet;
      buyer2: Wallet;
      buyer3: Wallet;
    },
    {
      token,
      tokenId,
      testERC721,
    }: {
      token: string;
      tokenId: number;
      testERC721: TestERC721;
    },
    { seaport, xmobManage }: { seaport: Seaport; xmobManage: XmobManage },
    {
      firstHandPrice,
      depositValue,
      _raiseTarget,
      _takeProfitPrice,
      _stopLossPrice,
      _raiseDeadline,
      _targetMode,
      _deadline,
    }: {
      firstHandPrice: BigNumber;
      depositValue: BigNumber;
      _raiseTarget: BigNumber;
      _takeProfitPrice: number | BigNumber;
      _stopLossPrice: number | BigNumber;
      _raiseDeadline: number;
      _targetMode: TargetMode;
      _deadline: number;
    }
  ) => {
    await testERC721.mint(seller.address, tokenId);
    await testERC721.connect(seller).setApprovalForAll(seaport.address, true);

    // create a mob
    const _mobName = "test mob";
    const mob = await checkCreateMob(
      admin,
      xmobManage,
      {
        _token: token,
        _tokenId: tokenId,
        _raiseTarget,
        _takeProfitPrice,
        _stopLossPrice,
        _raiseDeadline,
        _deadline,
        _targetMode,
        _name: _mobName,
      },
      seaport.address
    );

    // deposit mob
    await (
      await mob.connect(buyer1).joinPay(buyer1.address, { value: depositValue })
    ).wait();
    await (
      await mob.connect(buyer2).joinPay(buyer2.address, { value: depositValue })
    ).wait();
    await (
      await mob.connect(buyer3).joinPay(buyer3.address, { value: depositValue })
    ).wait();

    {
      const offer = getOfferOrConsiderationItem(
        ItemType.ERC721,
        token,
        tokenId,
        1,
        1
      );
      const consideration = getOfferOrConsiderationItem(
        ItemType.NATIVE,
        constants.AddressZero,
        undefined,
        firstHandPrice,
        firstHandPrice,
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

      return { mob, order, basicOrderParameters };
    }
  };

  const createMobSellingOrder = async ({
    mob,
    token,
    tokenId,
    sellingPrice,
  }: {
    mob: XmobExchangeCore;
    token: string;
    tokenId: number;
    sellingPrice: BigNumber;
  }) => {
    const offer = getOfferOrConsiderationItem(
      ItemType.ERC721,
      token,
      tokenId,
      1,
      1
    );
    const consideration = getOfferOrConsiderationItem(
      ItemType.NATIVE,
      constants.AddressZero,
      undefined,
      sellingPrice,
      sellingPrice,
      mob.address
    ) as ConsiderationItem;
    return await createOrder(
      mob,
      [offer],
      [consideration],
      OrderType.FULL_OPEN,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      true // use magic_signature
    );
  };

  return {
    signOrder,
    createOrder,
    getOfferOrConsiderationItem,
    createBasicOrderWithMagicSignature,
    createMobAndNftOrder,
    createMobSellingOrder,
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

export const calculateOrderHash = (orderComponents: OrderComponents) => {
  const offerItemTypeString =
    "OfferItem(uint8 itemType,address token,uint256 identifierOrCriteria,uint256 startAmount,uint256 endAmount)";
  const considerationItemTypeString =
    "ConsiderationItem(uint8 itemType,address token,uint256 identifierOrCriteria,uint256 startAmount,uint256 endAmount,address recipient)";
  const orderComponentsPartialTypeString =
    "OrderComponents(address offerer,address zone,OfferItem[] offer,ConsiderationItem[] consideration,uint8 orderType,uint256 startTime,uint256 endTime,bytes32 zoneHash,uint256 salt,bytes32 conduitKey,uint256 counter)";
  const orderTypeString = `${orderComponentsPartialTypeString}${considerationItemTypeString}${offerItemTypeString}`;

  const offerItemTypeHash = keccak256(toUtf8Bytes(offerItemTypeString));
  const considerationItemTypeHash = keccak256(
    toUtf8Bytes(considerationItemTypeString)
  );
  const orderTypeHash = keccak256(toUtf8Bytes(orderTypeString));

  const offerHash = keccak256(
    "0x" +
      orderComponents.offer
        .map((offerItem) => {
          return keccak256(
            "0x" +
              [
                offerItemTypeHash.slice(2),
                offerItem.itemType.toString().padStart(64, "0"),
                offerItem.token.slice(2).padStart(64, "0"),
                toBN(offerItem.identifierOrCriteria)
                  .toHexString()
                  .slice(2)
                  .padStart(64, "0"),
                toBN(offerItem.startAmount)
                  .toHexString()
                  .slice(2)
                  .padStart(64, "0"),
                toBN(offerItem.endAmount)
                  .toHexString()
                  .slice(2)
                  .padStart(64, "0"),
              ].join("")
          ).slice(2);
        })
        .join("")
  );

  const considerationHash = keccak256(
    "0x" +
      orderComponents.consideration
        .map((considerationItem) => {
          return keccak256(
            "0x" +
              [
                considerationItemTypeHash.slice(2),
                considerationItem.itemType.toString().padStart(64, "0"),
                considerationItem.token.slice(2).padStart(64, "0"),
                toBN(considerationItem.identifierOrCriteria)
                  .toHexString()
                  .slice(2)
                  .padStart(64, "0"),
                toBN(considerationItem.startAmount)
                  .toHexString()
                  .slice(2)
                  .padStart(64, "0"),
                toBN(considerationItem.endAmount)
                  .toHexString()
                  .slice(2)
                  .padStart(64, "0"),
                considerationItem.recipient.slice(2).padStart(64, "0"),
              ].join("")
          ).slice(2);
        })
        .join("")
  );

  const derivedOrderHash = keccak256(
    "0x" +
      [
        orderTypeHash.slice(2),
        orderComponents.offerer.slice(2).padStart(64, "0"),
        orderComponents.zone.slice(2).padStart(64, "0"),
        offerHash.slice(2),
        considerationHash.slice(2),
        orderComponents.orderType.toString().padStart(64, "0"),
        toBN(orderComponents.startTime)
          .toHexString()
          .slice(2)
          .padStart(64, "0"),
        toBN(orderComponents.endTime).toHexString().slice(2).padStart(64, "0"),
        orderComponents.zoneHash.slice(2),
        orderComponents.salt.slice(2).padStart(64, "0"),
        orderComponents.conduitKey.slice(2).padStart(64, "0"),
        toBN(orderComponents.counter).toHexString().slice(2).padStart(64, "0"),
      ].join("")
  );

  return derivedOrderHash;
};

// note: do not support ens name in the filed
// todo: validate this functions
export const calculateOrderHashSignDigest = (
  orderComponents: OrderComponents,
  chainId: number,
  seaportAddr: string
) => {
  // Required for EIP712 signing
  const domainData = {
    name: "Seaport",
    version: VERSION,
    chainId,
    verifyingContract: seaportAddr,
  };

  const signDigest = _TypedDataEncoder.hash(
    domainData,
    orderType,
    orderComponents
  );
  return signDigest;
};

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

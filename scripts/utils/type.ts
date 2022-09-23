import type { BigNumber } from "ethers";

export enum TargetMode {
  // only buy tokenId NFT
  RESTRICT,
  // don't check tokenId, any tokenId within token is good
  FULL_OPEN,
}

export enum MobStatus {
  RAISING,
  RAISE_SUCCESS,
  NFT_BOUGHT,
  // NFT_SELLING, we can not check nft is sold on chain
  CAN_CLAIM,
  ALL_CLAIMED,
}

export enum ItemType {
  // 0: ETH on mainnet, MATIC on polygon, etc.
  NATIVE,

  // 1: ERC20 items (ERC777 and ERC20 analogues could also technically work)
  ERC20,

  // 2: ERC721 items
  ERC721,

  // 3: ERC1155 items
  ERC1155,

  // 4: ERC721 items where a number of tokenIds are supported
  ERC721_WITH_CRITERIA,

  // 5: ERC1155 items where a number of ids are supported
  ERC1155_WITH_CRITERIA,
}

export enum OrderType {
  // 0: no partial fills, anyone can execute
  FULL_OPEN,

  // 1: partial fills supported, anyone can execute
  PARTIAL_OPEN,

  // 2: no partial fills, only offerer or zone can execute
  FULL_RESTRICTED,

  // 3: partial fills supported, only offerer or zone can execute
  PARTIAL_RESTRICTED,
}

export enum BasicOrderType {
  // 0: no partial fills, anyone can execute
  ETH_TO_ERC721_FULL_OPEN,

  // 1: partial fills supported, anyone can execute
  ETH_TO_ERC721_PARTIAL_OPEN,

  // 2: no partial fills, only offerer or zone can execute
  ETH_TO_ERC721_FULL_RESTRICTED,

  // 3: partial fills supported, only offerer or zone can execute
  ETH_TO_ERC721_PARTIAL_RESTRICTED,

  // 4: no partial fills, anyone can execute
  ETH_TO_ERC1155_FULL_OPEN,

  // 5: partial fills supported, anyone can execute
  ETH_TO_ERC1155_PARTIAL_OPEN,

  // 6: no partial fills, only offerer or zone can execute
  ETH_TO_ERC1155_FULL_RESTRICTED,

  // 7: partial fills supported, only offerer or zone can execute
  ETH_TO_ERC1155_PARTIAL_RESTRICTED,

  // 8: no partial fills, anyone can execute
  ERC20_TO_ERC721_FULL_OPEN,

  // 9: partial fills supported, anyone can execute
  ERC20_TO_ERC721_PARTIAL_OPEN,

  // 10: no partial fills, only offerer or zone can execute
  ERC20_TO_ERC721_FULL_RESTRICTED,

  // 11: partial fills supported, only offerer or zone can execute
  ERC20_TO_ERC721_PARTIAL_RESTRICTED,

  // 12: no partial fills, anyone can execute
  ERC20_TO_ERC1155_FULL_OPEN,

  // 13: partial fills supported, anyone can execute
  ERC20_TO_ERC1155_PARTIAL_OPEN,

  // 14: no partial fills, only offerer or zone can execute
  ERC20_TO_ERC1155_FULL_RESTRICTED,

  // 15: partial fills supported, only offerer or zone can execute
  ERC20_TO_ERC1155_PARTIAL_RESTRICTED,

  // 16: no partial fills, anyone can execute
  ERC721_TO_ERC20_FULL_OPEN,

  // 17: partial fills supported, anyone can execute
  ERC721_TO_ERC20_PARTIAL_OPEN,

  // 18: no partial fills, only offerer or zone can execute
  ERC721_TO_ERC20_FULL_RESTRICTED,

  // 19: partial fills supported, only offerer or zone can execute
  ERC721_TO_ERC20_PARTIAL_RESTRICTED,

  // 20: no partial fills, anyone can execute
  ERC1155_TO_ERC20_FULL_OPEN,

  // 21: partial fills supported, anyone can execute
  ERC1155_TO_ERC20_PARTIAL_OPEN,

  // 22: no partial fills, only offerer or zone can execute
  ERC1155_TO_ERC20_FULL_RESTRICTED,

  // 23: partial fills supported, only offerer or zone can execute
  ERC1155_TO_ERC20_PARTIAL_RESTRICTED,
}

export type AdditionalRecipient = {
  amount: BigNumber;
  recipient: string;
};

export type FulfillmentComponent = {
  orderIndex: number;
  itemIndex: number;
};

export type Fulfillment = {
  offerComponents: FulfillmentComponent[];
  considerationComponents: FulfillmentComponent[];
};

export type CriteriaResolver = {
  orderIndex: number;
  side: 0 | 1;
  index: number;
  identifier: BigNumber;
  criteriaProof: string[];
};

export type BasicOrderParameters = {
  considerationToken: string;
  considerationIdentifier: BigNumber;
  considerationAmount: BigNumber;
  offerer: string;
  zone: string;
  offerToken: string;
  offerIdentifier: BigNumber;
  offerAmount: BigNumber;
  basicOrderType: number;
  startTime: string | BigNumber | number;
  endTime: string | BigNumber | number;
  zoneHash: string;
  salt: string;
  offererConduitKey: string;
  fulfillerConduitKey: string;
  totalOriginalAdditionalRecipients: BigNumber;
  additionalRecipients: AdditionalRecipient[];
  signature: string;
};

export type OfferItem = {
  itemType: ItemType;
  token: string;
  identifierOrCriteria: BigNumber;
  startAmount: BigNumber;
  endAmount: BigNumber;
};

export type ConsiderationItem = {
  itemType: ItemType;
  token: string;
  identifierOrCriteria: BigNumber;
  startAmount: BigNumber;
  endAmount: BigNumber;
  recipient: string;
};

export type OrderParameters = {
  offerer: string;
  zone: string;
  offer: OfferItem[];
  consideration: ConsiderationItem[];
  orderType: OrderType;
  startTime: string | BigNumber | number;
  endTime: string | BigNumber | number;
  zoneHash: string;
  salt: string;
  conduitKey: string;
  totalOriginalConsiderationItems: string | BigNumber | number;
};

export type OrderComponents = Omit<
  OrderParameters,
  "totalOriginalConsiderationItems"
> & {
  counter: BigNumber;
};

export type Order = {
  parameters: OrderParameters;
  signature: string;
};

export type AdvancedOrder = {
  parameters: OrderParameters;
  numerator: string | BigNumber | number;
  denominator: string | BigNumber | number;
  signature: string;
  extraData: string;
};

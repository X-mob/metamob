import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { getBasicOrderParameters, ZERO_BYTE32 } from "./utils";
import { BasicOrderType, ItemType, Order, OrderType } from "./utils/type";

const apiData = {
  next: null,
  previous: null,
  orders: [
    {
      created_date: "2022-09-29T14:12:27.836767",
      closing_date: "2022-10-29T14:09:06",
      listing_time: 1664460546,
      expiration_time: 1667052546,
      order_hash:
        "0xfa371c32e49a2966db1f171932d7240f2b827d81e93452c785379083e71c63b8",
      protocol_data: {
        parameters: {
          offerer: "0x768249ac5ed64517c96c16e26b7a5aa3e9334217",
          offer: [
            {
              itemType: 2,
              token: "0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b",
              identifierOrCriteria: "1354599",
              startAmount: "1",
              endAmount: "1",
            },
          ],
          consideration: [
            {
              itemType: 0,
              token: "0x0000000000000000000000000000000000000000",
              identifierOrCriteria: "0",
              startAmount: "975000000000000",
              endAmount: "975000000000000",
              recipient: "0x768249aC5ED64517C96c16e26B7A5Aa3E9334217",
            },
            {
              itemType: 0,
              token: "0x0000000000000000000000000000000000000000",
              identifierOrCriteria: "0",
              startAmount: "25000000000000",
              endAmount: "25000000000000",
              recipient: "0x0000a26b00c1F0DF003000390027140000fAa719",
            },
          ],
          startTime: "1664460546",
          endTime: "1667052546",
          orderType: 0,
          zone: "0x0000000000000000000000000000000000000000",
          zoneHash:
            "0x0000000000000000000000000000000000000000000000000000000000000000",
          salt: "0x360c6ebe0000000000000000000000000000000000000000b56643c73fd5df79",
          conduitKey:
            "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000",
          totalOriginalConsiderationItems: 2,
          counter: 0,
        },
        signature:
          "0x7396038452a8b3a6ec22171ee770fa3810b0681a1818b65911cac84de7cd30fc6e649e3434f977a31990fe10dd0ba79a061c103b21bbf83aecbb7ed7aca804e01c",
      },
      protocol_address: "0x00000000006c3852cbef3e08e8df289169ede581",
      maker: {
        user: 235586,
        profile_img_url:
          "https://storage.googleapis.com/opensea-static/opensea-profile/29.png",
        address: "0x768249ac5ed64517c96c16e26b7a5aa3e9334217",
        config: "",
      },
      taker: null,
      current_price: "1000000000000000",
      maker_fees: [
        {
          account: {
            user: null,
            profile_img_url:
              "https://storage.googleapis.com/opensea-static/opensea-profile/29.png",
            address: "0x0000a26b00c1f0df003000390027140000faa719",
            config: "",
          },
          basis_points: "250",
        },
      ],
      taker_fees: [],
      side: "ask",
      order_type: "basic",
      cancelled: false,
      finalized: false,
      marked_invalid: false,
      client_signature:
        "0x7396038452a8b3a6ec22171ee770fa3810b0681a1818b65911cac84de7cd30fc6e649e3434f977a31990fe10dd0ba79a061c103b21bbf83aecbb7ed7aca804e01c",
      relay_id: "T3JkZXJWMlR5cGU6ODM4Mjcz",
      criteria_proof: null,
      maker_asset_bundle: {
        assets: [
          {
            id: 130849976,
            num_sales: 1,
            background_color: null,
            image_url:
              "https://lh3.googleusercontent.com/jDFIJBe7q7oE208GMI0gRWX8sNhw2apWX9vdsG_fBwVxy1A9nuA09azjOpFL1LRUFlN53tmkObnyjNyhcF1yTd02JOJh7hIpfrS_",
            image_preview_url:
              "https://lh3.googleusercontent.com/jDFIJBe7q7oE208GMI0gRWX8sNhw2apWX9vdsG_fBwVxy1A9nuA09azjOpFL1LRUFlN53tmkObnyjNyhcF1yTd02JOJh7hIpfrS_=s250",
            image_thumbnail_url:
              "https://lh3.googleusercontent.com/jDFIJBe7q7oE208GMI0gRWX8sNhw2apWX9vdsG_fBwVxy1A9nuA09azjOpFL1LRUFlN53tmkObnyjNyhcF1yTd02JOJh7hIpfrS_=s128",
            image_original_url:
              "https://opensea-private.mypinata.cloud/ipfs/bafybeifvwitulq6elvka2hoqhwixfhgb42l4aiukmtrw335osetikviuuu",
            animation_url: null,
            animation_original_url: null,
            name: "MultiFaucet Test NFT",
            description: "A test NFT dispensed from faucet.paradigm.xyz.",
            external_link: null,
            asset_contract: {
              address: "0xf5de760f2e916647fd766b4ad9e85ff943ce3a2b",
              asset_contract_type: "non-fungible",
              created_date: "2021-11-20T18:57:09.139283",
              name: "MultiFaucet NFT",
              nft_version: null,
              opensea_version: null,
              owner: null,
              schema_name: "ERC721",
              symbol: "MFNFT",
              total_supply: null,
              description: null,
              external_link: null,
              image_url: null,
              default_to_fiat: false,
              dev_buyer_fee_basis_points: 0,
              dev_seller_fee_basis_points: 0,
              only_proxied_transfers: false,
              opensea_buyer_fee_basis_points: 0,
              opensea_seller_fee_basis_points: 250,
              buyer_fee_basis_points: 0,
              seller_fee_basis_points: 250,
              payout_address: null,
            },
            permalink:
              "https://testnets.opensea.io/assets/goerli/0xf5de760f2e916647fd766b4ad9e85ff943ce3a2b/1354599",
            collection: {
              banner_image_url: null,
              chat_url: null,
              created_date: "2021-11-20T18:57:09.305241",
              default_to_fiat: false,
              description: null,
              dev_buyer_fee_basis_points: "0",
              dev_seller_fee_basis_points: "0",
              discord_url: null,
              display_data: {
                card_display_style: "contain",
                images: [],
              },
              external_url: null,
              featured: false,
              featured_image_url: null,
              hidden: false,
              safelist_request_status: "not_requested",
              image_url: null,
              is_subject_to_whitelist: false,
              large_image_url: null,
              medium_username: null,
              name: "MultiFaucet NFT V3",
              only_proxied_transfers: false,
              opensea_buyer_fee_basis_points: "0",
              opensea_seller_fee_basis_points: "250",
              payout_address: null,
              require_email: false,
              short_description: null,
              slug: "multifaucet-nft-v3",
              telegram_url: null,
              twitter_username: null,
              instagram_username: null,
              wiki_url: null,
              is_nsfw: false,
              fees: {
                seller_fees: {},
                opensea_fees: {
                  "0x0000a26b00c1f0df003000390027140000faa719": 250,
                },
              },
              is_rarity_enabled: false,
            },
            decimals: null,
            token_metadata:
              "https://ipfs.io/ipfs/bafybeiezeds576kygarlq672cnjtimbsrspx5b3tr3gct2lhqud6abjgiu",
            is_nsfw: false,
            owner: {
              user: null,
              profile_img_url:
                "https://storage.googleapis.com/opensea-static/opensea-profile/1.png",
              address: "0x0000000000000000000000000000000000000000",
              config: "",
            },
            token_id: "1354599",
          },
        ],
        maker: null,
        slug: null,
        name: null,
        description: null,
        external_link: null,
        asset_contract: {
          address: "0xf5de760f2e916647fd766b4ad9e85ff943ce3a2b",
          asset_contract_type: "non-fungible",
          created_date: "2021-11-20T18:57:09.139283",
          name: "MultiFaucet NFT",
          nft_version: null,
          opensea_version: null,
          owner: null,
          schema_name: "ERC721",
          symbol: "MFNFT",
          total_supply: null,
          description: null,
          external_link: null,
          image_url: null,
          default_to_fiat: false,
          dev_buyer_fee_basis_points: 0,
          dev_seller_fee_basis_points: 0,
          only_proxied_transfers: false,
          opensea_buyer_fee_basis_points: 0,
          opensea_seller_fee_basis_points: 250,
          buyer_fee_basis_points: 0,
          seller_fee_basis_points: 250,
          payout_address: null,
        },
        permalink: "https://testnets.opensea.io/bundles/None",
        seaport_sell_orders: null,
      },
      taker_asset_bundle: {
        assets: [
          {
            id: 1507176,
            num_sales: 0,
            background_color: null,
            image_url:
              "https://openseauserdata.com/files/6f8e2979d428180222796ff4a33ab929.svg",
            image_preview_url:
              "https://openseauserdata.com/files/6f8e2979d428180222796ff4a33ab929.svg",
            image_thumbnail_url:
              "https://openseauserdata.com/files/6f8e2979d428180222796ff4a33ab929.svg",
            image_original_url:
              "https://openseauserdata.com/files/6f8e2979d428180222796ff4a33ab929.svg",
            animation_url: null,
            animation_original_url: null,
            name: "Ether",
            description: "",
            external_link: null,
            asset_contract: {
              address: "0x0000000000000000000000000000000000000000",
              asset_contract_type: "fungible",
              created_date: "2021-03-12T15:05:22.062326",
              name: "Ether",
              nft_version: null,
              opensea_version: null,
              owner: null,
              schema_name: "ERC20",
              symbol: "ETH",
              total_supply: null,
              description: null,
              external_link: null,
              image_url: null,
              default_to_fiat: false,
              dev_buyer_fee_basis_points: 0,
              dev_seller_fee_basis_points: 0,
              only_proxied_transfers: false,
              opensea_buyer_fee_basis_points: 0,
              opensea_seller_fee_basis_points: 250,
              buyer_fee_basis_points: 0,
              seller_fee_basis_points: 250,
              payout_address: null,
            },
            permalink:
              "https://testnets.opensea.io/assets/goerli/0x0000000000000000000000000000000000000000/0",
            collection: {
              banner_image_url: null,
              chat_url: null,
              created_date: "2022-08-05T17:12:11.501958",
              default_to_fiat: false,
              description: null,
              dev_buyer_fee_basis_points: "0",
              dev_seller_fee_basis_points: "0",
              discord_url: null,
              display_data: {
                card_display_style: "contain",
                images: [],
              },
              external_url: null,
              featured: false,
              featured_image_url: null,
              hidden: true,
              safelist_request_status: "not_requested",
              image_url: null,
              is_subject_to_whitelist: false,
              large_image_url: null,
              medium_username: null,
              name: "OpenSea PaymentAssets",
              only_proxied_transfers: false,
              opensea_buyer_fee_basis_points: "0",
              opensea_seller_fee_basis_points: "250",
              payout_address: null,
              require_email: false,
              short_description: null,
              slug: "opensea-paymentassets",
              telegram_url: null,
              twitter_username: null,
              instagram_username: null,
              wiki_url: null,
              is_nsfw: false,
              fees: {
                seller_fees: {},
                opensea_fees: {
                  "0x0000a26b00c1f0df003000390027140000faa719": 250,
                },
              },
              is_rarity_enabled: false,
            },
            decimals: 18,
            token_metadata: "",
            is_nsfw: false,
            owner: {
              user: null,
              profile_img_url:
                "https://storage.googleapis.com/opensea-static/opensea-profile/1.png",
              address: "0x0000000000000000000000000000000000000000",
              config: "",
            },
            token_id: "0",
          },
        ],
        maker: null,
        slug: null,
        name: null,
        description: null,
        external_link: null,
        asset_contract: {
          address: "0x0000000000000000000000000000000000000000",
          asset_contract_type: "fungible",
          created_date: "2021-03-12T15:05:22.062326",
          name: "Ether",
          nft_version: null,
          opensea_version: null,
          owner: null,
          schema_name: "ERC20",
          symbol: "ETH",
          total_supply: null,
          description: null,
          external_link: null,
          image_url: null,
          default_to_fiat: false,
          dev_buyer_fee_basis_points: 0,
          dev_seller_fee_basis_points: 0,
          only_proxied_transfers: false,
          opensea_buyer_fee_basis_points: 0,
          opensea_seller_fee_basis_points: 250,
          buyer_fee_basis_points: 0,
          seller_fee_basis_points: 250,
          payout_address: null,
        },
        permalink: "https://testnets.opensea.io/bundles/None",
        seaport_sell_orders: null,
      },
    },
  ],
};

export function apiToOrder(data: typeof apiData): Order {
  const order = data.orders[0].protocol_data;
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

export async function buyBasicOrder(mobAddress: string) {
  const [user] = await ethers.getSigners();
  const order: Order = apiToOrder(apiData);
  const contract = await ethers.getContractAt("XmobExchangeCore", mobAddress);
  const basicOrderParameters = await getBasicOrderParameters(
    BasicOrderType.ETH_TO_ERC721_FULL_OPEN,
    order
  );
  const tx = await contract
    .connect(user)
    .populateTransaction.buyBasicOrder(basicOrderParameters, {
      value: ethers.utils.parseEther("0.001"),
    });
  const res = await contract.connect(user).provider.call(tx);
  console.log(res);
}

export async function buyOrder(mobAddress: string) {
  const [user] = await ethers.getSigners();
  const order: Order = apiToOrder(apiData);
  const contract = await ethers.getContractAt("XmobExchangeCore", mobAddress);
  const tx = await contract
    .connect(user)
    .populateTransaction.buyOrder(order, ZERO_BYTE32, {
      value: ethers.utils.parseEther("0.001"),
    });
  const res = await contract.connect(user).provider.call(tx);
  console.log(res);
}

async function run() {
  await buyBasicOrder("0x935797ca39Dd18725a368eA0F063dE129B200780");
}

run();

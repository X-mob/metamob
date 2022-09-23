// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

// note: only include successful status
enum MobStatus {
    RAISING,
    RAISE_SUCCESS,
    NFT_BOUGHT,
    CAN_CLAIM, // NFT_SOLD is not including, we can not check nft is sold on chain
    ALL_CLAIMED
}

enum TargetMode {
    // only buy tokenId NFT
    RESTRICT,
    // don't check tokenId, any tokenId within token is good
    FULL_OPEN
}

struct MobMetadata {
    string name;
    address creator;
    address token; // nft token address
    uint256 tokenId; // nft token id, ERC721 standard require uint256
    uint256 raisedAmount;
    uint256 raiseTarget;
    uint256 takeProfitPrice;
    uint256 stopLossPrice;
    uint256 fee;
    uint64 deadline;
    uint64 raiseDeadline;
    TargetMode targetMode;
    MobStatus status;
}

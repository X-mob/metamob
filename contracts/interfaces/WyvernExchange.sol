// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface WyvernExchange {
    /**
     * @dev Call hashToSign - Solidity ABI encoding limitation workaround, hopefully temporary.
     */
    function hashToSign_(
        address[7] memory addrs,
        uint[9] memory uints,
        uint8 feeMethod,
        uint8 side,
        uint8 saleKind,
        uint8 howToCall,
        bytes memory data,
        bytes memory replacementPattern,
        bytes memory staticExtradata)
        external
        view
        returns (bytes32);

    
    /**
     * @dev Call atomicMatch - Solidity ABI encoding limitation workaround, hopefully temporary.
     */
    function atomicMatch_(
        address[14] memory addrs,
        uint[18] memory uints, 
        uint8[8] memory feeMethodsSidesKindsHowToCalls,
        bytes memory calldataBuy,
        bytes memory calldataSell,
        bytes memory replacementPatternBuy,
        bytes memory replacementPatternSell,
        bytes memory staticExtradataBuy,
        bytes memory staticExtradataSell,
        uint8[2] memory vs,
        bytes32[5] memory rssMetadata)
        external
        payable;

}
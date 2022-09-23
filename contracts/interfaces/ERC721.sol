// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ERC721 {
    /**
     * isApprovedForAll
     */
    function isApprovedForAll(address account, address operator)
        external
        returns (bool);

    /**
     * setApprovalForAll
     */
    function setApprovalForAll(address operator, bool approved) external;
}

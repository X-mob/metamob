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

    function balanceOf(address owner) external view returns (uint256);

    function ownerOf(uint256 id) external view returns (address owner);
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface WETH9Interface {
    /** ETH swap to WETH */
    function deposit() external payable;

    /** WETH swap to ETH */
    function withdraw(uint256 wad) external;

    function approve(address guy, uint256 wad) external returns (bool);

    function balanceOf(address owner) external view returns (uint256);
}

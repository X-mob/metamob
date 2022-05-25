// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


interface WETH {
    /** ETH swap to WETH */
    function deposit() external payable;

    /** WETH swap to ETH */
    function withdraw(uint wad) external;

    function approve(address guy, uint wad) external returns(bool);

    function balanceOf(address owner) external view returns(uint);
}

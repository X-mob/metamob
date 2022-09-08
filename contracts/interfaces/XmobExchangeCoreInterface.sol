// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface XmobExchangeCoreInterface {
    function amountTotal() external view returns (uint256);

    function joinPay(address member) external payable;
}

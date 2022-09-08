// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface WyvernProxyRegister {
    /**
     * Register a proxy contract with this registry
     */
    function registerProxy() external returns (address);

    /**
     *  /* Authenticated proxies by user.
     */
    function proxies(address proxy) external view returns (address);
}

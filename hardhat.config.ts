import * as dotenv from "dotenv";

import { HardhatUserConfig } from "hardhat/config";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "hardhat-gas-reporter";
import "solidity-coverage";
import { env } from "process";

dotenv.config({ path: "./.env" });

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.5",
        settings: {
          outputSelection: {
            "*": {
              "*": ["abi", "storageLayout"],
            },
          },
        },
      },
      {
        version: "0.4.22",
      },

      // taken from https://github.com/ProjectOpenSea/seaport/blob/1.1/hardhat.config.ts#L29
      {
        version: "0.8.14",
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 19066,
          },
        },
      },
    ],

    // taken from https://github.com/ProjectOpenSea/seaport/blob/1.1/hardhat.config.ts#L39
    overrides: {
      "contracts/deps/seaport/conduit/Conduit.sol": {
        version: "0.8.14",
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 1000000,
          },
        },
      },
      "contracts/deps/seaport/conduit/ConduitController.sol": {
        version: "0.8.14",
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 1000000,
          },
        },
      },
    },
  },
  networks: {
    hardhat: {},
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${env.INFURA_KEY}`,
      accounts: env.PRIVATE_KEY ? [env.PRIVATE_KEY] : [],
    },

    goerli: {
      url: `https://goerli.infura.io/v3/${env.INFURA_KEY}`,
      accounts: env.PRIVATE_KEY ? [env.PRIVATE_KEY] : [],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
};

export default config;

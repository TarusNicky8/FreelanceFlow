require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    liskSepolia: {
      url: "https://rpc.sepolia-api.lisk.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 4202,
    },
    liskMainnet: {
      url: "https://rpc.api.lisk.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1135,
    },
  },
  etherscan: {
    apiKey: {
      liskSepolia: process.env.LISK_EXPLORER_API_KEY || "",
      liskMainnet: process.env.LISK_EXPLORER_API_KEY || "",
    },
    customChains: [
      {
        network: "liskSepolia",
        chainId: 4202,
        urls: {
          apiURL: "https://sepolia-blockscout.lisk.com/api",
          browserURL: "https://sepolia-blockscout.lisk.com/",
        },
      },
      {
        network: "liskMainnet",
        chainId: 1135,
        urls: {
          apiURL: "https://blockscout.lisk.com/api",
          browserURL: "https://blockscout.lisk.com/",
        },
      },
    ],
  },
};

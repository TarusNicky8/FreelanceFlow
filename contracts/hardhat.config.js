require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    // Configure multiple compilers if your project has contracts
    // with different pragma versions.
    // The 'compilers' array allows you to specify configurations for each.
    compilers: [
      {
        version: "0.8.20", // For your Escrow, USDC (if they use this pragma)
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.28", // For contracts/Lock.sol
        settings: {
          optimizer: {
            enabled: true,
            runs: 200, // Apply optimization to this version too
          },
        },
      },
    ],
  },
  networks: {
    liskTestnet: {
      url: "https://4202.rpc.thirdweb.com",
      chainId: 4202,
      accounts: [process.env.PRIVATE_KEY],
    },
  },
};
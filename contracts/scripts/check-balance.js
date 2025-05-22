const { ethers } = require("hardhat");

async function main() {
  console.log("------------------------------------------");
  console.log("Starting balance check...");

  let deployer;
  try {
    [deployer] = await ethers.getSigners();
    console.log("Account address found by Hardhat:", deployer.address);
    if (deployer.address !== "0x58ccf714F804a10cd9FE22fCcc044d77Ea34e5b1") {
      console.log("WARNING: Hardhat's deployer address does NOT match your expected address!");
      console.log("Expected: 0x58ccf714F804a10cd9FE22fCcc044d77Ea34e5b1");
    }
  } catch (error) {
    console.error("Error getting deployer signer:", error.message);
    console.log("This often means your PRIVATE_KEY is missing or invalid in .env.");
    console.log("------------------------------------------");
    process.exit(1);
  }

  try {
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH (native token)");
    console.log("------------------------------------------");

  } catch (error) {
    console.error("Error fetching balance from RPC:", error.message);
    console.log("This might indicate an RPC connection issue or an issue with the provider.");
    console.log("Please ensure the RPC URL in hardhat.config.js is correct and accessible.");
    console.log("------------------------------------------");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("An unhandled error occurred:", error);
    process.exit(1);
  });
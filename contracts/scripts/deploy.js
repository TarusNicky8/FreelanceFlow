// contracts/scripts/deploy.js

async function main() {
  // Get the contract factories
  const Escrow = await ethers.getContractFactory("Escrow");

  // Get the current network name from the Hardhat Runtime Environment (hre)
  const { network } = hre;
  console.log(`Deploying contracts to ${network.name} network...`);

  let usdcTokenAddress;

  // --- IMPORTANT: Conditional deployment/usage of USDC ---
  if (network.name === "liskMainnet") {
    // For Lisk Mainnet, you MUST use the official USDC token address.
    // This address has been updated with the one you provided.
    usdcTokenAddress = "0xF242275d3a6527d877f2c927a82D9b057609cc71"; // Official Lisk Mainnet USDC Address
    console.log(`Using official USDC token at: ${usdcTokenAddress} on Lisk Mainnet.`);
  } else {
    // For testnets (like Lisk Sepolia) or local development, deploy a mock USDC.
    const UsdcMock = await ethers.getContractFactory("USDC_Mock");
    console.log("Deploying USDC_Mock (for testnet/development)...");
    const usdcMock = await UsdcMock.deploy();
    await usdcMock.waitForDeployment();
    usdcTokenAddress = await usdcMock.getAddress();
    console.log(`USDC_Mock deployed to: ${usdcTokenAddress}`);
  }
  // --- End of USDC handling ---

  // Deploy Escrow contract, passing the USDC token address (either mock or real) to its constructor
  console.log("Deploying Escrow contract...");
  const escrow = await Escrow.deploy(usdcTokenAddress);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log(`Escrow deployed to: ${escrowAddress}`);

  console.log(`\nDeployment complete on ${network.name} network!`);
  console.log("------------------------------------------");
  console.log(`USDC Token Address used: ${usdcTokenAddress}`); // This will be mock or real
  console.log(`Escrow Contract Address: ${escrowAddress}`);
  console.log("------------------------------------------");

  // Optional: Save addresses to a file for easy access
  const fs = require('fs');
  const contractsDir = __dirname + '/../contractsData';
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }
  // Change filename to reflect the deployed network
  fs.writeFileSync(
    contractsDir + `/${network.name}-contract-addresses.json`,
    JSON.stringify({ UsdcToken: usdcTokenAddress, Escrow: escrowAddress }, undefined, 2)
  );
  console.log(`Contract addresses saved to ${contractsDir}/${network.name}-contract-addresses.json`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

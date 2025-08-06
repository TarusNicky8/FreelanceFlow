// scripts/deploy-profitflow.js
const { ethers, upgrades } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  const { network } = hre;
  console.log(`Deploying ProfitFlow to ${network.name} network...`);

  // Define the USDC token address for Lisk Mainnet
  const usdcTokenAddress = "0xF242275d3a6527d877f2c927a82D9b057609cc71";

  // Get the ContractFactory for ProfitFlow
  const ProfitFlow = await ethers.getContractFactory("ProfitFlow");

  // Deploy the upgradable proxy.
  // The deployProxy function handles the proxy deployment and calls the initialize function.
  // The arguments passed here are for the initialize function (_usdc address).
  console.log("Deploying ProfitFlow proxy contract...");
  const profitFlow = await upgrades.deployProxy(ProfitFlow, [
    usdcTokenAddress // Pass only the USDC token address, as initialize(address _usdc) expects one argument.
  ], {
    kind: 'uups', // Specify the UUPS proxy pattern
    initializer: 'initialize' // Specify the name of the initializer function
  });

  await profitFlow.waitForDeployment();
  const profitFlowAddress = await profitFlow.getAddress();

  console.log(`ProfitFlow deployed to: ${profitFlowAddress}`);
  console.log(`Implementation contract address (behind proxy): ${await upgrades.erc1967.getImplementationAddress(profitFlowAddress)}`);

  console.log(`\nDeployment complete on ${network.name} network!`);
  console.log("------------------------------------------");
  console.log(`ProfitFlow Proxy Address: ${profitFlowAddress}`);
  console.log(`USDC Token Address used: ${usdcTokenAddress}`);
  console.log("------------------------------------------");

  // Save contract addresses
  const contractsDir = path.join(__dirname, '../contractsData');
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }
  const filePath = path.join(contractsDir, `${network.name}-profitflow-addresses.json`);
  fs.writeFileSync(
    filePath,
    JSON.stringify({
      ProfitFlowProxy: profitFlowAddress,
      ProfitFlowImplementation: await upgrades.erc1967.getImplementationAddress(profitFlowAddress),
      USDC: usdcTokenAddress
    }, undefined, 2)
  );
  console.log(`ProfitFlow contract addresses saved to ${filePath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


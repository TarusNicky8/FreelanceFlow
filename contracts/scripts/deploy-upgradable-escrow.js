// scripts/deploy-upgradable-escrow.js
const { ethers, upgrades } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  const { network } = hre;
  console.log(`Deploying NEW Upgradable Escrow contract on ${network.name} network...`);

  // --- IMPORTANT: USE YOUR DEPLOYED PROFIT_FLOW_PROXY_ADDRESS ---
  const PROFIT_FLOW_PROXY_ADDRESS = "0x31b3226b20F787463bE9f7aDE64C4676D448Cf17"; // <--- Your deployed ProfitFlow Proxy Address

  // Define the USDC token address
  const usdcTokenAddress = "0xF242275d3a6527d877f2c927a82D9b057609cc71";

  // Define the initial platform fee percentage (e.g., 0.5% = 50 basis points)
  const initialFeePercentage = 50; // Setting a low 0.5% fee to start

  // Get the ContractFactory for Escrow
  const Escrow = await ethers.getContractFactory("Escrow");

  // Deploy the upgradable proxy for Escrow
  console.log("Deploying Escrow proxy contract...");
  const escrow = await upgrades.deployProxy(Escrow, [
    usdcTokenAddress,
    PROFIT_FLOW_PROXY_ADDRESS,
    initialFeePercentage
  ], {
    kind: 'uups', // Specify the UUPS proxy pattern
    initializer: 'initialize' // Specify the name of the initializer function
  });

  await escrow.waitForDeployment();
  const newEscrowProxyAddress = await escrow.getAddress();

  console.log(`NEW Upgradable Escrow deployed to: ${newEscrowProxyAddress}`);
  console.log(`New Escrow Implementation Address (behind proxy): ${await upgrades.erc1967.getImplementationAddress(newEscrowProxyAddress)}`);

  console.log(`\nDeployment complete on ${network.name} network!`);
  console.log("------------------------------------------");
  console.log(`NEW Upgradable Escrow Proxy Address: ${newEscrowProxyAddress}`);
  console.log(`NEW Escrow Implementation Address: ${await upgrades.erc1967.getImplementationAddress(newEscrowProxyAddress)}`);
  console.log(`ProfitFlow Proxy Address used: ${PROFIT_FLOW_PROXY_ADDRESS}`);
  console.log(`Initial Platform Fee Set: ${initialFeePercentage / 100}%`);
  console.log("------------------------------------------");

  // Save contract addresses
  const contractsDir = path.join(__dirname, '../contractsData');
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }
  const filePath = path.join(contractsDir, `${network.name}-new-upgradable-escrow-addresses.json`);
  fs.writeFileSync(
    filePath,
    JSON.stringify({
      EscrowProxy: newEscrowProxyAddress,
      EscrowImplementation: await upgrades.erc1967.getImplementationAddress(newEscrowProxyAddress),
      ProfitFlowProxy: PROFIT_FLOW_PROXY_ADDRESS,
      USDC: usdcTokenAddress
    }, undefined, 2)
  );
  console.log(`New Upgradable Escrow contract addresses saved to ${filePath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


// scripts/upgrade-escrow.js
const { ethers, upgrades } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  const { network } = hre;
  console.log(`Upgrading Escrow contract on ${network.name} network...`);

  // --- IMPORTANT: REPLACE THESE WITH YOUR ACTUAL DEPLOYED ADDRESSES ---
  const EXISTING_ESCROW_PROXY_ADDRESS = "YOUR_EXISTING_ESCROW_PROXY_ADDRESS"; // <--- REPLACE THIS
  const PROFIT_FLOW_PROXY_ADDRESS = "YOUR_PROFIT_FLOW_PROXY_ADDRESS";     // <--- REPLACE THIS
  // -------------------------------------------------------------------

  // Define the USDC token address (should be the same as your current Escrow contract)
  const usdcTokenAddress = "0xF242275d3a6527d877f2c927a82D9b057609cc71";

  // Define the initial platform fee percentage (e.g., 1% = 100 basis points)
  // You can adjust this initial value.
  const initialFeePercentage = 100; // 1% fee

  // Get the ContractFactory for the new Escrow implementation
  const Escrow = await ethers.getContractFactory("Escrow");

  // Perform the upgrade
  console.log(`Upgrading Escrow proxy at ${EXISTING_ESCROW_PROXY_ADDRESS}...`);
  const upgradedEscrow = await upgrades.upgradeProxy(
    EXISTING_ESCROW_PROXY_ADDRESS,
    Escrow,
    {
      call: {
        fn: 'initialize', // Specify the initialize function
        args: [
          (await ethers.getSigners())[0].address, // Owner (deployer's address)
          usdcTokenAddress,
          PROFIT_FLOW_PROXY_ADDRESS,
          initialFeePercentage
        ]
      }
    }
  );

  await upgradedEscrow.waitForDeployment();
  const upgradedEscrowAddress = await upgradedEscrow.getAddress();

  console.log(`Escrow proxy upgraded at: ${upgradedEscrowAddress}`);
  console.log(`New Escrow implementation address: ${await upgrades.erc1967.getImplementationAddress(upgradedEscrowAddress)}`);

  console.log(`\nUpgrade complete on ${network.name} network!`);
  console.log("------------------------------------------");
  console.log(`Upgraded Escrow Proxy Address: ${upgradedEscrowAddress}`);
  console.log(`New Escrow Implementation Address: ${await upgrades.erc1967.getImplementationAddress(upgradedEscrowAddress)}`);
  console.log(`ProfitFlow Proxy Address used: ${PROFIT_FLOW_PROXY_ADDRESS}`);
  console.log(`Initial Platform Fee Set: ${initialFeePercentage / 100}%`);
  console.log("------------------------------------------");

  // Update contract addresses file (optional, but good practice)
  const contractsDir = path.join(__dirname, '../contractsData');
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }
  const filePath = path.join(contractsDir, `${network.name}-escrow-upgraded-addresses.json`);
  fs.writeFileSync(
    filePath,
    JSON.stringify({
      EscrowProxy: upgradedEscrowAddress,
      EscrowNewImplementation: await upgrades.erc1967.getImplementationAddress(upgradedEscrowAddress),
      ProfitFlowProxy: PROFIT_FLOW_PROXY_ADDRESS,
      USDC: usdcTokenAddress
    }, undefined, 2)
  );
  console.log(`Upgraded Escrow contract addresses saved to ${filePath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

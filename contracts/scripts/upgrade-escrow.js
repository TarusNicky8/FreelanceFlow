// scripts/upgrade-escrow.js
const { ethers, upgrades } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  const { network } = hre;
  console.log(`Upgrading Escrow contract on ${network.name} network...`);

  // IMPORTANT: Ensure these addresses are correct for your deployed contracts
  const EXISTING_ESCROW_PROXY_ADDRESS = "0xB5f7fa638DA58Bb43297e3Fd220C35830a4bd5c1";
  const PROFIT_FLOW_PROXY_ADDRESS = "0x31b3226b20F787463bE9f7aDE64C4676D448Cf17"; // Address of your ProfitFlow contract
  const usdcTokenAddress = "0xF242275d3a6527d877f2c927a82D9b057609cc71"; // Address of your USDC token

  // This initial fee percentage is only set during the *initial* deployment's initialize.
  // For upgrades, the existing fee percentage on the proxy will persist.
  const initialFeePercentage = 100; // 1% fee (100 basis points)

  // Get the ContractFactory for the new Escrow implementation
  const Escrow = await ethers.getContractFactory("Escrow");

  // Perform the upgrade
  console.log(`Upgrading Escrow proxy at ${EXISTING_ESCROW_PROXY_ADDRESS}...`);
  // The 'call' object has been removed because the initialize function is not called again during upgrade.
  // New functions are simply added to the new implementation.
  const upgradedEscrow = await upgrades.upgradeProxy(
    EXISTING_ESCROW_PROXY_ADDRESS,
    Escrow
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
  console.log(`Initial Platform Fee (from original deployment/last update): ${initialFeePercentage / 100}% (Note: this is only for logging, actual fee on contract persists unless manually updated)`);
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

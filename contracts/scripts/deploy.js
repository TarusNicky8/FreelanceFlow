
async function main() {

  const Escrow = await ethers.getContractFactory("Escrow");

  const { network } = hre;
  console.log(`Deploying contracts to ${network.name} network...`);

  let usdcTokenAddress;

  if (network.name === "liskMainnet") {

    usdcTokenAddress = "0xF242275d3a6527d877f2c927a82D9b057609cc71"; 
    console.log(`Using official USDC token at: ${usdcTokenAddress} on Lisk Mainnet.`);
  } else {
    const UsdcMock = await ethers.getContractFactory("USDC_Mock");
    console.log("Deploying USDC_Mock (for testnet/development)...");
    const usdcMock = await UsdcMock.deploy();
    await usdcMock.waitForDeployment();
    usdcTokenAddress = await usdcMock.getAddress();
    console.log(`USDC_Mock deployed to: ${usdcTokenAddress}`);
  }

  console.log("Deploying Escrow contract...");
  const escrow = await Escrow.deploy(usdcTokenAddress);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log(`Escrow deployed to: ${escrowAddress}`);

  console.log(`\nDeployment complete on ${network.name} network!`);
  console.log("------------------------------------------");
  console.log(`USDC Token Address used: ${usdcTokenAddress}`); 
  console.log(`Escrow Contract Address: ${escrowAddress}`);
  console.log("------------------------------------------");

  const fs = require('fs');
  const contractsDir = __dirname + '/../contractsData';
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }
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

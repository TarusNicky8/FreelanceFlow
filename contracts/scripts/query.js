const { apiClient } = require('@liskhq/lisk-client');
const ethers = require('ethers');

async function queryEscrow(escrowAddress, freelancerAddress) {
  const provider = new ethers.providers.JsonRpcProvider("https://4202.rpc.thirdweb.com");
  const escrow = new ethers.Contract(escrowAddress, ["function deposits(address) view returns (uint256)"], provider);
  const balance = await escrow.deposits(freelancerAddress);
  console.log(`Freelancer ${freelancerAddress} has ${balance} USDC in escrow`);
}

// Run with: node scripts/query.js <escrowAddress> <freelancerAddress>
    const hre = require("hardhat");

    async function main() {
      const [deployer] = await hre.ethers.getSigners();
      console.log("Deploying contracts with the account:", deployer.address);

      let usdcAddress;
      // Option 1: Use an existing USDC address from environment variable (e.g., for official testnet USDC)
      if (process.env.USDC_ADDRESS_TO_USE) {
        usdcAddress = process.env.USDC_ADDRESS_TO_USE;
        console.log("Using existing USDC at address:", usdcAddress);
      } else {
        // Option 2: Deploy a new Mock USDC contract (common for local development/testing)
        console.log("Deploying a new Mock USDC contract...");
        const USDC = await hre.ethers.getContractFactory("USDC");
        const usdc = await USDC.deploy();
        await usdc.waitForDeployment();
        usdcAddress = usdc.target;
        console.log("Mock USDC deployed to:", usdcAddress);
      }

      // Deploy the Escrow contract, passing the USDC address to its constructor
      const Escrow = await hre.ethers.getContractFactory("Escrow");
      const escrow = await Escrow.deploy(usdcAddress);
      await escrow.waitForDeployment();

      console.log("Escrow contract deployed to:", escrow.target);

      // IMPORTANT: Log these addresses clearly to update your backend
      console.log("\n--- Addresses to update in Vercel Backend Environment Variables ---");
      console.log("ESCROW_SEPOLIA_CONTRACT_ADDRESS:", escrow.target);
      console.log("USDC_SEPOLIA_CONTRACT_ADDRESS (for backend if needed):", usdcAddress);
      console.log("------------------------------------------------------------------");
    }

    main().catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
    
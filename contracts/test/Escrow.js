const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Escrow", function () {
  let usdc, escrow, owner, client, freelancer;

  beforeEach(async function () {
    [owner, client, freelancer] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("USDC");
    try {
      console.log("DEBUG: Attempting to deploy USDC contract...");
      usdc = await USDC.deploy(); 
      
      console.log("DEBUG: USDC deployment call resolved.");
      if (usdc && usdc.target) {
        console.log("DEBUG: USDC contract deployed successfully at address:", usdc.target);
      } else {
        console.error("DEBUG: USDC contract deployment failed or returned an invalid instance.");
        console.error("DEBUG: Value of 'usdc' object after deployment:", usdc);
        throw new Error("USDC contract failed to deploy or target address is missing.");
      }
    } catch (error) {
      console.error("DEBUG: Error deploying USDC contract in try-catch:", error);
      throw error; 
    }

    console.log("DEBUG: Attempting to get Escrow contract factory...");
    let EscrowFactory;
    try {
        EscrowFactory = await ethers.getContractFactory("Escrow");
        console.log("DEBUG: Escrow contract factory successfully obtained.");
        console.log("DEBUG: EscrowFactory object:", EscrowFactory);
    } catch (error) {
        console.error("DEBUG: Error getting Escrow contract factory:", error);
        throw error;
    }
    
    if (!EscrowFactory || typeof EscrowFactory.deploy !== 'function') {
        throw new Error("Escrow contract factory is invalid or missing 'deploy' method.");
    }
    const Escrow = EscrowFactory; 

    try {
      console.log("DEBUG: Attempting to deploy Escrow contract with USDC address:", usdc.target);
      escrow = await Escrow.deploy(usdc.target); 
      
      console.log("DEBUG: Escrow deployment successful.");
      console.log("DEBUG: Escrow contract deployed at address:", escrow.target);
    } catch (error) {
      console.error("DEBUG: Error deploying Escrow contract in try-catch:", error);
      console.error("DEBUG: Ensure Escrow contract constructor is correct and USDC address is valid.");
      console.error("DEBUG: Value of usdc.target when deploying Escrow:", usdc.target);
      throw error;
    }

    // Attempt USDC transfer for client
    try {
      console.log("DEBUG: Transferring 1000 USDC to client address:", client.address);
      // *** FIX: Changed ethers.utils.parseUnits to ethers.parseUnits ***
      await usdc.transfer(client.address, ethers.parseUnits("1000", 6)); 
      console.log("DEBUG: USDC transferred to client successfully.");
    } catch (error) {
      console.error("DEBUG: Error transferring USDC to client:", error);
      throw error;
    }
  });

  // Your original test cases
  it("should deposit USDC", async function () {
    console.log("DEBUG: Running 'should deposit USDC' test.");
    // *** FIX: Changed ethers.utils.parseUnits to ethers.parseUnits ***
    await usdc.connect(client).approve(escrow.target, ethers.parseUnits("100", 6));
    // *** FIX: Changed ethers.utils.parseUnits to ethers.parseUnits ***
    await escrow.connect(client).deposit(freelancer.address, ethers.parseUnits("100", 6));
    // *** FIX: Changed ethers.utils.parseUnits to ethers.parseUnits ***
    expect(await escrow.deposits(freelancer.address)).to.equal(ethers.parseUnits("100", 6));
    console.log("DEBUG: 'should deposit USDC' test completed.");
  });

  it("should release USDC", async function () {
    console.log("DEBUG: Running 'should release USDC' test.");
    // *** FIX: Changed ethers.utils.parseUnits to ethers.parseUnits ***
    await usdc.connect(client).approve(escrow.target, ethers.parseUnits("100", 6));
    // *** FIX: Changed ethers.utils.parseUnits to ethers.parseUnits ***
    await escrow.connect(client).deposit(freelancer.address, ethers.parseUnits("100", 6));
    // *** FIX: Changed ethers.utils.parseUnits to ethers.parseUnits ***
    await escrow.connect(owner).release(freelancer.address, ethers.parseUnits("100", 6));
    // *** FIX: Changed ethers.utils.parseUnits to ethers.parseUnits ***
    expect(await usdc.balanceOf(freelancer.address)).to.equal(ethers.parseUnits("100", 6));
    console.log("DEBUG: 'should release USDC' test completed.");
  });
});
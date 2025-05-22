// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Remove OpenZeppelin imports and inheritance for this test
// import "@openzeppelin/contracts/access/Ownable.sol"; // REMOVE THIS LINE
// import "@openzeppelin/contracts/token/ERC20/IERC20.sol"; // REMOVE THIS LINE

contract TestEscrow { // REMOVE 'is Ownable'
  address public testUsdcAddress; // Change IERC20 to address for simplicity

  // Simplify constructor
  constructor(address _usdc) { // REMOVE 'Ownable(msg.sender)'
    require(_usdc != address(0), "TestEscrow: USDC address cannot be zero"); // Keep this
    testUsdcAddress = _usdc; // Assign to address directly
  }

  // Remove all other functions for this test
  // function deposit(...) ...
  // function release(...) ...
  // function refund(...) ...
}
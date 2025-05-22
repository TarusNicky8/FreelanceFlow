// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Escrow is Ownable {
  IERC20 public usdc;
  mapping(address => uint256) public deposits;

  constructor(address _usdc) Ownable(msg.sender) {
    // --- ADD THIS REQUIRE STATEMENT ---
    require(_usdc != address(0), "Escrow: USDC address cannot be zero");
    // ----------------------------------
    usdc = IERC20(_usdc);
  }

  function deposit(address freelancer, uint256 amount) external {
    require(amount > 0, "Amount must be greater than 0");
    usdc.transferFrom(msg.sender, address(this), amount);
    deposits[freelancer] += amount;
  }

  function release(address freelancer, uint256 amount) external onlyOwner {
    require(deposits[freelancer] >= amount, "Insufficient funds");
    deposits[freelancer] -= amount;
    usdc.transfer(freelancer, amount);
  }

  function refund(address client, uint256 amount) external onlyOwner {
    require(deposits[client] >= amount, "Insufficient funds");
    deposits[client] -= amount;
    usdc.transfer(client, amount);
  }
}
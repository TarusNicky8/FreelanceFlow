// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol"; // <-- New import
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

// This contract is designed to be upgradable and manage platform profits.
// It can receive USDC and allows the owner to withdraw accumulated profits.
contract ProfitFlow is Initializable, OwnableUpgradeable, UUPSUpgradeable { // <-- New inheritance
    // State variable to store the address of the USDC token
    IERC20Upgradeable public usdc;

    // Event emitted when profits are withdrawn by the owner
    event ProfitsWithdrawn(address indexed to, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // Constructor is empty for upgradable contracts using Initializable.
        // Initialization logic goes into the initialize function.
    }

    // The initialize function acts as the constructor for upgradable contracts.
    // It's called only once, immediately after deployment.
    function initialize(address _usdc) public initializer {
        __Ownable_init(); // Initialize the Ownable part of the contract
        __UUPSUpgradeable_init(); // <-- New initialization
        require(_usdc != address(0), "ProfitFlow: USDC address cannot be zero");
        usdc = IERC20Upgradeable(_usdc); // Set the USDC token address
    }

    // This function must be implemented for UUPSUpgradeable.
    // It is called during the upgrade process to authorize the upgrade.
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {} // <-- New function

    // Function to receive USDC tokens as profit.
    // Any external contract or user can send USDC to this contract
    // by calling `usdc.transfer(address(this), amount)` or `usdc.transferFrom(...)`.
    // This function will increase the contract's USDC balance.
    function collectProfit(uint256 amount) external {
        require(amount > 0, "ProfitFlow: Amount must be greater than 0");
        // Transfer USDC from the caller's wallet to this contract
        // This assumes the caller has already approved this contract to spend their USDC.
        usdc.transferFrom(msg.sender, address(this), amount);
    }

    // Function to allow the owner to withdraw all accumulated USDC profits.
    // Only the contract owner can call this function.
    function withdrawProfits() external onlyOwner {
        // Get the current USDC balance held by this contract
        uint256 contractUsdcBalance = usdc.balanceOf(address(this));
        require(contractUsdcBalance > 0, "ProfitFlow: No profits to withdraw");

        // Transfer all USDC from this contract to the owner
        usdc.transfer(owner(), contractUsdcBalance);

        emit ProfitsWithdrawn(owner(), contractUsdcBalance);
    }

    // Optional: A fallback or receive function if you want to allow direct ETH transfers
    // (though for USDC profits, collectProfit is preferred).
    // receive() external payable {
    //      // Handle received ETH if necessary, or revert if not intended
    // }
    // fallback() external payable {
    //      // Handle any other calls, or revert if not intended
    // }
}
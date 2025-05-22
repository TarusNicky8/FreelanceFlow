// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// If you're using SafeMath for other parts or just good practice, you can keep it:
// import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract USDC is ERC20 {
    // using SafeMath for uint256; // Uncomment if you use SafeMath elsewhere

    // This explicitly overrides the default 18 decimals from ERC20
    // and makes this token have 6 decimals.
    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

    constructor() ERC20("USD Coin", "USDC") {
        // Mint 1,000,000 tokens, correctly scaled for 6 decimals.
        // 1,000,000 * (10 ** 6) = 1,000,000,000,000
        // You can use the `decimals()` function here after it's overridden
        // or simply use the literal `6` for the exponent.
        uint256 amountToMint = 1_000_000 * (10**uint256(decimals()));
        // Or simply: uint256 amountToMint = 1_000_000 * (10**6);

        _mint(msg.sender, amountToMint);
    }
}
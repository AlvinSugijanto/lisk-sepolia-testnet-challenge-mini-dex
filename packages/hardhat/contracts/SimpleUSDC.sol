// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title SimpleUSDC
 * @notice A simple ERC20 stablecoin for testing and DEX trading
 * @dev Mimics USDC but with public minting for easy testing
 */
contract SimpleUSDC is ERC20 {
    /**
     * @notice Constructor mints initial supply to deployer
     */
    constructor() ERC20("Simple USDC", "sUSDC") {
        // Mint 1,000,000 USDC to deployer (for initial liquidity and testing)
        _mint(msg.sender, 1_000_000 * 10**decimals());
    }

    /**
     * @notice Public minting function for testing
     * @dev In production, this would be restricted!
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint (in wei, 18 decimals)
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @notice Override decimals to match USDC (6 decimals)
     * @return uint8 Number of decimals (6)
     */
    function decimals() public pure override returns (uint8) {
        return 6; // USDC uses 6 decimals, not 18
    }
}

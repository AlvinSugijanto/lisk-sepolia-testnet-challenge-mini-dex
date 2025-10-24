// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title SimpleDEX
 * @notice A simplified decentralized exchange using constant product AMM (x * y = k)
 * @dev Supports a single token pair with add/remove liquidity and swap functions
 */
contract SimpleDEX is ReentrancyGuard {
    // Token addresses
    IERC20 public immutable tokenA;
    IERC20 public immutable tokenB;

    // Pool reserves
    uint256 public reserveA;
    uint256 public reserveB;

    // Liquidity tracking
    uint256 public totalLiquidity;
    mapping(address => uint256) public liquidity;

    // Fee (0.3% = 3/1000)
    uint256 public constant FEE_NUMERATOR = 3;
    uint256 public constant FEE_DENOMINATOR = 1000;

    // Events
    event LiquidityAdded(
        address indexed provider,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidityMinted
    );
    event LiquidityRemoved(
        address indexed provider,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidityBurned
    );
    event Swap(
        address indexed user,
        address indexed tokenIn,
        uint256 amountIn,
        uint256 amountOut
    );

    /**
     * @notice Constructor sets the token pair
     * @param _tokenA Address of first token
     * @param _tokenB Address of second token
     */
    constructor(address _tokenA, address _tokenB) {
        require(_tokenA != address(0) && _tokenB != address(0), "Invalid token address");
        require(_tokenA != _tokenB, "Tokens must be different");

        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
    }

    /**
     * @notice Add liquidity to the pool
     * @param amountA Amount of token A to add
     * @param amountB Amount of token B to add
     * @return liquidityMinted Amount of liquidity shares minted
     */
    function addLiquidity(uint256 amountA, uint256 amountB)
        external
        nonReentrant
        returns (uint256 liquidityMinted)
    {
        require(amountA > 0 && amountB > 0, "Amounts must be greater than 0");

        // Transfer tokens from user to contract
        tokenA.transferFrom(msg.sender, address(this), amountA);
        tokenB.transferFrom(msg.sender, address(this), amountB);

        // Calculate liquidity to mint
        if (totalLiquidity == 0) {
            // First liquidity provider: liquidity = sqrt(amountA * amountB)
            // We use a simple formula: liquidity = amountA (for simplicity)
            liquidityMinted = amountA;
        } else {
            // Subsequent liquidity: maintain pool ratio
            // liquidityMinted = (amountA / reserveA) * totalLiquidity
            // We take the minimum to prevent manipulation
            uint256 liquidityA = (amountA * totalLiquidity) / reserveA;
            uint256 liquidityB = (amountB * totalLiquidity) / reserveB;
            liquidityMinted = liquidityA < liquidityB ? liquidityA : liquidityB;
        }

        require(liquidityMinted > 0, "Insufficient liquidity minted");

        // Update state
        liquidity[msg.sender] += liquidityMinted;
        totalLiquidity += liquidityMinted;
        reserveA += amountA;
        reserveB += amountB;

        emit LiquidityAdded(msg.sender, amountA, amountB, liquidityMinted);
    }

    /**
     * @notice Remove liquidity from the pool
     * @param liquidityAmount Amount of liquidity shares to burn
     * @return amountA Amount of token A returned
     * @return amountB Amount of token B returned
     */
    function removeLiquidity(uint256 liquidityAmount)
        external
        nonReentrant
        returns (uint256 amountA, uint256 amountB)
    {
        require(liquidityAmount > 0, "Amount must be greater than 0");
        require(liquidity[msg.sender] >= liquidityAmount, "Insufficient liquidity");

        // Calculate amounts to return (proportional to share)
        amountA = (liquidityAmount * reserveA) / totalLiquidity;
        amountB = (liquidityAmount * reserveB) / totalLiquidity;

        require(amountA > 0 && amountB > 0, "Insufficient liquidity burned");

        // Update state
        liquidity[msg.sender] -= liquidityAmount;
        totalLiquidity -= liquidityAmount;
        reserveA -= amountA;
        reserveB -= amountB;

        // Transfer tokens back to user
        tokenA.transfer(msg.sender, amountA);
        tokenB.transfer(msg.sender, amountB);

        emit LiquidityRemoved(msg.sender, amountA, amountB, liquidityAmount);
    }

    /**
     * @notice Swap one token for another
     * @param tokenIn Address of token to swap in
     * @param amountIn Amount of token to swap in
     * @return amountOut Amount of token received
     */
    function swap(address tokenIn, uint256 amountIn)
        external
        nonReentrant
        returns (uint256 amountOut)
    {
        require(amountIn > 0, "Amount must be greater than 0");
        require(
            tokenIn == address(tokenA) || tokenIn == address(tokenB),
            "Invalid token"
        );

        // Determine input/output tokens and reserves
        bool isTokenA = tokenIn == address(tokenA);
        (IERC20 tokenInContract, IERC20 tokenOutContract) = isTokenA
            ? (tokenA, tokenB)
            : (tokenB, tokenA);
        (uint256 reserveIn, uint256 reserveOut) = isTokenA
            ? (reserveA, reserveB)
            : (reserveB, reserveA);

        // Transfer input token from user
        tokenInContract.transferFrom(msg.sender, address(this), amountIn);

        // Calculate output amount with fee
        // Formula: amountOut = (amountIn * reserveOut) / (reserveIn + amountIn)
        // With 0.3% fee: amountIn = amountIn * (1 - 0.003) = amountIn * 997/1000
        uint256 amountInWithFee = amountIn * (FEE_DENOMINATOR - FEE_NUMERATOR);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * FEE_DENOMINATOR) + amountInWithFee;
        amountOut = numerator / denominator;

        require(amountOut > 0, "Insufficient output amount");
        require(amountOut < reserveOut, "Insufficient liquidity");

        // Update reserves
        if (isTokenA) {
            reserveA += amountIn;
            reserveB -= amountOut;
        } else {
            reserveB += amountIn;
            reserveA -= amountOut;
        }

        // Transfer output token to user
        tokenOutContract.transfer(msg.sender, amountOut);

        emit Swap(msg.sender, tokenIn, amountIn, amountOut);
    }

    /**
     * @notice Calculate swap output amount (view function)
     * @param tokenIn Address of token to swap in
     * @param amountIn Amount of token to swap in
     * @return amountOut Estimated amount of token to receive
     */
    function getSwapAmount(address tokenIn, uint256 amountIn)
        external
        view
        returns (uint256 amountOut)
    {
        require(amountIn > 0, "Amount must be greater than 0");
        require(
            tokenIn == address(tokenA) || tokenIn == address(tokenB),
            "Invalid token"
        );

        // Determine reserves
        bool isTokenA = tokenIn == address(tokenA);
        (uint256 reserveIn, uint256 reserveOut) = isTokenA
            ? (reserveA, reserveB)
            : (reserveB, reserveA);

        // Calculate output with fee
        uint256 amountInWithFee = amountIn * (FEE_DENOMINATOR - FEE_NUMERATOR);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * FEE_DENOMINATOR) + amountInWithFee;
        amountOut = numerator / denominator;
    }

    /**
     * @notice Get current pool state
     * @return _reserveA Reserve of token A
     * @return _reserveB Reserve of token B
     * @return _totalLiquidity Total liquidity shares
     */
    function getReserves()
        external
        view
        returns (uint256 _reserveA, uint256 _reserveB, uint256 _totalLiquidity)
    {
        return (reserveA, reserveB, totalLiquidity);
    }

    /**
     * @notice Get user's liquidity position
     * @param user Address to check
     * @return liquidityAmount User's liquidity shares
     * @return sharePercentage User's percentage of pool (in basis points, e.g., 1000 = 10%)
     */
    function getUserLiquidity(address user)
        external
        view
        returns (uint256 liquidityAmount, uint256 sharePercentage)
    {
        liquidityAmount = liquidity[user];
        sharePercentage = totalLiquidity > 0
            ? (liquidityAmount * 10000) / totalLiquidity
            : 0;
    }
}

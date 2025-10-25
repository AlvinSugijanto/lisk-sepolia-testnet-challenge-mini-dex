"use client";

import { useEffect, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { useDeployedContractInfo, useScaffoldContractRead, useScaffoldContractWrite } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

export const LiquidityPanel = () => {
  const { address: connectedAddress } = useAccount();
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [removeAmount, setRemoveAmount] = useState("");
  const [isApprovedA, setIsApprovedA] = useState(false);
  const [isApprovedB, setIsApprovedB] = useState(false);
  const [ratioError, setRatioError] = useState("");

  const { data: dexContract } = useDeployedContractInfo("SimpleDEX");

  // Get reserves
  const { data: reserves } = useScaffoldContractRead({
    contractName: "SimpleDEX",
    functionName: "getReserves",
  });

  const reserveA = reserves?.[0] || 0n;
  const reserveB = reserves?.[1] || 0n;
  const totalLiquidity = reserves?.[2] || 0n;

  // Check if it's first time liquidity
  const isFirstTimeLiquidity = reserveA === 0n && reserveB === 0n;

  // Calculate current pool ratio (only if pool has liquidity)
  const currentRatio = reserveA > 0n && reserveB > 0n ? Number(reserveB) / Number(reserveA) : 1; // Default 1:1 for first time
  const ratioWithDecimals = currentRatio * 10 ** 12; // Adjust for decimals difference (18 vs 6)

  // Get user liquidity
  const { data: userLiquidityData, refetch: refetchUserLiquidity } = useScaffoldContractRead({
    contractName: "SimpleDEX",
    functionName: "getUserLiquidity",
    args: [connectedAddress],
  });

  const userLiquidity = userLiquidityData?.[0] || 0n;
  const userShareBasisPoints = userLiquidityData?.[1] || 0n;
  const userSharePercent = Number(userShareBasisPoints) / 100;

  // Get token balances
  const { data: balanceA } = useScaffoldContractRead({
    contractName: "MyToken",
    functionName: "balanceOf",
    args: [connectedAddress],
  });

  const { data: balanceB } = useScaffoldContractRead({
    contractName: "SimpleUSDC",
    functionName: "balanceOf",
    args: [connectedAddress],
  });

  // Get token symbols
  const { data: symbolA } = useScaffoldContractRead({
    contractName: "MyToken",
    functionName: "symbol",
  });

  const { data: symbolB } = useScaffoldContractRead({
    contractName: "SimpleUSDC",
    functionName: "symbol",
  });

  // Get token decimals
  const { data: decimalsA } = useScaffoldContractRead({
    contractName: "MyToken",
    functionName: "decimals",
  });

  const { data: decimalsB } = useScaffoldContractRead({
    contractName: "SimpleUSDC",
    functionName: "decimals",
  });

  const tokenADecimals = decimalsA || 18;
  const tokenBDecimals = decimalsB || 6;

  // Check approvals
  const { data: allowanceA, refetch: refetchAllowanceA } = useScaffoldContractRead({
    contractName: "MyToken",
    functionName: "allowance",
    args: [connectedAddress, dexContract?.address],
  });

  const { data: allowanceB, refetch: refetchAllowanceB } = useScaffoldContractRead({
    contractName: "SimpleUSDC",
    functionName: "allowance",
    args: [connectedAddress, dexContract?.address],
  });

  // Update approval status and validate ratio
  useEffect(() => {
    if (allowanceA && allowanceB) {
      const amountABN = amountA ? parseUnits(amountA, tokenADecimals) : 0n;
      const amountBBN = amountB ? parseUnits(amountB, tokenBDecimals) : 0n;

      setIsApprovedA(allowanceA >= amountABN);
      setIsApprovedB(allowanceB >= amountBBN);

      // Validate ratio only if pool has liquidity (not first time)
      if (!isFirstTimeLiquidity && amountA && amountB) {
        validateRatio(amountA, amountB);
      }
    } else {
      setRatioError("");
    }
  }, [amountA, amountB, allowanceA, allowanceB, isFirstTimeLiquidity, tokenADecimals, tokenBDecimals]);

  // Function to validate ratio (only for existing pools)
  const validateRatio = (inputA: string, inputB: string) => {
    if (!inputA || !inputB || parseFloat(inputA) <= 0 || parseFloat(inputB) <= 0) {
      setRatioError("");
      return;
    }

    const amountAValue = parseFloat(inputA);
    const amountBValue = parseFloat(inputB);

    // Calculate expected amountB based on pool ratio
    const expectedB = amountAValue * ratioWithDecimals;
    const tolerance = 0.01; // 1% tolerance

    const ratioDifference = Math.abs(amountBValue - expectedB) / expectedB;

    if (ratioDifference > tolerance) {
      setRatioError(`Ratio tidak sesuai! Harusnya ${expectedB.toFixed(4)} ${symbolB} untuk ${amountA} ${symbolA}`);
    } else {
      setRatioError("");
    }
  };

  // Auto-fill amountB when amountA changes
  const handleAmountAChange = (value: string) => {
    setAmountA(value);
    setRatioError(""); // Clear ratio error when user changes input

    if (value) {
      const amountAValue = parseFloat(value);
      if (amountAValue > 0) {
        if (isFirstTimeLiquidity) {
          // For first time: use 1:1 ratio
          setAmountB(value); // Same value for 1:1 ratio
        } else if (reserveA > 0n && reserveB > 0n) {
          // For existing pool: use current ratio
          const calculatedB = amountAValue * ratioWithDecimals;
          setAmountB(calculatedB.toFixed(tokenBDecimals));
        }
      } else {
        setAmountB("");
      }
    } else {
      setAmountB("");
    }
  };

  // Auto-fill amountA when amountB changes
  const handleAmountBChange = (value: string) => {
    setAmountB(value);
    setRatioError(""); // Clear ratio error when user changes input

    if (value) {
      const amountBValue = parseFloat(value);
      if (amountBValue > 0) {
        if (isFirstTimeLiquidity) {
          // For first time: use 1:1 ratio
          setAmountA(value); // Same value for 1:1 ratio
        } else if (reserveA > 0n && reserveB > 0n) {
          // For existing pool: use current ratio
          const calculatedA = amountBValue / ratioWithDecimals;
          setAmountA(calculatedA.toFixed(tokenADecimals));
        }
      } else {
        setAmountA("");
      }
    } else {
      setAmountA("");
    }
  };

  // Approve functions
  const { writeAsync: approveTokenA } = useScaffoldContractWrite({
    contractName: "MyToken",
    functionName: "approve",
    args: [dexContract?.address, amountA ? parseUnits(amountA, tokenADecimals) : 0n],
  });

  const { writeAsync: approveTokenB } = useScaffoldContractWrite({
    contractName: "SimpleUSDC",
    functionName: "approve",
    args: [dexContract?.address, amountB ? parseUnits(amountB, tokenBDecimals) : 0n],
  });

  // Add liquidity
  const { writeAsync: addLiquidity } = useScaffoldContractWrite({
    contractName: "SimpleDEX",
    functionName: "addLiquidity",
    args: [amountA ? parseUnits(amountA, tokenADecimals) : 0n, amountB ? parseUnits(amountB, tokenBDecimals) : 0n],
  });

  // Remove liquidity
  const { writeAsync: removeLiquidity } = useScaffoldContractWrite({
    contractName: "SimpleDEX",
    functionName: "removeLiquidity",
    args: [removeAmount ? parseUnits(removeAmount, 18) : 0n],
  });

  const handleApproveA = async () => {
    try {
      await approveTokenA();
      notification.success("Token A approved!");
      setTimeout(() => refetchAllowanceA(), 2000);
    } catch (error) {
      console.error("Approval failed:", error);
      notification.error("Approval failed");
    }
  };

  const handleApproveB = async () => {
    try {
      await approveTokenB();
      notification.success("Token B approved!");
      setTimeout(() => refetchAllowanceB(), 2000);
    } catch (error) {
      console.error("Approval failed:", error);
      notification.error("Approval failed");
    }
  };

  const handleAddLiquidity = async () => {
    if (!amountA || !amountB || parseFloat(amountA) <= 0 || parseFloat(amountB) <= 0) {
      notification.error("Enter valid amounts");
      return;
    }

    // For existing pools, validate ratio before submitting
    if (!isFirstTimeLiquidity && ratioError) {
      notification.error("Please adjust amounts to match pool ratio");
      return;
    }

    try {
      await addLiquidity();
      notification.success("Liquidity added!");
      setAmountA("");
      setAmountB("");
      setRatioError("");
      setTimeout(() => refetchUserLiquidity(), 2000);
    } catch (error) {
      console.error("Add liquidity failed:", error);
      notification.error("Add liquidity failed");
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!removeAmount || parseFloat(removeAmount) <= 0) {
      notification.error("Enter valid amount");
      return;
    }

    // Check if user has enough liquidity
    const removeAmountBN = parseUnits(removeAmount, 18);
    if (userLiquidity < removeAmountBN) {
      notification.error("Insufficient liquidity");
      return;
    }

    try {
      await removeLiquidity();
      notification.success("Liquidity removed!");
      setRemoveAmount("");
      setTimeout(() => refetchUserLiquidity(), 2000);
    } catch (error) {
      console.error("Remove liquidity failed:", error);
      notification.error("Remove liquidity failed");
    }
  };

  const formatBalance = (balance: bigint | undefined, decimals: number) => {
    if (!balance || balance === 0n) return "0.0";

    try {
      const formatted = formatUnits(balance, decimals);
      const numberValue = parseFloat(formatted);

      if (numberValue === 0) return "0.0";
      if (numberValue >= 1) return numberValue.toFixed(4);
      return formatted;
    } catch (error) {
      console.error("Error formatting balance:", error);
      return "0.0";
    }
  };

  // Calculate expected output for removing liquidity
  const expectedA =
    removeAmount && totalLiquidity > 0n ? (parseUnits(removeAmount, 18) * reserveA) / totalLiquidity : 0n;
  const expectedB =
    removeAmount && totalLiquidity > 0n ? (parseUnits(removeAmount, 18) * reserveB) / totalLiquidity : 0n;

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl">
      {/* Pool Stats */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Pool Statistics</h2>
          <div className="stats stats-vertical lg:stats-horizontal shadow">
            <div className="stat">
              <div className="stat-title">Reserve {symbolA}</div>
              <div className="stat-value text-primary text-2xl">{formatBalance(reserveA, tokenADecimals)}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Reserve {symbolB}</div>
              <div className="stat-value text-secondary text-2xl">{formatBalance(reserveB, tokenBDecimals)}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Your Share</div>
              <div className="stat-value text-accent text-2xl">{userSharePercent.toFixed(2)}%</div>
              <div className="stat-desc">{formatBalance(userLiquidity, 18)} LP tokens</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add Liquidity */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Add Liquidity</h2>

            {/* Token A Input */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">{symbolA} Amount</span>
                <span className="label-text-alt">Balance: {formatBalance(balanceA, tokenADecimals)}</span>
              </label>
              <input
                type="number"
                placeholder="0.0"
                className="input input-bordered"
                value={amountA}
                onChange={e => handleAmountAChange(e.target.value)}
              />
            </div>

            {/* Token B Input */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">{symbolB} Amount</span>
                <span className="label-text-alt">Balance: {formatBalance(balanceB, tokenBDecimals)}</span>
              </label>
              <input
                type="number"
                placeholder="0.0"
                className="input input-bordered"
                value={amountB}
                onChange={e => handleAmountBChange(e.target.value)}
              />
            </div>

            {/* Pool Ratio Info */}
            {!isFirstTimeLiquidity && reserveA > 0n && reserveB > 0n && (
              <div className="alert alert-info">
                <span className="text-xs">
                  Current pool ratio: 1 {symbolA} = {ratioWithDecimals.toFixed(6)} {symbolB}
                </span>
              </div>
            )}

            {/* First Time Pool Creation Info */}
            {isFirstTimeLiquidity && (
              <div className="alert alert-success">
                <span className="text-xs">
                  🎉 Ini adalah liquidity pertama! Anda menentukan rasio awal pool (disarankan 1:1).
                </span>
              </div>
            )}

            {/* Ratio Error */}
            {ratioError && (
              <div className="alert alert-warning">
                <span className="text-xs">{ratioError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="card-actions justify-end mt-4">
              {!isApprovedA && (
                <button className="btn btn-secondary btn-sm" onClick={handleApproveA} disabled={!amountA}>
                  Approve {symbolA}
                </button>
              )}
              {!isApprovedB && (
                <button className="btn btn-secondary btn-sm" onClick={handleApproveB} disabled={!amountB}>
                  Approve {symbolB}
                </button>
              )}
              {isApprovedA && isApprovedB && (
                <button
                  className="btn btn-primary btn-block"
                  onClick={handleAddLiquidity}
                  disabled={!amountA || !amountB || (!isFirstTimeLiquidity && !!ratioError)}
                >
                  {isFirstTimeLiquidity ? "Create Pool" : "Add Liquidity"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Remove Liquidity */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Remove Liquidity</h2>

            {/* LP Token Input */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">LP Token Amount</span>
                <span className="label-text-alt">Available: {formatBalance(userLiquidity, 18)}</span>
              </label>
              <div className="flex justify-end mb-2">
                <button
                  className="btn btn-primary btn-xs px-3"
                  onClick={() => setRemoveAmount(formatBalance(userLiquidity, 18))}
                >
                  Max
                </button>
              </div>
              <input
                type="number"
                placeholder="0.0"
                className="input input-bordered"
                value={removeAmount}
                onChange={e => setRemoveAmount(e.target.value)}
              />
            </div>

            {/* Expected Output */}
            {removeAmount && (
              <div className="alert alert-info">
                <div className="text-xs">
                  <p>You will receive:</p>
                  <p>
                    • {formatBalance(expectedA, tokenADecimals)} {symbolA}
                  </p>
                  <p>
                    • {formatBalance(expectedB, tokenBDecimals)} {symbolB}
                  </p>
                </div>
              </div>
            )}

            {/* Action Button */}
            <div className="card-actions justify-end mt-4">
              <button
                className="btn btn-error btn-block"
                onClick={handleRemoveLiquidity}
                disabled={!removeAmount || parseFloat(removeAmount) <= 0}
              >
                Remove Liquidity
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

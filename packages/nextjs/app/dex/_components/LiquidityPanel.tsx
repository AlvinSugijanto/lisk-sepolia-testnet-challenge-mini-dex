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

  const { data: dexContract } = useDeployedContractInfo("SimpleDEX");

  // Get reserves
  const { data: reserves } = useScaffoldContractRead({
    contractName: "SimpleDEX",
    functionName: "getReserves",
  });

  const reserveA = reserves?.[0] || 0n;
  const reserveB = reserves?.[1] || 0n;
  const totalLiquidity = reserves?.[2] || 0n;

  // Get user liquidity
  const { data: userLiquidityData, refetch: refetchUserLiquidity } = useScaffoldContractRead({
    contractName: "SimpleDEX",
    functionName: "getUserLiquidity",
    args: [connectedAddress],
  });

  const userLiquidity = userLiquidityData?.[0] || 0n;
  const userShareBasisPoints = userLiquidityData?.[1] || 0n;
  const userSharePercent = Number(userShareBasisPoints) / 100; // Convert basis points to percent

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

  // Update approval status
  useEffect(() => {
    if (amountA && amountB && allowanceA && allowanceB) {
      const amountABN = parseUnits(amountA, 18);
      const amountBBN = parseUnits(amountB, 6);
      setIsApprovedA(allowanceA >= amountABN);
      setIsApprovedB(allowanceB >= amountBBN);
    }
  }, [amountA, amountB, allowanceA, allowanceB]);

  // Approve functions
  const { writeAsync: approveTokenA } = useScaffoldContractWrite({
    contractName: "MyToken",
    functionName: "approve",
    args: [dexContract?.address, amountA ? parseUnits(amountA, 18) : 0n],
  });

  const { writeAsync: approveTokenB } = useScaffoldContractWrite({
    contractName: "SimpleUSDC",
    functionName: "approve",
    args: [dexContract?.address, amountB ? parseUnits(amountB, 6) : 0n],
  });

  // Add liquidity
  const { writeAsync: addLiquidity } = useScaffoldContractWrite({
    contractName: "SimpleDEX",
    functionName: "addLiquidity",
    args: [parseUnits(amountA, 18), parseUnits(amountB, 6)],
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

    try {
      await addLiquidity();
      notification.success("Liquidity added!");
      setAmountA("");
      setAmountB("");
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

      // Jika nilai 0, return "0.0"
      if (numberValue === 0) return "0.0";

      // Jika angka >= 1, tampilkan 4 decimals
      if (numberValue >= 1) {
        return numberValue.toFixed(4);
      }

      // Jika angka < 1, tampilkan semua decimals yang ada
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
              <div className="stat-value text-primary text-2xl">{formatBalance(reserveA, 18)}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Reserve {symbolB}</div>
              <div className="stat-value text-secondary text-2xl">{formatBalance(reserveB, 6)}</div>
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
                <span className="label-text-alt">Balance: {formatBalance(balanceA, 18)}</span>
              </label>
              <input
                type="number"
                placeholder="0.0"
                className="input input-bordered"
                value={amountA}
                onChange={e => setAmountA(e.target.value)}
              />
            </div>

            {/* Token B Input */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">{symbolB} Amount</span>
                <span className="label-text-alt">Balance: {formatBalance(balanceB, 6)}</span>
              </label>
              <input
                type="number"
                placeholder="0.0"
                className="input input-bordered"
                value={amountB}
                onChange={e => setAmountB(e.target.value)}
              />
            </div>

            {/* Pool Ratio Info */}
            {reserveA > 0n && reserveB > 0n && (
              <div className="alert alert-info">
                <span className="text-xs">
                  Current pool ratio: 1 {symbolA} ={" "}
                  {(Number(formatUnits(reserveB, 6)) / Number(formatUnits(reserveA, 18))).toFixed(4)} {symbolB}
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="card-actions justify-end mt-4">
              {!isApprovedA && (
                <button className="btn btn-secondary btn-sm" onClick={handleApproveA}>
                  Approve {symbolA}
                </button>
              )}
              {!isApprovedB && (
                <button className="btn btn-secondary btn-sm" onClick={handleApproveB}>
                  Approve {symbolB}
                </button>
              )}
              {isApprovedA && isApprovedB && (
                <button
                  className="btn btn-primary btn-block"
                  onClick={handleAddLiquidity}
                  disabled={!amountA || !amountB}
                >
                  Add Liquidity
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
                {/* PERBAIKAN: Gunakan formatLiquidity di sini juga */}
                <span className="label-text-alt">Available: {formatBalance(userLiquidity, 18)}</span>
              </label>
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
                    • {formatBalance(expectedA, 18)} {symbolA}
                  </p>
                  <p>
                    • {formatBalance(expectedB, 6)} {symbolB}
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

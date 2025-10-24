"use client";

import { useEffect, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { useDeployedContractInfo, useScaffoldContractRead, useScaffoldContractWrite } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

export const SwapPanel = () => {
  const { address: connectedAddress } = useAccount();
  const [inputAmount, setInputAmount] = useState("");
  const [outputAmount, setOutputAmount] = useState("");
  const [isTokenAInput, setIsTokenAInput] = useState(true); // true = MTK->sUSDC, false = sUSDC->MTK
  const [isApprovedA, setIsApprovedA] = useState(false);
  const [isApprovedB, setIsApprovedB] = useState(false);

  const { data: dexContract } = useDeployedContractInfo("SimpleDEX");

  // Get token addresses from DEX contract
  const { data: tokenAAddress } = useScaffoldContractRead({
    contractName: "SimpleDEX",
    functionName: "tokenA",
  });

  const { data: tokenBAddress } = useScaffoldContractRead({
    contractName: "SimpleDEX",
    functionName: "tokenB",
  });

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
    console.log(allowanceA);
    if (inputAmount && allowanceA && allowanceB) {
      const inputAmountBN = parseUnits(inputAmount, isTokenAInput ? 18 : 6);
      setIsApprovedA(allowanceA >= inputAmountBN);
      setIsApprovedB(allowanceB >= inputAmountBN);
    }
  }, [inputAmount, allowanceA, allowanceB, isTokenAInput]);

  // Get swap quote
  const { data: swapQuote } = useScaffoldContractRead({
    contractName: "SimpleDEX",
    functionName: "getSwapAmount",
    args: [
      isTokenAInput ? tokenAAddress : tokenBAddress,
      inputAmount ? parseUnits(inputAmount, isTokenAInput ? 18 : 6) : 0n,
    ],
  });

  // Update output amount when quote changes
  useEffect(() => {
    if (swapQuote) {
      const formatted = formatUnits(swapQuote, isTokenAInput ? 6 : 18);
      setOutputAmount(parseFloat(formatted).toFixed(6));
    } else {
      setOutputAmount("");
    }
  }, [swapQuote, isTokenAInput]);

  // Approve functions
  const { writeAsync: approveTokenA } = useScaffoldContractWrite({
    contractName: "MyToken",
    functionName: "approve",
    args: [dexContract?.address, parseUnits("1000000", 18)], // Approve large amount
  });

  const { writeAsync: approveTokenB } = useScaffoldContractWrite({
    contractName: "SimpleUSDC",
    functionName: "approve",
    args: [dexContract?.address, parseUnits("1000000", 6)], // Approve large amount
  });

  // Swap function
  const { writeAsync: executeSwap } = useScaffoldContractWrite({
    contractName: "SimpleDEX",
    functionName: "swap",
    args: [
      isTokenAInput ? tokenAAddress : tokenBAddress,
      inputAmount ? parseUnits(inputAmount, isTokenAInput ? 18 : 6) : 0n,
    ],
  });

  const handleApprove = async () => {
    try {
      if (isTokenAInput) {
        await approveTokenA();
        notification.success("Token A approved!");
        setTimeout(() => refetchAllowanceA(), 2000);
      } else {
        await approveTokenB();
        notification.success("Token B approved!");
        setTimeout(() => refetchAllowanceB(), 2000);
      }
    } catch (error) {
      console.error("Approval failed:", error);
      notification.error("Approval failed");
    }
  };

  const handleSwap = async () => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      notification.error("Enter a valid amount");
      return;
    }

    try {
      await executeSwap();
      notification.success("Swap successful!");
      setInputAmount("");
      setOutputAmount("");
    } catch (error) {
      console.error("Swap failed:", error);
      notification.error("Swap failed");
    }
  };

  const handleFlipTokens = () => {
    setIsTokenAInput(!isTokenAInput);
    setInputAmount(outputAmount);
    setOutputAmount(inputAmount);
  };

  const formatBalance = (balance: bigint | undefined, decimals: number) => {
    if (!balance) return "0.0";
    return parseFloat(formatUnits(balance, decimals)).toFixed(4);
  };

  const needsApproval = isTokenAInput ? !isApprovedA : !isApprovedB;

  return (
    <div className="card w-full max-w-md bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title justify-center">Swap Tokens</h2>

        {/* Input Token */}
        <div className="form-control">
          <label className="label">
            <span className="label-text">From</span>
            <span className="label-text-alt">
              Balance: {formatBalance(isTokenAInput ? balanceA : balanceB, isTokenAInput ? 18 : 6)}{" "}
              {isTokenAInput ? symbolA : symbolB}
            </span>
          </label>
          <div className="input-group">
            <input
              type="number"
              placeholder="0.0"
              className="input input-bordered w-full"
              value={inputAmount}
              onChange={e => setInputAmount(e.target.value)}
            />
            <span className="btn btn-ghost">{isTokenAInput ? symbolA : symbolB}</span>
          </div>
        </div>

        {/* Flip Button */}
        <div className="flex justify-center">
          <button className="btn btn-circle btn-sm" onClick={handleFlipTokens}>
            ⇅
          </button>
        </div>

        {/* Output Token */}
        <div className="form-control">
          <label className="label">
            <span className="label-text">To</span>
            <span className="label-text-alt">
              Balance: {formatBalance(isTokenAInput ? balanceB : balanceA, isTokenAInput ? 6 : 18)}{" "}
              {isTokenAInput ? symbolB : symbolA}
            </span>
          </label>
          <div className="input-group">
            <input
              type="number"
              placeholder="0.0"
              className="input input-bordered w-full"
              value={outputAmount}
              readOnly
            />
            <span className="btn btn-ghost">{isTokenAInput ? symbolB : symbolA}</span>
          </div>
        </div>

        {/* Exchange Rate */}
        {inputAmount && outputAmount && (
          <div className="alert alert-info">
            <span className="text-sm">
              Rate: 1 {isTokenAInput ? symbolA : symbolB} ≈{" "}
              {(parseFloat(outputAmount) / parseFloat(inputAmount)).toFixed(6)} {isTokenAInput ? symbolB : symbolA}
            </span>
          </div>
        )}

        {/* Action Button */}
        <div className="card-actions justify-end mt-4">
          {needsApproval ? (
            <button className="btn btn-primary btn-block" onClick={handleApprove}>
              Approve {isTokenAInput ? symbolA : symbolB}
            </button>
          ) : (
            <button
              className="btn btn-primary btn-block"
              onClick={handleSwap}
              disabled={!inputAmount || parseFloat(inputAmount) <= 0}
            >
              Swap
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

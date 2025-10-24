"use client";

import { useState } from "react";
import { LiquidityPanel } from "./_components/LiquidityPanel";
import { SwapPanel } from "./_components/SwapPanel";
import type { NextPage } from "next";
import { useAccount } from "wagmi";

const DEX: NextPage = () => {
  const { isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<"swap" | "liquidity">("swap");

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="card w-96 bg-base-100 shadow-xl">
          <div className="card-body text-center">
            <h2 className="card-title justify-center">Simple DEX</h2>
            <p>Please connect your wallet to use the DEX</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-center mb-4">💱 Simple DEX</h1>
        <p className="text-center text-gray-600">
          Swap tokens and provide liquidity using automated market maker (AMM)
        </p>
      </div>

      {/* Tab Selector */}

      <div className="flex justify-center mb-6">
        <div className="tabs tabs-boxed">
          <button
            className={`tab ${activeTab === "swap" ? "bg-base-100 primary-content" : ""}`}
            onClick={() => setActiveTab("swap")}
          >
            💱 Swap
          </button>
          <button
            className={`tab ${activeTab === "liquidity" ? "bg-base-100 primary-content" : ""}`}
            onClick={() => setActiveTab("liquidity")}
          >
            💧 Liquidity
          </button>
        </div>
      </div>

      {/* Panel Content */}
      <div className="flex justify-center">{activeTab === "swap" ? <SwapPanel /> : <LiquidityPanel />}</div>
    </div>
  );
};

export default DEX;

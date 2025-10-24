import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployContracts: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // Deploy MyToken
  await deploy("MyToken", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  // Deploy SimpleUSDC
  await deploy("SimpleUSDC", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });
};

export default deployContracts;
deployContracts.tags = ["MyToken", "SimpleUSDC"];

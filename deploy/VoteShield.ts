import type { DeployFunction } from "hardhat-deploy/types";
import type { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  if (hre.network.name === "localhost") {
    // Ensure the deployer account always has ETH on a local Hardhat node.
    await hre.network.provider.send("hardhat_setBalance", [deployer, "0x3635C9ADC5DEA00000"]);
  }

  const deployed = await deploy("VoteShield", {
    from: deployer,
    log: true,
  });

  console.log(`VoteShield contract:`, deployed.address);
};

export default func;
func.id = "deploy_voteShield";
func.tags = ["VoteShield"];


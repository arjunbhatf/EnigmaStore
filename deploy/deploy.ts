import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedEnigmaStore = await deploy("EnigmaStore", {
    from: deployer,
    log: true,
  });

  console.log(`EnigmaStore contract: `, deployedEnigmaStore.address);
};
export default func;
func.id = "deploy_enigma_store"; // id required to prevent reexecution
func.tags = ["EnigmaStore"];

import { FhevmType } from "@fhevm/hardhat-plugin";
import { randomInt } from "crypto";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

const NINE_DIGIT_MIN = 100_000_000;
const NINE_DIGIT_RANGE = 900_000_000;

function generateNineDigitKey(): number {
  return NINE_DIGIT_MIN + randomInt(NINE_DIGIT_RANGE);
}

function xorBytes(data: Uint8Array, keyBytes: Uint8Array): Uint8Array {
  const output = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 1) {
    output[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  return output;
}

function encryptHash(hash: string, key: number): string {
  const data = Buffer.from(hash, "utf8");
  const keyBytes = Buffer.from(String(key), "utf8");
  const encrypted = xorBytes(data, keyBytes);
  return `0x${Buffer.from(encrypted).toString("hex")}`;
}

function decryptHash(encryptedHash: string, key: number): string {
  const hex = encryptedHash.startsWith("0x") ? encryptedHash.slice(2) : encryptedHash;
  const data = Buffer.from(hex, "hex");
  const keyBytes = Buffer.from(String(key), "utf8");
  const decrypted = xorBytes(data, keyBytes);
  return Buffer.from(decrypted).toString("utf8");
}

task("task:address", "Prints the EnigmaStore address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;
  const deployment = await deployments.get("EnigmaStore");
  console.log("EnigmaStore address is " + deployment.address);
});

task("task:store-file", "Stores a file record in EnigmaStore")
  .addParam("name", "File name to store")
  .addParam("hash", "Plain IPFS hash to encrypt")
  .addOptionalParam("key", "Optional 9-digit key for hash encryption")
  .addOptionalParam("address", "Optionally specify the EnigmaStore contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("EnigmaStore");
    console.log(`EnigmaStore: ${deployment.address}`);

    const signers = await ethers.getSigners();
    const signer = signers[0];

    const parsedKey = taskArguments.key ? parseInt(taskArguments.key, 10) : generateNineDigitKey();
    if (!Number.isFinite(parsedKey) || parsedKey < NINE_DIGIT_MIN || parsedKey >= NINE_DIGIT_MIN + NINE_DIGIT_RANGE) {
      throw new Error("Key must be a 9-digit number");
    }

    const encryptedHash = encryptHash(taskArguments.hash, parsedKey);
    const encryptedInput = await fhevm
      .createEncryptedInput(deployment.address, signer.address)
      .add32(parsedKey)
      .encrypt();

    const contract = await ethers.getContractAt("EnigmaStore", deployment.address);
    const tx = await contract
      .connect(signer)
      .storeFile(taskArguments.name, encryptedHash, encryptedInput.handles[0], encryptedInput.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
    console.log(`Local key (A): ${parsedKey}`);
    console.log(`Encrypted hash: ${encryptedHash}`);
  });

task("task:list-files", "Lists stored file records")
  .addOptionalParam("address", "Optionally specify the EnigmaStore contract address")
  .addOptionalParam("user", "Address to inspect (defaults to first signer)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("EnigmaStore");
    const contract = await ethers.getContractAt("EnigmaStore", deployment.address);

    const signers = await ethers.getSigners();
    const user = taskArguments.user ?? signers[0].address;

    const count = await contract.getFileCount(user);
    console.log(`File count for ${user}: ${count}`);

    for (let i = 0; i < Number(count); i += 1) {
      const record = await contract.getFileInfo(user, i);
      console.log(`- [${i}] name=${record[0]} encryptedHash=${record[1]} encryptedKey=${record[2]} createdAt=${record[3]}`);
    }
  });

task("task:decrypt-file", "Decrypts a file key and reveals the IPFS hash")
  .addParam("index", "File index")
  .addOptionalParam("address", "Optionally specify the EnigmaStore contract address")
  .addOptionalParam("user", "Address to inspect (defaults to first signer)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("EnigmaStore");
    const contract = await ethers.getContractAt("EnigmaStore", deployment.address);

    const signers = await ethers.getSigners();
    const signer = signers[0];
    const user = taskArguments.user ?? signer.address;

    const index = parseInt(taskArguments.index, 10);
    if (!Number.isFinite(index) || index < 0) {
      throw new Error("Index must be a non-negative integer");
    }

    const record = await contract.getFileInfo(user, index);
    const encryptedKey = record[2];
    const encryptedHash = record[1] as string;

    const clearKey = await fhevm.userDecryptEuint(FhevmType.euint32, encryptedKey, deployment.address, signer);
    const decryptedHash = decryptHash(encryptedHash, Number(clearKey));

    console.log(`Decrypted key (A): ${clearKey}`);
    console.log(`Decrypted hash: ${decryptedHash}`);
  });

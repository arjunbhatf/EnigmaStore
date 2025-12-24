import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { EnigmaStore } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  alice: HardhatEthersSigner;
};

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

describe("EnigmaStoreSepolia", function () {
  let signers: Signers;
  let contract: EnigmaStore;
  let contractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const deployment = await deployments.get("EnigmaStore");
      contractAddress = deployment.address;
      contract = await ethers.getContractAt("EnigmaStore", deployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("stores a file record and decrypts the key", async function () {
    steps = 12;
    this.timeout(4 * 40000);

    const fileName = "sepolia-demo.pdf";
    const plainHash = "QmZamaSepoliaHash00000000000000000000000000000000";
    const clearKey = 123_456_789;
    const encryptedHash = encryptHash(plainHash, clearKey);

    progress("Encrypting key...");
    const encryptedInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(clearKey)
      .encrypt();

    progress("Submitting storeFile transaction...");
    const tx = await contract
      .connect(signers.alice)
      .storeFile(fileName, encryptedHash, encryptedInput.handles[0], encryptedInput.inputProof);
    await tx.wait();

    progress("Fetching file count...");
    const count = await contract.getFileCount(signers.alice.address);
    expect(count).to.be.greaterThan(0n);

    const index = Number(count) - 1;
    progress(`Fetching file info for index ${index}...`);
    const record = await contract.getFileInfo(signers.alice.address, index);
    expect(record[0]).to.eq(fileName);
    expect(record[1]).to.eq(encryptedHash);

    progress("Decrypting key...");
    const decryptedKey = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      record[2],
      contractAddress,
      signers.alice,
    );

    progress("Verifying decrypted hash...");
    expect(Number(decryptedKey)).to.eq(clearKey);
    expect(decryptHash(encryptedHash, Number(decryptedKey))).to.eq(plainHash);
  });
});

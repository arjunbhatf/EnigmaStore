import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { EnigmaStore, EnigmaStore__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
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

async function deployFixture() {
  const factory = (await ethers.getContractFactory("EnigmaStore")) as EnigmaStore__factory;
  const contract = (await factory.deploy()) as EnigmaStore;
  const contractAddress = await contract.getAddress();

  return { contract, contractAddress };
}

describe("EnigmaStore", function () {
  let signers: Signers;
  let contract: EnigmaStore;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ contract, contractAddress } = await deployFixture());
  });

  it("returns zero file count after deployment", async function () {
    const count = await contract.getFileCount(signers.alice.address);
    expect(count).to.eq(0n);
  });

  it("stores a file record and decrypts the key", async function () {
    const fileName = "invoice.pdf";
    const plainHash = "QmZamaMockHash0000000000000000000000000000000000";
    const clearKey = 123_456_789;
    const encryptedHash = encryptHash(plainHash, clearKey);

    const encryptedInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(clearKey)
      .encrypt();

    const tx = await contract
      .connect(signers.alice)
      .storeFile(fileName, encryptedHash, encryptedInput.handles[0], encryptedInput.inputProof);
    await tx.wait();

    const count = await contract.getFileCount(signers.alice.address);
    expect(count).to.eq(1n);

    const record = await contract.getFileInfo(signers.alice.address, 0);
    expect(record[0]).to.eq(fileName);
    expect(record[1]).to.eq(encryptedHash);

    const decryptedKey = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      record[2],
      contractAddress,
      signers.alice,
    );

    expect(Number(decryptedKey)).to.eq(clearKey);
    expect(decryptHash(encryptedHash, Number(decryptedKey))).to.eq(plainHash);
  });
});

# EnigmaStore

EnigmaStore is a privacy-first file registry that stores encrypted IPFS pointers on-chain using Zama FHEVM. It lets
users generate a local 9-digit key, encrypt an IPFS hash, and publish the encrypted hash together with an FHE-encrypted
version of the key. Only the wallet owner can later decrypt the key and reveal the hash.

## Why EnigmaStore

Traditional on-chain file registries expose IPFS hashes in plaintext, which reveals access points to off-chain data.
EnigmaStore solves this by keeping the IPFS hash encrypted at rest, while still preserving on-chain auditability and
user-controlled access.

## Advantages

- Privacy by default: raw IPFS hashes never hit the chain.
- User-controlled disclosure: only the owner can decrypt the key and reveal the hash.
- Auditable storage: file records, timestamps, and activity are verifiable on-chain.
- Simple client model: the UI handles encryption locally; no custodial servers or key escrow.
- Clear separation: file content stays off-chain; only metadata is stored on-chain.

## What Gets Stored On-Chain

Each file record contains:

- `fileName`: plaintext name supplied by the user.
- `encryptedHash`: XOR-encrypted IPFS hash (hex string).
- `encryptedKey`: Zama FHE-encrypted 9-digit key (`euint32`).
- `createdAt`: block timestamp at storage time.

## End-to-End Flow

1. User selects a local file in the UI.
2. The app performs a mock IPFS upload and returns a randomized `Qm...` hash.
3. A 9-digit key `A` is generated in the browser.
4. The IPFS hash is encrypted with `A` locally (XOR).
5. `A` is FHE-encrypted using the Zama relayer and sent on-chain.
6. The contract stores `fileName`, `encryptedHash`, and `encryptedKey`.
7. When the user clicks decrypt, the relayer returns `A`, and the hash is decrypted locally.

## Architecture

- Smart contract (`contracts/EnigmaStore.sol`)
  - Stores file records by owner address.
  - Uses Zama FHE types (`euint32`) for encrypted keys.
- Frontend (`src/`)
  - React + Vite UI for upload, encryption, and decryption.
  - Reads on-chain data with `viem`/`wagmi` and writes with `ethers`.
  - Integrates the Zama relayer SDK for encryption/decryption workflows.
- Mock IPFS layer (`src/src/utils/ipfs.ts`)
  - Generates randomized Base58 hashes for development flow.

## Tech Stack

- Solidity + Hardhat + hardhat-deploy
- Zama FHEVM (`@fhevm/solidity`) and relayer SDK (`@zama-fhe/relayer-sdk`)
- React + Vite
- viem + wagmi + RainbowKit
- ethers (transaction signing and contract writes)

## Repository Layout

```
contracts/                 Smart contracts
deploy/                    Deployment scripts
tasks/                     Hardhat tasks
test/                      Contract tests
docs/                      Zama references
src/                       Frontend (React + Vite)
deployments/sepolia/        ABI outputs for Sepolia
```

## Prerequisites

- Node.js 20+
- npm 7+
- A wallet with Sepolia ETH

## Install

1. Install contract dependencies from the repo root:

   ```bash
   npm install
   ```

2. Install frontend dependencies:

   ```bash
   cd src
   npm install
   ```

## Contract Configuration

Create a `.env` file in the repo root with:

```
INFURA_API_KEY=your_infura_key
PRIVATE_KEY=your_wallet_private_key
```

Notes:
- Deployments must use `PRIVATE_KEY` (no mnemonic).
- The Hardhat config reads `process.env.INFURA_API_KEY` and `process.env.PRIVATE_KEY`.

## Contract Workflow

1. Compile and run tests:

   ```bash
   npm run compile
   npm run test
   ```

2. Run Hardhat tasks as needed (see `tasks/`).

3. Deploy to Sepolia:

   ```bash
   npm run deploy:sepolia
   ```

4. (Optional) Verify on Sepolia:

   ```bash
   npm run verify:sepolia -- <CONTRACT_ADDRESS>
   ```

## Frontend Configuration

After deployment, update the frontend contract info:

- Update the address and ABI in `src/src/config/contracts.ts`.
- The ABI must be copied from `deployments/sepolia/EnigmaStore.json`.
- The frontend does not use environment variables or JSON imports for ABI.

## Run the Frontend

```bash
cd src
npm run dev
```

Open the UI, connect a wallet on Sepolia, and follow the upload/encrypt flow.

## Usage Walkthrough

1. Connect your wallet.
2. Select a local file.
3. Click "Mock IPFS Upload" to generate a hash.
4. Click "Encrypt & Store" to publish encrypted metadata on-chain.
5. Open the "Your vault" section.
6. Click "Decrypt key & reveal hash" to recover the IPFS hash.

## Security and Privacy Notes

- The IPFS hash is encrypted locally before it is stored.
- Only the encrypted key is stored on-chain; clear keys never leave the browser.
- File names are plaintext on-chain; do not upload sensitive names.
- The mock IPFS layer is for development only and should be replaced for production.

## Limitations

- IPFS uploads are mocked; no file content is stored or pinned.
- On-chain data is public except for FHE-protected fields.
- Decryption requires the Zama relayer workflow and wallet signature.

## Future Roadmap

- Replace mock uploads with a real IPFS pinning service.
- Support encrypted file names and metadata.
- Add sharing workflows with time-bound or role-based access.
- Add pagination and indexing for large vaults.
- Add multi-chain deployments beyond Sepolia.
- Add download helpers and integrity checks for retrieved files.

## License

BSD-3-Clause-Clear. See `LICENSE`.

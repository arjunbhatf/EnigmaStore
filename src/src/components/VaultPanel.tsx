import { useEffect, useMemo, useState } from 'react';
import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI, ZERO_ADDRESS } from '../config/contracts';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { decryptHash } from '../utils/crypto';

type VaultPanelProps = {
  refreshNonce: number;
};

type FileRecord = {
  index: number;
  fileName: string;
  encryptedHash: string;
  encryptedKey: `0x${string}`;
  createdAt: bigint;
};

function formatDate(timestamp: bigint) {
  if (!timestamp) return 'Unknown time';
  const millis = Number(timestamp) * 1000;
  return new Date(millis).toLocaleString();
}

function FileCard({ record }: { record: FileRecord }) {
  const { address } = useAccount();
  const { instance } = useZamaInstance();
  const signerPromise = useEthersSigner();
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedKey, setDecryptedKey] = useState<number | null>(null);
  const [decryptedHash, setDecryptedHash] = useState('');
  const [error, setError] = useState('');

  const handleDecrypt = async () => {
    if (!address || !instance || !signerPromise) {
      setError('Connect your wallet and wait for the encryption service.');
      return;
    }

    setError('');
    setIsDecrypting(true);

    try {
      const keypair = instance.generateKeypair();
      const handleContractPairs = [
        {
          handle: record.encryptedKey,
          contractAddress: CONTRACT_ADDRESS,
        },
      ];

      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [CONTRACT_ADDRESS];

      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Wallet signer is unavailable.');
      }

      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays,
      );

      const clearValue = result[record.encryptedKey as string];
      const clearNumber = typeof clearValue === 'bigint' ? Number(clearValue) : Number(clearValue);
      if (!Number.isFinite(clearNumber)) {
        throw new Error('Failed to decode decrypted key.');
      }

      setDecryptedKey(clearNumber);
      setDecryptedHash(decryptHash(record.encryptedHash, clearNumber));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decryption failed.');
    } finally {
      setIsDecrypting(false);
    }
  };

  return (
    <div className="file-card">
      <div className="file-card-header">
        <div>
          <h4>{record.fileName}</h4>
          <p>{formatDate(record.createdAt)}</p>
        </div>
        <span className="file-index">#{record.index + 1}</span>
      </div>

      <div className="file-card-body">
        <div className="hash-row">
          <span>Encrypted hash</span>
          <code>{record.encryptedHash.slice(0, 22)}...</code>
        </div>

        {decryptedHash ? (
          <div className="decrypted-box">
            <div>
              <span>Decrypted key (A)</span>
              <strong>{decryptedKey}</strong>
            </div>
            <div>
              <span>IPFS hash</span>
              <code>{decryptedHash}</code>
            </div>
            <a
              className="ghost-button"
              href={`https://ipfs.io/ipfs/${decryptedHash}`}
              target="_blank"
              rel="noreferrer"
            >
              Open on IPFS
            </a>
          </div>
        ) : (
          <button className="primary-button" onClick={handleDecrypt} disabled={isDecrypting}>
            {isDecrypting ? 'Decrypting...' : 'Decrypt key & reveal hash'}
          </button>
        )}

        {error && <p className="error-line">⚠️ {error}</p>}
      </div>
    </div>
  );
}

export function VaultPanel({ refreshNonce }: VaultPanelProps) {
  const { address } = useAccount();
  const contractReady = CONTRACT_ADDRESS !== ZERO_ADDRESS;
  const {
    data: fileCount,
    isLoading: countLoading,
    refetch: refetchCount,
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getFileCount',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contractReady,
    },
  });

  useEffect(() => {
    if (address && contractReady) {
      refetchCount();
    }
  }, [address, contractReady, refreshNonce, refetchCount]);

  const total = Number(fileCount ?? 0);

  const contracts = useMemo(() => {
    if (!address || !contractReady || total === 0) return [];
    return Array.from({ length: total }, (_, index) => ({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'getFileInfo',
      args: [address, BigInt(index)],
    }));
  }, [address, contractReady, total]);

  const { data: fileData, isLoading: fileLoading } = useReadContracts({
    contracts,
    query: {
      enabled: contracts.length > 0,
    },
  });

  const records = useMemo<FileRecord[]>(() => {
    if (!fileData) return [];
    return fileData
      .map((entry, index) => {
        const result = entry.result as readonly [string, string, `0x${string}`, bigint] | undefined;
        if (!result) {
          return null;
        }
        return {
          index,
          fileName: result[0],
          encryptedHash: result[1],
          encryptedKey: result[2],
          createdAt: result[3],
        };
      })
      .filter((record): record is FileRecord => record !== null);
  }, [fileData]);

  return (
    <div className="panel vault-panel">
      <div className="panel-header">
        <div>
          <h3>Your vault</h3>
          <p>Decrypt only when you need to reveal the stored hash.</p>
        </div>
        <span className="panel-badge">Vault</span>
      </div>

      <div className="panel-body">
        {!address && <p className="hint-text">Connect your wallet to see your stored files.</p>}
        {address && !contractReady && (
          <p className="error-line">⚠️ Update the EnigmaStore contract address to load your vault.</p>
        )}
        {address && countLoading && <p className="hint-text">Loading vault count...</p>}
        {address && !countLoading && total === 0 && (
          <div className="empty-state">
            <p>No files stored yet.</p>
            <span>Upload a file to create your first encrypted record.</span>
          </div>
        )}
        {address && total > 0 && (
          <div className="vault-list">
            {fileLoading && <p className="hint-text">Syncing records...</p>}
            {records.map((record) => (
              <FileCard key={`${record.encryptedKey}-${record.index}`} record={record} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

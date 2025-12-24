import { useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { Contract, isAddress } from 'ethers';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CONTRACT_ADDRESS, CONTRACT_ABI, ZERO_ADDRESS } from '../config/contracts';
import { encryptHash, generateNineDigitKey } from '../utils/crypto';
import { formatBytes, mockIpfsUpload } from '../utils/ipfs';

type UploadPanelProps = {
  onStored: () => void;
};

type Phase = 'idle' | 'uploading' | 'encrypting' | 'signing' | 'confirming' | 'done';

export function UploadPanel({ onStored }: UploadPanelProps) {
  const { address } = useAccount();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();
  const signerPromise = useEthersSigner();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ipfsHash, setIpfsHash] = useState('');
  const [encryptedHash, setEncryptedHash] = useState('');
  const [localKey, setLocalKey] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
  const isBusy =
    phase === 'uploading' ||
    phase === 'encrypting' ||
    phase === 'signing' ||
    phase === 'confirming' ||
    phase === 'done';

  const resetPanel = () => {
    setSelectedFile(null);
    setIpfsHash('');
    setEncryptedHash('');
    setLocalKey(null);
    setPhase('idle');
    setStatusMessage('');
    setTxHash('');
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError('');
    setTxHash('');
    setPhase('idle');
    setStatusMessage('');

    if (!file) {
      setSelectedFile(null);
      setIpfsHash('');
      setEncryptedHash('');
      setLocalKey(null);
      return;
    }

    setSelectedFile(file);
    setIpfsHash('');
    setEncryptedHash('');
    setLocalKey(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Select a file before uploading.');
      return;
    }

    setError('');
    setPhase('uploading');
    setStatusMessage('Sealing your file into a mock IPFS capsule...');

    try {
      const result = await mockIpfsUpload(selectedFile);
      setIpfsHash(result.hash);
      setStatusMessage('Mock IPFS hash ready.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mock upload failed.');
      setStatusMessage('');
    } finally {
      setPhase('idle');
    }
  };

  const handleStore = async () => {
    if (!selectedFile || !ipfsHash) {
      setError('Upload to IPFS before storing on-chain.');
      return;
    }
    if (!address) {
      setError('Connect your wallet to continue.');
      return;
    }
    if (!instance || !signerPromise || zamaLoading) {
      setError('Encryption service is not ready yet.');
      return;
    }
    if (!isAddress(CONTRACT_ADDRESS) || CONTRACT_ADDRESS === ZERO_ADDRESS) {
      setError('Contract address is invalid.');
      return;
    }

    setError('');
    setPhase('encrypting');
    setStatusMessage('Generating a 9-digit key and encrypting the hash...');

    try {
      const key = generateNineDigitKey();
      const cipherHash = encryptHash(ipfsHash, key);
      setLocalKey(key);
      setEncryptedHash(cipherHash);

      const input = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
      input.add32(key);
      const encryptedInput = await input.encrypt();

      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Wallet signer is unavailable.');
      }

      setPhase('signing');
      setStatusMessage('Sending transaction to EnigmaStore...');

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.storeFile(
        selectedFile.name,
        cipherHash,
        encryptedInput.handles[0],
        encryptedInput.inputProof,
      );

      setTxHash(tx.hash);
      setPhase('confirming');
      setStatusMessage('Waiting for confirmation...');

      await tx.wait();
      setPhase('done');
      setStatusMessage('Stored on-chain. Your key stays encrypted.');
      onStored();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to store file.');
      setStatusMessage('');
      setPhase('idle');
    }
  };

  return (
    <div className="panel upload-panel">
      <div className="panel-header">
        <div>
          <h3>Seal a file</h3>
          <p>Pick a file, mint a hash, encrypt the key, and publish the encrypted proof.</p>
        </div>
        <span className="panel-badge">Upload</span>
      </div>

      <div className="panel-body">
        <label className="field-label" htmlFor="file-input">
          Local file
        </label>
        <input
          id="file-input"
          ref={fileInputRef}
          type="file"
          className="file-input"
          onChange={handleFileChange}
        />

        {selectedFile ? (
          <div className="file-summary">
            <div>
              <strong>{selectedFile.name}</strong>
              <span>{formatBytes(selectedFile.size)}</span>
            </div>
            <span className="file-tag">{selectedFile.type || 'unknown type'}</span>
          </div>
        ) : (
          <p className="hint-text">Choose a file to start the workflow.</p>
        )}

        <div className="action-row">
          <button
            className="ghost-button"
            onClick={handleUpload}
            disabled={!selectedFile || isBusy}
          >
            {phase === 'uploading' ? 'Uploading...' : 'Mock IPFS Upload'}
          </button>
          <button
            className="primary-button"
            onClick={handleStore}
            disabled={!selectedFile || !ipfsHash || isBusy || zamaLoading}
          >
            {phase === 'confirming' ? 'Confirming...' : 'Encrypt & Store'}
          </button>
        </div>

        {statusMessage && <p className="status-line">{statusMessage}</p>}
        {error && <p className="error-line">⚠️ {error}</p>}
        {zamaError && <p className="error-line">⚠️ {zamaError}</p>}

        {ipfsHash && (
          <div className="result-card">
            <div>
              <p className="result-label">Mock IPFS hash</p>
              <code>{ipfsHash}</code>
            </div>
            <span className="result-pill">Ready</span>
          </div>
        )}

        {phase === 'done' && (
          <div className="success-card">
            <div>
              <p className="result-label">Encrypted payload stored</p>
              <p className="small-text">Your 9-digit key stays encrypted on-chain.</p>
            </div>
            <div className="success-details">
              <div>
                <span>Local key (A)</span>
                <strong>{localKey}</strong>
              </div>
              <div>
                <span>Encrypted hash</span>
                <code>{encryptedHash.slice(0, 26)}...</code>
              </div>
            </div>
            {txHash && (
              <a
                className="tx-link"
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                View transaction
              </a>
            )}
            <button className="ghost-button" onClick={resetPanel}>
              Store another file
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

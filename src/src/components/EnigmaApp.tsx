import { useState } from 'react';
import { Header } from './Header';
import { UploadPanel } from './UploadPanel';
import { VaultPanel } from './VaultPanel';
import '../styles/EnigmaApp.css';

export function EnigmaApp() {
  const [refreshNonce, setRefreshNonce] = useState(0);

  const handleStored = () => {
    setRefreshNonce((value) => value + 1);
  };

  return (
    <div className="enigma-app">
      <Header />
      <section className="hero">
        <div className="hero-copy">
          <p className="hero-kicker">Encrypted file registry</p>
          <h2>Seal a file hash, keep the key in the dark, reveal only when you decide.</h2>
          <p className="hero-subtitle">
            Upload locally, mint a random 9-digit key, and store the encrypted proof on-chain with Zama FHE.
          </p>
        </div>
        <div className="hero-metrics">
          <div className="metric-card">
            <span>Step 1</span>
            <strong>Mock IPFS</strong>
            <p>Generate a random hash for your local file.</p>
          </div>
          <div className="metric-card">
            <span>Step 2</span>
            <strong>Encrypt Key</strong>
            <p>Protect the 9-digit key with FHE.</p>
          </div>
          <div className="metric-card">
            <span>Step 3</span>
            <strong>Reveal Later</strong>
            <p>Decrypt on demand to recover the hash.</p>
          </div>
        </div>
      </section>
      <section className="workspace">
        <UploadPanel onStored={handleStored} />
        <VaultPanel refreshNonce={refreshNonce} />
      </section>
    </div>
  );
}

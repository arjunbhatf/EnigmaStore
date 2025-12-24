import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-left">
            <div className="logo-mark">E</div>
            <div>
              <h1 className="header-title">EnigmaStore</h1>
              <p className="header-subtitle">Encrypted file receipts with user-controlled keys</p>
            </div>
          </div>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}

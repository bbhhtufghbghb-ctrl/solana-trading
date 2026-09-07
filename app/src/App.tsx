```typescript
import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { Toaster } from 'react-hot-toast';
import { SwapForm } from './components/SwapForm';
import { ReferralDashboard } from './components/ReferralDashboard';
import '@solana/wallet-adapter-react-ui/styles.css';

export const App: React.FC = () => {
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="app">
            <Toaster position="top-right" />
            
            <header className="app-header">
              <h1>DEX Aggregator</h1>
              <p>Swap tokens with referral rewards</p>
              <WalletMultiButton />
            </header>

            <main className="app-main">
              <div className="container">
                <div className="grid">
                  <div className="swap-section">
                    <SwapForm />
                  </div>
                  <div className="referral-section">
                    <ReferralDashboard />
                  </div>
                </div>
              </div>
            </main>

            <footer className="app-footer">
              <p>Powered by Solana | DEX Aggregator with Referral Monetization</p>
            </footer>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>

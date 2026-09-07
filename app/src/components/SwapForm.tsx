```typescript
import React, { useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useSwap } from '../hooks/useSwap';
import { useReferral } from '../hooks/useReferral';

interface Token {
  symbol: string;
  mint: string;
  decimals: number;
  logoURI: string;
}

const TOKENS: Token[] = [
  {
    symbol: 'SOL',
    mint: 'So11111111111111111111111111111111111111112',
    decimals: 9,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  },
  {
    symbol: 'USDC',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  },
  {
    symbol: 'USDT',
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png',
  },
];

export const SwapForm: React.FC = () => {
  const { connection } = useConnection();
  const { loading, getQuote, executeSwap, quote } = useSwap(connection);
  const { referralCode, trackReferral } = useReferral(connection);
  
  const [fromToken, setFromToken] = useState<Token>(TOKENS[0]);
  const [toToken, setToToken] = useState<Token>(TOKENS[1]);
  const [amount, setAmount] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(50); // 0.5%

  const handleSwap = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      const amountInLamports = parseFloat(amount) * Math.pow(10, fromToken.decimals);
      const newQuote = await getQuote(
        fromToken.mint,
        toToken.mint,
        amountInLamports,
        slippage
      );

      if (newQuote) {
        await executeSwap(newQuote, referralCode);
        
        // Track referral if applicable
        if (referralCode) {
          // You would need user's public key here
          // await trackReferral(userPublicKey);
        }
      }
    } catch (error) {
      console.error('Swap failed:', error);
    }
  };

  return (
    <div className="swap-form">
      <h2>Swap Tokens</h2>
      
      <div className="token-input">
        <label>From</label>
        <select
          value={fromToken.mint}
          onChange={(e) => setFromToken(TOKENS.find(t => t.mint === e.target.value)!)}
        >
          {TOKENS.map(token => (
            <option key={token.mint} value={token.mint}>
              {token.symbol}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`Amount in ${fromToken.symbol}`}
          min="0"
          step="any"
        />
      </div>

      <div className="token-input">
        <label>To</label>
        <select
          value={toToken.mint}
          onChange={(e) => setToToken(TOKENS.find(t => t.mint === e.target.value)!)}
        >
          {TOKENS.map(token => (
            <option key={token.mint} value={token.mint}>
              {token.symbol}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={quote?.expectedOutput || ''}
          placeholder={`Amount in ${toToken.symbol}`}
          readOnly
        />
      </div>

      <div className="slippage-settings">
        <label>Slippage Tolerance</label>
        <select value={slippage} onChange={(e) => setSlippage(parseInt(e.target.value))}>
          <option value={10}>0.1%</option>
          <option value={50}>0.5%</option>
          <option value={100}>1.0%</option>
          <option value={200}>2.0%</option>
        </select>
      </div>

      {quote && (
        <div className="quote-details">
          <p>Price Impact: {quote.priceImpactPct.toFixed(2)}%</p>
          <p>Fee: {(quote.amount * 0.003).toFixed(2)} {fromToken.symbol}</p>
          {referralCode && (
            <p className="referral-applied">
              Referral Applied: {referralCode}
            </p>
          )}
        </div>
      )}

      <button 
        onClick={handleSwap} 
        disabled={loading || !amount}
        className="swap-button"
      >
        {loading ? 'Swapping...' : 'Swap'}
      </button>
    </div>
  );
};
```

app/src/components/ReferralDashboard.tsx

```typescript
import React, { useState, useEffect } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useReferral } from '../hooks/useReferral';
import { StatsCard } from './StatsCard';
import toast from 'react-hot-toast';

export const ReferralDashboard: React.FC = () => {
  const { connection } = useConnection();
  const {
    referralCode,
    stats,
    loading,
    registerReferrer,
    fetchStats,
    generateLink,
    withdrawEarnings,
  } = useReferral(connection);

  const [newReferralCode, setNewReferralCode] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [referralLink, setReferralLink] = useState('');

  useEffect(() => {
    if (referralCode) {
      fetchStats();
      const baseUrl = window.location.origin;
      setReferralLink(generateLink(baseUrl));
    }
  }, [referralCode, fetchStats, generateLink]);

  const handleRegister = async () => {
    if (!newReferralCode || newReferralCode.length < 3) {
      toast.error('Referral code must be at least 3 characters');
      return;
    }
    await registerReferrer(newReferralCode);
    setNewReferralCode('');
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    // You need to provide the token account for withdrawal
    // This is a placeholder
    const tokenAccount = null;
    if (tokenAccount) {
      await withdrawEarnings(parseFloat(withdrawAmount), tokenAccount);
      setWithdrawAmount('');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="referral-dashboard">
      <h2>Referral Dashboard</h2>

      {!referralCode ? (
        <div className="register-referrer">
          <h3>Become a Referrer</h3>
          <p>Register to start earning rewards from referrals</p>
          <input
            type="text"
            value={newReferralCode}
            onChange={(e) => setNewReferralCode(e.target.value)}
            placeholder="Enter referral code (min 3 characters)"
            maxLength={32}
          />
          <button onClick={handleRegister} disabled={loading}>
            {loading ? 'Registering...' : 'Register as Referrer'}
          </button>
        </div>
      ) : (
        <>
          <div className="referral-link-section">
            <h3>Your Referral Link</h3>
            <div className="referral-link">
              <input
                type="text"
                value={referralLink}
                readOnly
              />
              <button onClick={() => copyToClipboard(referralLink)}>
                Copy Link
              </button>
            </div>
            <p className="referral-code">Code: {referralCode}</p>
          </div>

          {stats && (
            <div className="stats-grid">
              <StatsCard
                title="Total Referrals"
                value={stats.totalReferred.toString()}
                icon="👥"
              />
              <StatsCard
                title="Total Earnings"
                value={`${stats.totalEarnings.toFixed(2)} SOL`}
                icon="💰"
              />
              <StatsCard
                title="Total Swaps"
                value={stats.totalSwaps.toString()}
                icon="🔄"
              />
              <StatsCard
                title="Total Volume"
                value={`$${stats.totalVolume.toFixed(2)}`}
                icon="📊"
              />
            </div>
          )}

          <div className="withdraw-section">
            <h3>Withdraw Earnings</h3>
            <div className="withdraw-form">
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Amount to withdraw"
                min="0"
                step="any"
              />
              <button onClick={handleWithdraw} disabled={loading}>
                {loading ? 'Withdrawing...' : 'Withdraw'}
              </button>
            </div>
            {stats && (
              <p className="available-balance">
                Available: {stats.totalEarnings.toFixed(2)} SOL
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};
```

app/src/components/StatsCard.tsx

```typescript
import React from 'react';

interface StatsCardProps {
  title: string;
  value: string;
  icon: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon }) => {
  return (
    <div className="stats-card">
      <div className="stats-icon">{icon}</div>
      <div className="stats-info">
        <h4>{title}</h4>
        <p>{value}</p>
      </div>
    </div>

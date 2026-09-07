```typescript
import { useState, useCallback } from 'react';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { DEXAggregator, SwapQuote, SwapResult } from '../utils/dexAggregator';
import toast from 'react-hot-toast';

export function useSwap(connection: Connection) {
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [dexAggregator] = useState(() => new DEXAggregator(connection));

  const getQuote = useCallback(async (
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 50
  ) => {
    setLoading(true);
    try {
      const newQuote = await dexAggregator.getQuote(
        inputMint,
        outputMint,
        amount,
        slippageBps
      );
      setQuote(newQuote);
      return newQuote;
    } catch (error) {
      toast.error('Failed to get quote');
      console.error(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [dexAggregator]);

  const executeSwap = useCallback(async (
    quote: SwapQuote,
    referralCode?: string
  ): Promise<string> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      toast.error('Wallet not connected');
      throw new Error('Wallet not connected');
    }

    setLoading(true);
    try {
      const swapResult = await dexAggregator.buildSwapTransaction(
        quote,
        wallet.publicKey,
        referralCode
      );

      const signature = await dexAggregator.executeSwap(
        swapResult,
        wallet.signTransaction
      );

      toast.success('Swap executed successfully!');
      return signature;
    } catch (error) {
      toast.error('Failed to execute swap');
      console.error(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [dexAggregator, wallet]);

  return {
    loading,
    quote,
    getQuote,
    executeSwap,

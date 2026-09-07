```typescript
import { useState, useEffect, useCallback } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { ReferralManager, ReferralStats } from '../utils/referral';
import toast from 'react-hot-toast';

export function useReferral(connection: Connection) {
  const wallet = useWallet();
  const [referralManager, setReferralManager] = useState<ReferralManager | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState<string>('');

  useEffect(() => {
    if (connection && wallet.connected) {
      const manager = new ReferralManager(connection, wallet);
      setReferralManager(manager);
    }
  }, [connection, wallet]);

  useEffect(() => {
    // Parse referral code from URL
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
      setReferralCode(refCode);
    }
  }, []);

  const registerReferrer = useCallback(async (code: string) => {
    if (!referralManager) return;
    
    setLoading(true);
    try {
      const tx = await referralManager.registerReferrer(code);
      toast.success('Successfully registered as referrer!');
      setReferralCode(code);
      return tx;
    } catch (error) {
      toast.error('Failed to register as referrer');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [referralManager]);

  const trackReferral = useCallback(async (userPublicKey: PublicKey) => {
    if (!referralManager || !referralCode) return;
    
    try {
      await referralManager.trackReferral(referralCode, userPublicKey);
      toast.success('Referral tracked successfully!');
    } catch (error) {
      toast.error('Failed to track referral');
      console.error(error);
    }
  }, [referralManager, referralCode]);

  const fetchStats = useCallback(async () => {
    if (!referralManager || !wallet.publicKey) return;
    
    setLoading(true);
    try {
      const referralStats = await referralManager.getReferrerStats(wallet.publicKey);
      setStats(referralStats);
    } catch (error) {
      toast.error('Failed to fetch referral stats');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [referralManager, wallet.publicKey]);

  const withdrawEarnings = useCallback(async (amount: number, tokenAccount: PublicKey) => {
    if (!referralManager) return;
    
    setLoading(true);
    try {
      const tx = await referralManager.withdrawEarnings(amount, tokenAccount);
      toast.success('Earnings withdrawn successfully!');
      await fetchStats();
      return tx;
    } catch (error) {
      toast.error('Failed to withdraw earnings');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [referralManager, fetchStats]);

  const generateLink = useCallback((baseUrl: string) => {
    if (!referralManager || !referralCode) return '';
    return referralManager.generateReferralLink(baseUrl, referralCode);
  }, [referralManager, referralCode]);

  return {
    referralCode,
    stats,
    loading,
    registerReferrer,
    trackReferral,
    fetchStats,
    withdrawEarnings,
    generateLink,

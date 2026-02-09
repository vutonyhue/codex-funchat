import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

export interface ReferralCode {
  code: string;
  uses_count: number;
  max_uses: number;
  is_active: boolean;
  share_url: string;
}

export function useReferral() {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState<ReferralCode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getReferralCode = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.rewards.getReferralCode();

      if (!res.ok || !res.data) {
        setError(res.error?.message || 'Failed to get referral code');
        return null;
      }

      const code = (res.data as any).code as string;
      const shareUrl = `${window.location.origin}/auth?ref=${encodeURIComponent(code)}`;

      const mapped: ReferralCode = {
        code,
        uses_count: (res.data as any).uses_count ?? 0,
        max_uses: (res.data as any).max_uses ?? 0,
        is_active: (res.data as any).is_active ?? true,
        share_url: shareUrl,
      };

      setReferralCode(mapped);
      return mapped;
    } catch (err) {
      console.error('Error getting referral code:', err);
      setError('Failed to get referral code');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const useReferralCode = useCallback(async (code: string) => {
    try {
      const res = await api.rewards.useReferralCode(code);
      if (!res.ok) {
        return { success: false, error: res.error?.message || 'Failed to use referral code' };
      }
      return { success: true };
    } catch (err) {
      console.error('Error using referral code:', err);
      return { success: false, error: 'Failed to use referral code' };
    }
  }, []);

  const copyToClipboard = useCallback(async () => {
    if (!referralCode?.code) return false;
    
    try {
      await navigator.clipboard.writeText(referralCode.code);
      return true;
    } catch {
      return false;
    }
  }, [referralCode?.code]);

  const shareReferral = useCallback(async () => {
    if (!referralCode?.share_url) return false;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'FunChat - Mời bạn bè',
          text: `Tham gia FunChat cùng mình! Sử dụng mã giới thiệu: ${referralCode.code}`,
          url: referralCode.share_url
        });
        return true;
      } catch {
        // User cancelled or share failed
      }
    }

    // Fallback to copying link
    try {
      await navigator.clipboard.writeText(referralCode.share_url);
      return true;
    } catch {
      return false;
    }
  }, [referralCode]);

  // Fetch referral code when user is available
  useEffect(() => {
    if (user) {
      getReferralCode();
    }
  }, [user, getReferralCode]);

  return {
    referralCode,
    loading,
    error,
    getReferralCode,
    useReferralCode,
    copyToClipboard,
    shareReferral
  };
}

/**
 * Hook quản lý Red Envelope (Lì xì)
 */
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface RedEnvelope {
  id: string;
  sender_id: string;
  conversation_id: string;
  message_id?: string;
  total_amount: number;
  currency: string;
  total_recipients: number;
  distribution_type: 'random' | 'equal';
  message?: string;
  remaining_amount: number;
  claimed_count: number;
  status: 'active' | 'expired' | 'fully_claimed' | 'refunded';
  expires_at: string;
  created_at: string;
  sender?: {
    id: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export interface RedEnvelopeClaim {
  id: string;
  envelope_id: string;
  user_id: string;
  amount: number;
  claimed_at: string;
  user?: {
    id: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export interface CreateEnvelopeParams {
  conversationId: string;
  totalAmount: number;
  currency: string;
  totalRecipients: number;
  distributionType: 'random' | 'equal';
  message?: string;
}

export function useRedEnvelope() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Create a new red envelope
  const createEnvelope = useCallback(async (
    params: CreateEnvelopeParams
  ): Promise<{ envelope: RedEnvelope | null; error: Error | null }> => {
    if (!user) return { envelope: null, error: new Error('Not authenticated') };

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('red-envelope/create', {
        body: params,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to create envelope');

      return { envelope: data.envelope, error: null };
    } catch (error) {
      console.error('[useRedEnvelope] Create error:', error);
      return { envelope: null, error: error instanceof Error ? error : new Error('Failed to create') };
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Claim a red envelope
  const claimEnvelope = useCallback(async (
    envelopeId: string
  ): Promise<{ claim: RedEnvelopeClaim | null; error: Error | null }> => {
    if (!user) return { claim: null, error: new Error('Not authenticated') };

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('red-envelope/claim', {
        body: { envelopeId },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to claim');

      return { claim: data.claim, error: null };
    } catch (error) {
      console.error('[useRedEnvelope] Claim error:', error);
      return { claim: null, error: error instanceof Error ? error : new Error('Failed to claim') };
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Get envelope details
  const getEnvelopeDetails = useCallback(async (
    envelopeId: string
  ): Promise<{
    envelope: RedEnvelope | null;
    claims: RedEnvelopeClaim[];
    hasClaimed: boolean;
    userClaimAmount: number | null;
    error: Error | null;
  }> => {
    try {
      const { data, error } = await supabase.functions.invoke('red-envelope/details', {
        body: {},
        headers: {},
      });

      // Use query params for GET-like behavior
      const response = await supabase.functions.invoke(`red-envelope`, {
        body: null,
        headers: {},
        method: 'GET',
      });

      // Fallback: direct query
      const { data: envelope, error: envError } = await supabase
        .from('red_envelopes')
        .select('*')
        .eq('id', envelopeId)
        .single();

      if (envError) throw envError;

      const { data: claims } = await supabase
        .from('red_envelope_claims')
        .select('*')
        .eq('envelope_id', envelopeId)
        .order('claimed_at', { ascending: false });

      const userClaim = claims?.find(c => c.user_id === user?.id);

      return {
        envelope: envelope as RedEnvelope,
        claims: (claims || []) as RedEnvelopeClaim[],
        hasClaimed: !!userClaim,
        userClaimAmount: userClaim?.amount || null,
        error: null,
      };
    } catch (error) {
      console.error('[useRedEnvelope] Details error:', error);
      return {
        envelope: null,
        claims: [],
        hasClaimed: false,
        userClaimAmount: null,
        error: error instanceof Error ? error : new Error('Failed to get details'),
      };
    }
  }, [user]);

  return {
    loading,
    createEnvelope,
    claimEnvelope,
    getEnvelopeDetails,
  };
}

/**
 * useCryptoTransactions - Direct Supabase hook for crypto transactions
 * Replaces api-crypto edge function calls for frontend usage
 */

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface CryptoTransaction {
  id: string;
  from_user_id: string | null;
  to_user_id: string | null;
  amount: number;
  currency: string;
  tx_hash: string | null;
  message_id: string | null;
  status: string | null;
  created_at: string | null;
  from_user?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  to_user?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface CryptoStats {
  total_sent: Record<string, number>;
  total_received: Record<string, number>;
  transaction_count: {
    sent: number;
    received: number;
  };
}

interface UseCryptoTransactionsState {
  transactions: CryptoTransaction[];
  stats: CryptoStats | null;
  loading: boolean;
  error: string | null;
}

export function useCryptoTransactions() {
  const { user } = useAuth();
  const [state, setState] = useState<UseCryptoTransactionsState>({
    transactions: [],
    stats: null,
    loading: false,
    error: null,
  });

  /**
   * Fetch transaction history
   */
  const fetchHistory = useCallback(async (options?: {
    type?: 'sent' | 'received' | 'all';
    limit?: number;
    offset?: number;
  }) => {
    if (!user) return;

    const { type = 'all', limit = 50, offset = 0 } = options || {};

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Query transactions without FK joins (no FK defined in schema)
      let query = supabase
        .from('crypto_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (type === 'sent') {
        query = query.eq('from_user_id', user.id);
      } else if (type === 'received') {
        query = query.eq('to_user_id', user.id);
      } else {
        // Get all transactions where user is sender or receiver
        query = query.or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch user details separately
      const txs = data || [];
      const userIds = [...new Set([
        ...txs.map(t => t.from_user_id).filter(Boolean),
        ...txs.map(t => t.to_user_id).filter(Boolean),
      ])] as string[];

      const { data: users } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', userIds);

      const userMap = new Map(users?.map(u => [u.id, u]) || []);

      const enrichedTxs: CryptoTransaction[] = txs.map(tx => ({
        ...tx,
        from_user: tx.from_user_id ? userMap.get(tx.from_user_id) || null : null,
        to_user: tx.to_user_id ? userMap.get(tx.to_user_id) || null : null,
      }));

      setState(prev => ({
        ...prev,
        transactions: enrichedTxs,
        loading: false,
      }));

      return enrichedTxs;
    } catch (err: any) {
      console.error('Fetch history error:', err);
      setState(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to fetch history',
      }));
      return null;
    }
  }, [user]);

  /**
   * Fetch aggregated stats
   */
  const fetchStats = useCallback(async () => {
    if (!user) return null;

    try {
      // Get sent transactions
      const { data: sent } = await supabase
        .from('crypto_transactions')
        .select('amount, currency')
        .eq('from_user_id', user.id)
        .eq('status', 'completed');

      // Get received transactions
      const { data: received } = await supabase
        .from('crypto_transactions')
        .select('amount, currency')
        .eq('to_user_id', user.id)
        .eq('status', 'completed');

      // Aggregate by currency
      const sentByCurrency: Record<string, number> = {};
      const receivedByCurrency: Record<string, number> = {};

      sent?.forEach((tx) => {
        sentByCurrency[tx.currency] = (sentByCurrency[tx.currency] || 0) + Number(tx.amount);
      });

      received?.forEach((tx) => {
        receivedByCurrency[tx.currency] = (receivedByCurrency[tx.currency] || 0) + Number(tx.amount);
      });

      const stats: CryptoStats = {
        total_sent: sentByCurrency,
        total_received: receivedByCurrency,
        transaction_count: {
          sent: sent?.length || 0,
          received: received?.length || 0,
        },
      };

      setState(prev => ({ ...prev, stats }));
      return stats;
    } catch (err: any) {
      console.error('Fetch stats error:', err);
      return null;
    }
  }, [user]);

  /**
   * Create a new crypto transaction record
   */
  const createTransaction = useCallback(async (params: {
    to_user_id: string;
    amount: number;
    currency: string;
    tx_hash?: string;
    message_id?: string;
  }) => {
    if (!user) throw new Error('Not authenticated');

    const { to_user_id, amount, currency, tx_hash, message_id } = params;

    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    // Verify recipient exists
    const { data: recipient, error: recipientError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', to_user_id)
      .single();

    if (recipientError || !recipient) {
      throw new Error('Recipient not found');
    }

    // Insert transaction
    const { data, error } = await supabase
      .from('crypto_transactions')
      .insert({
        from_user_id: user.id,
        to_user_id,
        amount,
        currency,
        tx_hash: tx_hash || null,
        message_id: message_id || null,
        status: tx_hash ? 'completed' : 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Optimistically update local state - cast to CryptoTransaction
    const newTx: CryptoTransaction = {
      ...data,
      from_user: null,
      to_user: null,
    };

    setState(prev => ({
      ...prev,
      transactions: [newTx, ...prev.transactions],
    }));

    return data;
  }, [user]);

  /**
   * Update transaction status (e.g., when tx_hash becomes available)
   */
  const updateTransaction = useCallback(async (
    transactionId: string,
    updates: { tx_hash?: string; status?: string }
  ) => {
    const { data, error } = await supabase
      .from('crypto_transactions')
      .update(updates)
      .eq('id', transactionId)
      .select()
      .single();

    if (error) throw error;

    // Update local state
    setState(prev => ({
      ...prev,
      transactions: prev.transactions.map(tx =>
        tx.id === transactionId ? { ...tx, ...data } : tx
      ),
    }));

    return data;
  }, []);

  /**
   * Get a single transaction by ID with user details
   */
  const getTransaction = useCallback(async (transactionId: string): Promise<CryptoTransaction | null> => {
    const { data, error } = await supabase
      .from('crypto_transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (error) return null;

    // Fetch user details
    const userIds = [data.from_user_id, data.to_user_id].filter(Boolean) as string[];
    const { data: users } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', userIds);

    const userMap = new Map(users?.map(u => [u.id, u]) || []);

    return {
      ...data,
      from_user: data.from_user_id ? userMap.get(data.from_user_id) || null : null,
      to_user: data.to_user_id ? userMap.get(data.to_user_id) || null : null,
    };
  }, []);

  /**
   * Get transaction by blockchain tx_hash
   */
  const getByTxHash = useCallback(async (txHash: string): Promise<CryptoTransaction | null> => {
    const { data, error } = await supabase
      .from('crypto_transactions')
      .select('*')
      .eq('tx_hash', txHash)
      .single();

    if (error) return null;

    // Fetch user details
    const userIds = [data.from_user_id, data.to_user_id].filter(Boolean) as string[];
    const { data: users } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', userIds);

    const userMap = new Map(users?.map(u => [u.id, u]) || []);

    return {
      ...data,
      from_user: data.from_user_id ? userMap.get(data.from_user_id) || null : null,
      to_user: data.to_user_id ? userMap.get(data.to_user_id) || null : null,
    };
  }, []);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`crypto_transactions:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'crypto_transactions',
          filter: `to_user_id=eq.${user.id}`,
        },
        async (payload) => {
          // Fetch full transaction with user details
          const fullTx = await getTransaction(payload.new.id);
          if (fullTx) {
            setState(prev => ({
              ...prev,
              transactions: [fullTx, ...prev.transactions.filter(t => t.id !== fullTx.id)],
            }));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'crypto_transactions',
        },
        (payload) => {
          const updated = payload.new as CryptoTransaction;
          if (updated.from_user_id === user.id || updated.to_user_id === user.id) {
            setState(prev => ({
              ...prev,
              transactions: prev.transactions.map(tx =>
                tx.id === updated.id ? { ...tx, ...updated } : tx
              ),
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, getTransaction]);

  return {
    ...state,
    fetchHistory,
    fetchStats,
    createTransaction,
    updateTransaction,
    getTransaction,
    getByTxHash,
  };
}

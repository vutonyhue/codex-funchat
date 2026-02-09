import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import * as chatApi from '@/lib/supabaseChat';
import type { Conversation } from '@/types';

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await chatApi.listConversations(user.id);
      setConversations(result.conversations);
    } catch (err) {
      if (import.meta.env.DEV) console.error('[useConversations] fetch exception:', err);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  const createConversation = useCallback(
    async (memberIds: string[], name?: string, isGroup = false) => {
      if (!user) return { error: new Error('Not logged in') };

      try {
        // Direct 1:1: reuse existing conversation if present.
        if (!isGroup && memberIds.length === 1) {
          const otherUserId = memberIds[0];
          const existing = await chatApi.findDirectConversation(user.id, otherUserId);
          if (existing) {
            return { data: existing, error: null };
          }
        }

        const result = await chatApi.createConversation(
          user.id,
          memberIds,
          isGroup ? name || null : null,
          isGroup
        );

        if (result.error) {
          return { data: null, error: result.error };
        }

        // Keep local list fresh, but don't block returning the id.
        void fetchConversations();

        return { data: result.data, error: null };
      } catch (err: unknown) {
        return { data: null, error: err instanceof Error ? err : new Error('Failed to create conversation') };
      }
    },
    [user, fetchConversations]
  );

  const deleteConversation = useCallback(
    async (conversationId: string) => {
      if (!user) return { error: new Error('Not logged in') };

      try {
        const result = await chatApi.leaveConversation(user.id, conversationId);
        if (result.error) {
          return { error: result.error };
        }

        setConversations((prev) => prev.filter((c) => c.id !== conversationId));
        return { error: null };
      } catch (err: unknown) {
        return { error: err instanceof Error ? err : new Error('Failed to leave conversation') };
      }
    },
    [user]
  );

  const getConversation = useCallback(
    async (conversationId: string): Promise<Conversation | null> => {
      if (!user) return null;

      try {
        return await chatApi.getConversation(conversationId);
      } catch (err) {
        if (import.meta.env.DEV) console.error('[useConversations] getConversation exception:', err);
        return null;
      }
    },
    [user]
  );

  const findDirectConversation = useCallback(
    async (otherUserId: string): Promise<Conversation | null> => {
      if (!user) return null;

      try {
        return await chatApi.findDirectConversation(user.id, otherUserId);
      } catch {
        return null;
      }
    },
    [user]
  );

  const leaveConversation = deleteConversation;

  return {
    conversations,
    loading,
    fetchConversations,
    createConversation,
    deleteConversation,
    getConversation,
    findDirectConversation,
    leaveConversation,
  };
}

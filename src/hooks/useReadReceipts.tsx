import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import * as chatApi from '@/lib/supabaseChat';
import type { ReadReceiptEventData } from '@/realtime/useSupabaseRealtime';

interface ReadReceipt {
  message_id: string;
  user_id: string;
  read_at: string;
}

export function useReadReceipts(conversationId: string, messageIds: string[]) {
  const { user } = useAuth();
  const [readReceipts, setReadReceipts] = useState<Record<string, ReadReceipt[]>>({});
  const markedAsReadRef = useRef<Set<string>>(new Set());

  // Fetch existing read receipts directly from Supabase
  const fetchReadReceipts = useCallback(async (ids: string[]) => {
    if (!conversationId || ids.length === 0) return;
    
    // Skip temp message IDs
    const stableIds = ids.filter(id => !id.startsWith('temp_'));
    if (stableIds.length === 0) return;
    
    try {
      const data = await chatApi.getReadReceiptsBatch(stableIds);

      const receiptsMap: Record<string, ReadReceipt[]> = {};
      data.forEach((receipt) => {
        if (!receiptsMap[receipt.message_id]) {
          receiptsMap[receipt.message_id] = [];
        }
        receiptsMap[receipt.message_id].push({
          message_id: receipt.message_id,
          user_id: receipt.user_id,
          read_at: receipt.read_at,
        });
      });
      setReadReceipts(receiptsMap);
    } catch (error) {
      console.error('[useReadReceipts] Fetch error:', error);
    }
  }, [conversationId]);

  // Handle realtime read_receipt event
  const handleReadReceipt = useCallback((receipt: ReadReceiptEventData) => {
    setReadReceipts(prev => {
      const existing = prev[receipt.message_id] || [];
      // Avoid duplicates
      if (existing.some(r => r.user_id === receipt.user_id)) {
        return prev;
      }
      return {
        ...prev,
        [receipt.message_id]: [...existing, {
          message_id: receipt.message_id,
          user_id: receipt.user_id,
          read_at: receipt.read_at,
        }],
      };
    });
  }, []);

  // Mark messages as read directly via Supabase (with deduplication)
  const markAsRead = useCallback(async (messageIdsToMark: string[]) => {
    if (!user) return;

    // Filter out already marked messages AND temp messages
    const newMessageIds = messageIdsToMark.filter(
      (id) => !id.startsWith('temp_') && !markedAsReadRef.current.has(id)
    );

    if (newMessageIds.length === 0) return;

    // Mark as pending immediately to prevent duplicates
    newMessageIds.forEach((id) => markedAsReadRef.current.add(id));

    try {
      const result = await chatApi.markMessagesAsRead(newMessageIds, user.id);
      if (result.error) {
        // Silent fail - read receipts are not critical
        // Only log in DEV mode for debugging
        if (import.meta.env.DEV) {
          console.debug('[useReadReceipts] Mark as read skipped:', result.error.message);
        }
      }
    } catch (err) {
      // Silent fail - don't disrupt UX for non-critical feature
      if (import.meta.env.DEV) {
        console.debug('[useReadReceipts] Mark as read error:', err);
      }
    }
  }, [user]);

  // Check if message is read by anyone other than sender
  const isReadByOthers = useCallback((messageId: string, senderId: string) => {
    const receipts = readReceipts[messageId] || [];
    return receipts.some((r) => r.user_id !== senderId);
  }, [readReceipts]);

  // Get read count (excluding sender)
  const getReadCount = useCallback((messageId: string, senderId: string) => {
    const receipts = readReceipts[messageId] || [];
    return receipts.filter((r) => r.user_id !== senderId).length;
  }, [readReceipts]);

  // Get the latest read time (excluding sender)
  const getReadTime = useCallback((messageId: string, senderId: string): string | null => {
    const receipts = readReceipts[messageId] || [];
    const otherReceipts = receipts.filter((r) => r.user_id !== senderId);
    if (otherReceipts.length === 0) return null;
    // Return the latest read time
    const latestReceipt = otherReceipts.reduce((latest, current) => 
      new Date(current.read_at) > new Date(latest.read_at) ? current : latest
    );
    return latestReceipt.read_at;
  }, [readReceipts]);

  return {
    readReceipts,
    markAsRead,
    isReadByOthers,
    getReadCount,
    getReadTime,
    fetchReadReceipts,
    handleReadReceipt,
  };
}

/**
 * Supabase Realtime Hook (Native postgres_changes)
 *
 * Replaces SSE/Cloudflare Worker with native Supabase Realtime:
 * - postgres_changes for messages, reactions, read receipts
 * - broadcast for typing indicators
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'offline';

export interface SenderProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface MessageEventData {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  reply_to_id: string | null;
  sender?: SenderProfile;
}

export interface TypingEventData {
  user_id: string;
  user_name: string;
  timestamp: number;
}

export interface ReactionEventData {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface ReadReceiptEventData {
  id?: string;
  message_id: string;
  user_id: string;
  read_at: string;
}

export interface UseSupabaseRealtimeOptions {
  onMessage?: (message: MessageEventData) => void;
  onMessageUpdate?: (message: MessageEventData) => void;
  onMessageDelete?: (message: MessageEventData) => void;
  onTyping?: (users: TypingEventData[]) => void;
  onReactionAdded?: (reaction: ReactionEventData) => void;
  onReactionRemoved?: (reaction: ReactionEventData) => void;
  onReadReceipt?: (receipt: ReadReceiptEventData) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export interface UseSupabaseRealtimeReturn {
  isConnected: boolean;
  isReconnecting: boolean;
  connectionStatus: ConnectionStatus;
  reconnect: () => void;
  disconnect: () => void;
  broadcastTyping: (userName: string) => void;
}

const MAX_RETRY_COUNT = 5;
const BASE_RETRY_DELAY = 2000; // 2 seconds
const MAX_RETRY_DELAY = 30000; // 30 seconds

export function useSupabaseRealtime(
  conversationId: string | null,
  options: UseSupabaseRealtimeOptions
): UseSupabaseRealtimeReturn {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  // Track if we've ever successfully connected (to avoid showing "reconnecting" on first load)
  const hasConnectedBeforeRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Typing state management
  const typingUsersRef = useRef<Map<string, TypingEventData>>(new Map());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    clearRetryTimeout();
    
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setIsConnected(false);
    setIsReconnecting(false);
    optionsRef.current.onDisconnect?.();
  }, [clearRetryTimeout]);

  const connect = useCallback(async () => {
    if (!conversationIdRef.current) return;

    // Check auth before connecting
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      if (import.meta.env.DEV) {
        console.warn('[Realtime] No auth session, skipping connection');
      }
      return;
    }

    // Cleanup existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Only show "reconnecting" if we had connected before
    if (hasConnectedBeforeRef.current) {
      setIsReconnecting(true);
    }
    // Don't set isConnected to false here to avoid flicker

    const channel = supabase.channel(`room:${conversationIdRef.current}`, {
      config: {
        broadcast: { self: false },
      },
    });

    // Messages: INSERT
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationIdRef.current}`,
      },
      (payload: RealtimePostgresChangesPayload<MessageEventData>) => {
        if (payload.new && 'id' in payload.new) {
          optionsRef.current.onMessage?.(payload.new as MessageEventData);
        }
      }
    );

    // Messages: UPDATE (for edits and deletions)
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationIdRef.current}`,
      },
      (payload: RealtimePostgresChangesPayload<MessageEventData>) => {
        if (payload.new && 'id' in payload.new) {
          const msg = payload.new as MessageEventData;
          if (msg.is_deleted) {
            optionsRef.current.onMessageDelete?.(msg);
          } else {
            optionsRef.current.onMessageUpdate?.(msg);
          }
        }
      }
    );

    // Reactions: INSERT
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'message_reactions',
      },
      (payload: RealtimePostgresChangesPayload<ReactionEventData>) => {
        if (payload.new && 'id' in payload.new) {
          optionsRef.current.onReactionAdded?.(payload.new as ReactionEventData);
        }
      }
    );

    // Reactions: DELETE
    channel.on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'message_reactions',
      },
      (payload: RealtimePostgresChangesPayload<ReactionEventData>) => {
        if (payload.old && 'id' in payload.old) {
          optionsRef.current.onReactionRemoved?.(payload.old as ReactionEventData);
        }
      }
    );

    // Read receipts: INSERT
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'message_reads',
      },
      (payload: RealtimePostgresChangesPayload<ReadReceiptEventData>) => {
        if (payload.new && 'message_id' in payload.new) {
          optionsRef.current.onReadReceipt?.(payload.new as ReadReceiptEventData);
        }
      }
    );

    // Typing broadcast
    channel.on('broadcast', { event: 'typing' }, (payload) => {
      const data = payload.payload as TypingEventData;
      if (data?.user_id) {
        typingUsersRef.current.set(data.user_id, {
          ...data,
          timestamp: Date.now(),
        });

        // Clear stale typing indicators after 3 seconds
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          const now = Date.now();
          typingUsersRef.current.forEach((user, id) => {
            if (now - user.timestamp > 3000) {
              typingUsersRef.current.delete(id);
            }
          });
          optionsRef.current.onTyping?.(Array.from(typingUsersRef.current.values()));
        }, 3000);

        optionsRef.current.onTyping?.(Array.from(typingUsersRef.current.values()));
      }
    });

    // Subscribe with status handling
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        setIsReconnecting(false);
        hasConnectedBeforeRef.current = true;
        retryCountRef.current = 0; // Reset retry count on success
        clearRetryTimeout();
        optionsRef.current.onConnect?.();
        
        if (import.meta.env.DEV) {
          console.log('[Realtime] Connected to channel');
        }
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        setIsConnected(false);
        
        // Only show "reconnecting" if we had connected before
        if (hasConnectedBeforeRef.current) {
          setIsReconnecting(true);
        }
        
        // Auto-retry with exponential backoff
        if (retryCountRef.current < MAX_RETRY_COUNT) {
          const delay = Math.min(
            BASE_RETRY_DELAY * Math.pow(2, retryCountRef.current),
            MAX_RETRY_DELAY
          );
          
          if (import.meta.env.DEV) {
            console.log(`[Realtime] Connection failed, retrying in ${delay}ms (attempt ${retryCountRef.current + 1}/${MAX_RETRY_COUNT})`);
          }
          
          clearRetryTimeout();
          retryTimeoutRef.current = setTimeout(() => {
            retryCountRef.current++;
            connect();
          }, delay);
        } else {
          // Max retries reached - show offline status
          setIsReconnecting(false);
          if (import.meta.env.DEV) {
            console.warn('[Realtime] Max retries reached, giving up');
          }
          optionsRef.current.onError?.(new Error('Max reconnection attempts reached'));
        }
      }
    });

    channelRef.current = channel;
  }, [clearRetryTimeout]);

  // Auto connect/disconnect on conversation change
  useEffect(() => {
    if (!conversationId) {
      disconnect();
      // Reset state for next conversation
      hasConnectedBeforeRef.current = false;
      retryCountRef.current = 0;
      return;
    }

    connect();

    return () => {
      disconnect();
    };
  }, [conversationId, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearRetryTimeout();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [clearRetryTimeout]);

  const reconnect = useCallback(() => {
    retryCountRef.current = 0; // Reset retry count for manual reconnect
    disconnect();
    connect();
  }, [connect, disconnect]);

  const broadcastTyping = useCallback(async (userName: string) => {
    if (!channelRef.current || !conversationIdRef.current) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          user_id: user.id,
          user_name: userName,
          timestamp: Date.now(),
        },
      });
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[broadcastTyping] error:', err);
    }
  }, []);

  const connectionStatus: ConnectionStatus = useMemo(() => {
    if (isConnected) return 'connected';
    if (isReconnecting) return 'reconnecting';
    return 'offline';
  }, [isConnected, isReconnecting]);

  return {
    isConnected,
    isReconnecting,
    connectionStatus,
    reconnect,
    disconnect,
    broadcastTyping,
  };
}

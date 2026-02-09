import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './useAuth';
import {
  useSupabaseRealtime,
  MessageEventData,
  TypingEventData,
  ReactionEventData,
  ReadReceiptEventData,
} from '@/realtime/useSupabaseRealtime';
import * as chatApi from '@/lib/supabaseChat';
import { supabase } from '@/integrations/supabase/client';
import { Message, Profile } from '@/types';
import { toast } from 'sonner';
import { uploadChatAttachment } from '@/utils/mediaUpload';

interface UseMessagesOptions {
  onTyping?: (users: TypingEventData[]) => void;
  onReactionAdded?: (reaction: ReactionEventData) => void;
  onReactionRemoved?: (reaction: ReactionEventData) => void;
  onReadReceipt?: (receipt: ReadReceiptEventData) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function senderToProfile(sender: MessageEventData['sender']): Profile | undefined {
  if (!sender) return undefined;

  const now = new Date().toISOString();
  return {
    id: sender.id,
    username: sender.username,
    display_name: sender.display_name,
    avatar_url: sender.avatar_url,
    wallet_address: null,
    status: 'online',
    last_seen: now,
    created_at: now,
    updated_at: now,
  };
}

function profileFallback(user: { id: string; email?: string | null }): Profile {
  const now = new Date().toISOString();
  const base = (user.email || 'user').split('@')[0] || 'user';
  return {
    id: user.id,
    username: base,
    display_name: base,
    avatar_url: null,
    wallet_address: null,
    status: 'online',
    last_seen: now,
    created_at: now,
    updated_at: now,
  };
}

export function useMessages(conversationId: string | null, options?: UseMessagesOptions) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const offsetRef = useRef(0);
  const PAGE_SIZE = 50;

  const linkReplies = useCallback((list: Message[]): Message[] => {
    const map = new Map(list.map((m) => [m.id, m]));
    return list.map((m) => {
      if (m.reply_to_id && map.has(m.reply_to_id)) {
        return { ...m, reply_to: map.get(m.reply_to_id) };
      }
      return m;
    });
  }, []);

  const fetchMessagesPage = useCallback(
    async (offset: number): Promise<Message[]> => {
      if (!conversationId) return [];

      // Supabase direct returns newest first, we reverse for display
      const messages = await chatApi.listMessages(conversationId, PAGE_SIZE, offset);
      return messages.reverse();
    },
    [conversationId]
  );

  const fetchMessages = useCallback(async () => {
    if (!conversationId || !user) {
      setMessages([]);
      setLoading(false);
      setHasMore(false);
      offsetRef.current = 0;
      return;
    }

    setLoading(true);
    try {
      offsetRef.current = 0;
      const page = await fetchMessagesPage(0);
      setHasMore(page.length === PAGE_SIZE);
      setMessages(linkReplies(page));
    } catch (err) {
      if (import.meta.env.DEV) console.error('[useMessages] fetch error:', err);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [conversationId, user, fetchMessagesPage, linkReplies]);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  const loadMore = useCallback(async () => {
    if (!conversationId || !user) return;
    if (loading || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const nextOffset = offsetRef.current + PAGE_SIZE;
      const page = await fetchMessagesPage(nextOffset);
      offsetRef.current = nextOffset;
      setHasMore(page.length === PAGE_SIZE);

      setMessages((prev) => {
        const merged = [...page, ...prev];
        const deduped = Array.from(new Map(merged.map((m) => [m.id, m])).values());
        return linkReplies(deduped);
      });
    } catch (err) {
      if (import.meta.env.DEV) console.error('[useMessages] loadMore error:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [conversationId, user, loading, isLoadingMore, hasMore, fetchMessagesPage, linkReplies]);

  const handleRealtimeMessage = useCallback(
    (streamMessage: MessageEventData) => {
      const sender: Profile | undefined = senderToProfile(streamMessage.sender);

      const message: Message = {
        id: streamMessage.id,
        conversation_id: streamMessage.conversation_id,
        sender_id: streamMessage.sender_id,
        content: streamMessage.content,
        message_type: streamMessage.message_type,
        metadata: (streamMessage.metadata as Record<string, any>) || {},
        created_at: streamMessage.created_at,
        updated_at: streamMessage.updated_at || streamMessage.created_at,
        is_deleted: streamMessage.is_deleted,
        deleted_at: streamMessage.deleted_at,
        reply_to_id: streamMessage.reply_to_id,
        sender,
      };

      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;

        // Replace optimistic temp message if this is our own message.
        if (message.sender_id === user?.id) {
          const optimisticMatch = prev.find(
            (m) => m._sending && m.sender_id === message.sender_id && m.content === message.content
          );

          if (optimisticMatch) {
            return prev.map((m) => (m.id === optimisticMatch.id ? { ...message, _sending: false } : m));
          }

          return prev;
        }

        return [...prev, message];
      });
    },
    [user?.id]
  );

  const handleRealtimeUpdate = useCallback((updatedMessage: MessageEventData) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === updatedMessage.id
          ? {
              ...m,
              content: updatedMessage.content,
              is_deleted: updatedMessage.is_deleted,
              deleted_at: updatedMessage.deleted_at,
              updated_at: updatedMessage.updated_at || m.updated_at,
            }
          : m
      )
    );
  }, []);

  const realtimeOptions = useMemo(
    () => ({
      onMessage: handleRealtimeMessage,
      onMessageUpdate: handleRealtimeUpdate,
      onMessageDelete: handleRealtimeUpdate,
      onTyping: options?.onTyping,
      onReactionAdded: options?.onReactionAdded,
      onReactionRemoved: options?.onReactionRemoved,
      onReadReceipt: options?.onReadReceipt,
    onConnect: () => {
      if (import.meta.env.DEV) console.log('[useMessages] Realtime connected for:', conversationId);
    },
    onDisconnect: () => {
      if (import.meta.env.DEV) console.log('[useMessages] Realtime disconnected');
    },
    onError: (error: Error) => {
      if (import.meta.env.DEV) console.warn('[useMessages] Realtime error:', error);
    },
    }),
    [handleRealtimeMessage, handleRealtimeUpdate, conversationId, options]
  );

  const { isConnected, isReconnecting, connectionStatus, reconnect, broadcastTyping } = useSupabaseRealtime(
    conversationId,
    realtimeOptions
  );

  const sendMessage = useCallback(
    async (content: string, messageType = 'text', metadata: Record<string, any> = {}, replyToId?: string) => {
      if (!user || !conversationId) return { error: new Error('Not ready') };

      const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const now = new Date().toISOString();

      const tempMessage: Message = {
        id: tempId,
        conversation_id: conversationId,
        sender_id: user.id,
        content,
        message_type: messageType,
        metadata,
        created_at: now,
        updated_at: now,
        is_deleted: false,
        deleted_at: null,
        sender: profile || profileFallback({ id: user.id, email: user.email }),
        reply_to_id: replyToId || null,
        _sending: true,
      };

      setMessages((prev) => [...prev, tempMessage]);

      try {
        const result = await chatApi.sendMessage(
          conversationId,
          user.id,
          content,
          messageType,
          metadata,
          replyToId
        );

        if (result.error || !result.data) {
          setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _sending: false, _failed: true } : m)));
          toast.error(result.error?.message || 'Unable to send message');
          return { error: result.error || new Error('send_failed') };
        }

        const msg = result.data;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  id: msg.id,
                  created_at: msg.created_at,
                  updated_at: msg.updated_at,
                  _sending: false,
                  _failed: false,
                }
              : m
          )
        );

        return { data: msg, error: null };
      } catch (err: unknown) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _sending: false, _failed: true } : m)));
        toast.error('Network error: cannot send message');
        return { error: err instanceof Error ? err : new Error('send_failed') };
      }
    },
    [user, conversationId, profile]
  );

  const sendCryptoMessage = useCallback(
    async (toUserId: string, amount: number, currency: string, txHash?: string) => {
      if (!user || !conversationId) return { error: new Error('Not ready') };

      const content = `Sent ${amount} ${currency}`;
      const metadata = { amount, currency, tx_hash: txHash, to_user_id: toUserId };

      const msgRes = await sendMessage(content, 'crypto', metadata);
      if (msgRes.error || !msgRes.data) return msgRes;

      // Log crypto transaction directly via Supabase
      const { error: txError } = await supabase.from('crypto_transactions').insert({
        from_user_id: user.id,
        to_user_id: toUserId,
        amount,
        currency,
        tx_hash: txHash || null,
        message_id: msgRes.data.id,
        status: 'pending',
      });

      if (txError) {
        if (import.meta.env.DEV) console.warn('[useMessages] crypto transfer failed:', txError);
        toast.error('Unable to log crypto transaction');
      }

      return msgRes;
    },
    [user, conversationId, sendMessage]
  );

  const sendImageMessage = useCallback(
    async (file: File, caption?: string) => {
      if (!user || !conversationId) return { error: new Error('Not ready') };

      const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const now = new Date().toISOString();
      const tempUrl = URL.createObjectURL(file);

      const initialType = (file.type || '').startsWith('image/') ? 'image' : 'file';
      const content = caption || (initialType === 'image' ? 'Sent an image' : `Sent file: ${file.name}`);

      const tempMessage: Message = {
        id: tempId,
        conversation_id: conversationId,
        sender_id: user.id,
        content,
        message_type: initialType,
        metadata: {
          file_url: tempUrl,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type || 'application/octet-stream',
          caption,
        },
        created_at: now,
        updated_at: now,
        is_deleted: false,
        deleted_at: null,
        sender: profile || undefined,
        _sending: true,
      };

      setMessages((prev) => [...prev, tempMessage]);

      try {
        const up = await uploadChatAttachment(file);
        const publicUrl = up.publicUrl;
        const fileType = up.contentType || 'application/octet-stream';

        const isImage = fileType.startsWith('image/');
        const isVideo = fileType.startsWith('video/');
        const finalType = isImage ? 'image' : isVideo ? 'video' : 'file';

        const result = await chatApi.sendMessage(
          conversationId,
          user.id,
          content,
          finalType,
          {
            file_url: publicUrl,
            file_name: file.name,
            file_size: file.size,
            file_type: fileType,
            caption,
          }
        );

        if (result.error || !result.data) {
          setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _sending: false, _failed: true } : m)));
          toast.error(result.error?.message || 'Unable to send file');
          return { error: result.error || new Error('send_failed') };
        }

        const msg = result.data;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  id: msg.id,
                  message_type: finalType,
                  metadata: {
                    ...m.metadata,
                    file_url: publicUrl,
                    file_type: fileType,
                  },
                  _sending: false,
                  _failed: false,
                }
              : m
          )
        );

        URL.revokeObjectURL(tempUrl);
        return { data: msg, error: null };
      } catch (err: unknown) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _sending: false, _failed: true } : m)));
        toast.error('Unable to upload file');
        return { error: err instanceof Error ? err : new Error('upload_failed') };
      }
    },
    [user, conversationId, profile]
  );

  const sendVoiceMessage = useCallback(
    async (audioBlob: Blob, duration: number) => {
      if (!user || !conversationId) return { error: new Error('Not ready') };

      const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const now = new Date().toISOString();
      const tempUrl = URL.createObjectURL(audioBlob);

      const tempMessage: Message = {
        id: tempId,
        conversation_id: conversationId,
        sender_id: user.id,
        content: 'Voice message',
        message_type: 'voice',
        metadata: { file_url: tempUrl, duration },
        created_at: now,
        updated_at: now,
        is_deleted: false,
        deleted_at: null,
        sender: profile || undefined,
        _sending: true,
      };

      setMessages((prev) => [...prev, tempMessage]);

      try {
        const file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        const up = await uploadChatAttachment(file);
        const publicUrl = up.publicUrl;
        const fileType = up.contentType || 'application/octet-stream';

        const result = await chatApi.sendMessage(
          conversationId,
          user.id,
          'Voice message',
          'voice',
          {
            file_url: publicUrl,
            duration,
            file_type: fileType,
            file_name: file.name,
            file_size: file.size,
          }
        );

        if (result.error || !result.data) {
          setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _sending: false, _failed: true } : m)));
          toast.error(result.error?.message || 'Unable to send voice message');
          return { error: result.error || new Error('send_failed') };
        }

        const msg = result.data;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  id: msg.id,
                  metadata: {
                    ...m.metadata,
                    file_url: publicUrl,
                    file_type: fileType,
                    file_name: file.name,
                    file_size: file.size,
                  },
                  _sending: false,
                  _failed: false,
                }
              : m
          )
        );

        URL.revokeObjectURL(tempUrl);
        return { data: msg, error: null };
      } catch (err: unknown) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _sending: false, _failed: true } : m)));
        toast.error('Unable to send voice message');
        return { error: err instanceof Error ? err : new Error('send_failed') };
      }
    },
    [user, conversationId, profile]
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!user) return { error: new Error('Not authenticated') };

      const now = new Date().toISOString();
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, is_deleted: true, deleted_at: now, content: 'Message deleted' } : m))
      );

      const result = await chatApi.deleteMessage(messageId, user.id);
      if (result.error) {
        toast.error(result.error.message || 'Unable to delete message');
        return { error: result.error };
      }

      return { error: null };
    },
    [user]
  );

  const forwardMessage = useCallback(
    async (messageId: string, targetConversationId: string) => {
      if (!user) return { error: new Error('Not authenticated') };

      const message = messages.find((m) => m.id === messageId);
      if (!message) return { error: new Error('Message not found') };

      const result = await chatApi.sendMessage(
        targetConversationId,
        user.id,
        message.content || '',
        message.message_type,
        { ...(message.metadata || {}), forwarded_from: messageId }
      );

      if (result.error || !result.data) {
        toast.error(result.error?.message || 'Unable to forward message');
        return { error: result.error || new Error('forward_failed') };
      }

      toast.success('Message forwarded');
      return { data: result.data, error: null };
    },
    [user, messages]
  );

  const retryMessage = useCallback(
    async (messageId: string) => {
      const failedMessage = messages.find((m) => m.id === messageId && m._failed);
      if (!failedMessage || !user || !conversationId) {
        return { error: new Error('Message not found or not ready') };
      }

      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, _sending: true, _failed: false } : m)));

      const result = await chatApi.sendMessage(
        conversationId,
        user.id,
        failedMessage.content || '',
        failedMessage.message_type,
        failedMessage.metadata,
        failedMessage.reply_to_id
      );

      if (result.error || !result.data) {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, _sending: false, _failed: true } : m)));
        toast.error(result.error?.message || 'Unable to resend message');
        return { error: result.error || new Error('send_failed') };
      }

      const msg = result.data;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                id: msg.id,
                created_at: msg.created_at,
                updated_at: msg.updated_at,
                _sending: false,
                _failed: false,
              }
            : m
        )
      );

      return { data: msg, error: null };
    },
    [messages, user, conversationId]
  );

  return {
    messages,
    loading,
    hasMore,
    isLoadingMore,
    isConnected,
    isReconnecting,
    connectionStatus,
    sendMessage,
    sendCryptoMessage,
    sendImageMessage,
    sendVoiceMessage,
    deleteMessage,
    forwardMessage,
    retryMessage,
    loadMore,
    refetch: fetchMessages,
    reconnect,
    broadcastTyping,
  };
}
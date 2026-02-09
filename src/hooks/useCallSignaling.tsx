import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { useCallsApi, CallSession } from './useCallsApi';

export type { CallSession };

interface UseCallSignalingProps {
  conversationId?: string;
}

// Helper format thời lượng cuộc gọi
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs} giây`;
  return `${mins} phút ${secs} giây`;
};

export const useCallSignaling = ({ conversationId }: UseCallSignalingProps = {}) => {
  const { user } = useAuth();
  const callsApi = useCallsApi();
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Track which calls have already had messages sent to avoid duplicates
  const sentMessagesRef = useRef<Set<string>>(new Set());

  // Hàm gửi tin nhắn thông báo cuộc gọi - Direct Supabase
  const sendCallMessageInternal = async (
    convId: string,
    callType: 'video' | 'voice',
    status: 'rejected' | 'ended' | 'missed',
    duration?: number,
    callId?: string
  ) => {
    // Prevent duplicate messages for the same call event
    const messageKey = `${callId}-${status}`;
    if (callId && sentMessagesRef.current.has(messageKey)) {
      return;
    }
    if (callId) {
      sentMessagesRef.current.add(messageKey);
    }

    try {
      await callsApi.sendCallMessage(convId, callType, status, duration, callId);
    } catch (e) {
      console.error('Failed to send call message:', e);
    }
  };

  // Subscribe to call sessions - Poll through direct Supabase queries
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const lastStatusRef = new Map<string, CallSession['status']>();

    const poll = async () => {
      if (cancelled) return;

      try {
        // 1) Track updates for the current active call.
        if (activeCall?.id) {
          const next = await callsApi.getCall(activeCall.id);
          if (next) {
            const prevStatus = lastStatusRef.get(next.id) || activeCall.status;
            lastStatusRef.set(next.id, next.status);

            if (next.status !== prevStatus) {
              if (next.status === 'accepted') {
                setActiveCall(next);
                setIncomingCall(null);
              } else if (next.status === 'rejected') {
                toast({
                  title: 'Cuộc gọi bị từ chối',
                  description: 'Người nhận đã từ chối cuộc gọi của bạn',
                  variant: 'destructive',
                });
                sendCallMessageInternal(next.conversation_id, next.call_type, 'rejected', undefined, next.id);
                setActiveCall(null);
                setIncomingCall(null);
              } else if (next.status === 'ended') {
                let duration = 0;
                if (next.started_at && next.ended_at) {
                  duration = Math.floor((new Date(next.ended_at).getTime() - new Date(next.started_at).getTime()) / 1000);
                }
                toast({
                  title: 'Cuộc gọi đã kết thúc',
                  description: duration ? `Thời lượng: ${formatDuration(duration)}` : 'Cuộc gọi đã được kết thúc',
                });
                sendCallMessageInternal(next.conversation_id, next.call_type, 'ended', duration, next.id);
                setActiveCall(null);
                setIncomingCall(null);
              } else if (next.status === 'missed') {
                toast({
                  title: 'Cuộc gọi nhỡ',
                  description: 'Bạn có một cuộc gọi nhỡ',
                  variant: 'destructive',
                });
                sendCallMessageInternal(next.conversation_id, next.call_type, 'missed', undefined, next.id);
                setActiveCall(null);
                setIncomingCall(null);
              } else {
                setActiveCall(next);
              }
            }
          }
        }

        // 2) Discover incoming ringing calls.
        if (!activeCall?.id) {
          const { calls } = await callsApi.getHistory(10, 0);
          const list = Array.isArray(calls) ? calls : [];

          const ringing = list.find((c) => {
            if (!c || c.status !== 'ringing') return false;
            if (c.caller_id === user.id) return false;
            if (conversationId && c.conversation_id !== conversationId) return false;
            return true;
          });

          if (ringing) {
            if (!incomingCall || incomingCall.id !== ringing.id) {
              setIncomingCall({
                ...ringing,
                caller_profile: ringing.caller
                  ? {
                      display_name: ringing.caller.display_name,
                      avatar_url: ringing.caller.avatar_url,
                      username: ringing.caller.username,
                    }
                  : undefined,
              });
            }
          } else {
            setIncomingCall(null);
          }
        }
      } catch (e) {
        // Suppress noisy errors (e.g., relationship schema cache errors)
        if (import.meta.env.DEV) {
          console.warn('[useCallSignaling] Poll error (suppressed):', e);
        }
      }
    };

    const interval = setInterval(poll, 2000);
    poll();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.id, conversationId, activeCall?.id, activeCall?.status, incomingCall?.id, callsApi]);

  // Start a new call - Direct Supabase
  const startCall = useCallback(async (targetConversationId: string, callType: 'video' | 'voice') => {
    if (!user) return null;

    setIsLoading(true);
    try {
      const callData = await callsApi.startCall(targetConversationId, callType);
      console.log('Call started:', callData);
      setActiveCall(callData);
      return callData;
    } catch (error) {
      console.error('Failed to start call:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, callsApi]);

  // Accept incoming call - Direct Supabase
  const acceptCall = useCallback(async (callId: string) => {
    if (!user) return;

    setIsLoading(true);
    try {
      const callData = await callsApi.acceptCall(callId);
      console.log('Call accepted:', callData);
      setActiveCall(callData);
      setIncomingCall(null);
    } catch (error) {
      console.error('Failed to accept call:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, callsApi]);

  // Reject incoming call - Direct Supabase
  const rejectCall = useCallback(async (callId: string) => {
    if (!user) return;

    setIsLoading(true);
    try {
      await callsApi.rejectCall(callId);
      console.log('Call rejected');
      toast({
        title: "Đã từ chối cuộc gọi",
        description: "Bạn đã từ chối cuộc gọi đến",
      });
      setIncomingCall(null);
    } catch (error) {
      console.error('Failed to reject call:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, callsApi]);

  // End active call - Direct Supabase
  const endCall = useCallback(async () => {
    if (!user || !activeCall) return;

    setIsLoading(true);
    try {
      await callsApi.endCall(activeCall.id);
      console.log('Call ended');
      setActiveCall(null);
    } catch (error) {
      console.error('Failed to end call:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, activeCall, callsApi]);

  return {
    incomingCall,
    activeCall,
    isLoading,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
  };
};

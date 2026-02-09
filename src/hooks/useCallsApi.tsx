/**
 * Direct Supabase API for call operations
 * Migrated from Cloudflare Worker to reduce latency
 * Uses manual join for profiles to avoid FK embed issues
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface CallerProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface CallSession {
  id: string;
  caller_id: string;
  conversation_id: string;
  call_type: 'video' | 'voice';
  status: 'ringing' | 'accepted' | 'rejected' | 'ended' | 'missed';
  channel_name: string;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  caller?: CallerProfile;
  conversation?: {
    id: string;
    name: string | null;
    is_group: boolean;
  };
  // Alias for caller - used by IncomingCallModal
  caller_profile?: {
    display_name: string | null;
    avatar_url: string | null;
    username: string;
  };
}

export interface CallHistoryItem extends CallSession {
  conversation?: { id: string; name: string | null; is_group: boolean } | null;
  caller?: CallerProfile | null;
}

// Helper to fetch profiles by user IDs
async function fetchProfilesByIds(userIds: string[]): Promise<Map<string, CallerProfile>> {
  const profileMap = new Map<string, CallerProfile>();
  if (userIds.length === 0) return profileMap;

  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', userIds);

  if (data) {
    for (const p of data) {
      profileMap.set(p.id, {
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
      });
    }
  }
  return profileMap;
}

// Helper to attach caller profile to a call session
async function attachCallerProfile(call: any): Promise<CallSession> {
  if (!call.caller_id) {
    return call as CallSession;
  }

  const profileMap = await fetchProfilesByIds([call.caller_id]);
  const callerProfile = profileMap.get(call.caller_id);

  return {
    ...call,
    caller: callerProfile,
    caller_profile: callerProfile ? {
      display_name: callerProfile.display_name,
      avatar_url: callerProfile.avatar_url,
      username: callerProfile.username,
    } : undefined,
  } as CallSession;
}

export const useCallsApi = () => {
  const { user } = useAuth();

  /**
   * Get call history for current user (manual join for caller profiles)
   */
  const getHistory = useCallback(async (limit = 50, offset = 0): Promise<{ calls: CallHistoryItem[]; total: number }> => {
    if (!user) return { calls: [], total: 0 };

    // Get user's conversations
    const { data: memberData } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', user.id);

    const conversationIds = memberData?.map((m) => m.conversation_id).filter(Boolean) as string[] || [];

    if (conversationIds.length === 0) {
      return { calls: [], total: 0 };
    }

    // Fetch call sessions with conversation embed (this FK exists)
    const { data, error } = await supabase
      .from('call_sessions')
      .select(`
        *,
        conversation:conversations(id, name, is_group)
      `)
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[useCallsApi] getHistory error:', error);
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      return { calls: [], total: 0 };
    }

    // Manual join: fetch caller profiles
    const callerIds = [...new Set(data.map(c => c.caller_id).filter(Boolean) as string[])];
    const profileMap = await fetchProfilesByIds(callerIds);

    // Attach caller profiles
    const calls: CallHistoryItem[] = data.map(call => ({
      ...call,
      caller: call.caller_id ? profileMap.get(call.caller_id) : undefined,
      caller_profile: call.caller_id && profileMap.get(call.caller_id) ? {
        display_name: profileMap.get(call.caller_id)!.display_name,
        avatar_url: profileMap.get(call.caller_id)!.avatar_url,
        username: profileMap.get(call.caller_id)!.username,
      } : undefined,
    })) as CallHistoryItem[];

    return { calls, total: calls.length };
  }, [user]);

  /**
   * Start a new call (manual join for caller profile)
   */
  const startCall = useCallback(async (conversationId: string, callType: 'video' | 'voice'): Promise<CallSession> => {
    if (!user) throw new Error('Not authenticated');

    // Check if user is member of conversation
    const { data: membership } = await supabase
      .from('conversation_members')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      throw new Error('Not a member of this conversation');
    }

    // Create call session
    const channelName = `call_${conversationId}_${Date.now()}`;
    const { data, error } = await supabase
      .from('call_sessions')
      .insert({
        conversation_id: conversationId,
        caller_id: user.id,
        call_type: callType,
        channel_name: channelName,
        status: 'ringing'
      })
      .select('*')
      .single();

    if (error) {
      console.error('[useCallsApi] startCall error:', error);
      throw new Error(error.message);
    }

    // Manual join caller profile
    return await attachCallerProfile(data);
  }, [user]);

  /**
   * Get call by ID (manual join for caller profile)
   */
  const getCall = useCallback(async (callId: string): Promise<CallSession | null> => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('call_sessions')
      .select(`
        *,
        conversation:conversations(id, name, is_group)
      `)
      .eq('id', callId)
      .single();

    if (error) {
      console.error('[useCallsApi] getCall error:', error);
      return null;
    }

    // Verify user has access (is in conversation)
    const { data: membership } = await supabase
      .from('conversation_members')
      .select('id')
      .eq('conversation_id', data.conversation_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      console.error('[useCallsApi] Not a member of this conversation');
      return null;
    }

    // Manual join caller profile
    return await attachCallerProfile(data);
  }, [user]);

  /**
   * Accept a call (manual join for caller profile)
   */
  const acceptCall = useCallback(async (callId: string): Promise<CallSession> => {
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('call_sessions')
      .update({
        status: 'accepted',
        started_at: new Date().toISOString()
      })
      .eq('id', callId)
      .select('*')
      .single();

    if (error) {
      console.error('[useCallsApi] acceptCall error:', error);
      throw new Error(error.message);
    }

    // Manual join caller profile
    return await attachCallerProfile(data);
  }, [user]);

  /**
   * Reject a call (manual join for caller profile)
   */
  const rejectCall = useCallback(async (callId: string): Promise<CallSession> => {
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('call_sessions')
      .update({
        status: 'rejected',
        ended_at: new Date().toISOString()
      })
      .eq('id', callId)
      .select('*')
      .single();

    if (error) {
      console.error('[useCallsApi] rejectCall error:', error);
      throw new Error(error.message);
    }

    // Manual join caller profile
    return await attachCallerProfile(data);
  }, [user]);

  /**
   * End a call (manual join for caller profile)
   */
  const endCall = useCallback(async (callId: string): Promise<CallSession> => {
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('call_sessions')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString()
      })
      .eq('id', callId)
      .select('*')
      .single();

    if (error) {
      console.error('[useCallsApi] endCall error:', error);
      throw new Error(error.message);
    }

    // Manual join caller profile
    return await attachCallerProfile(data);
  }, [user]);

  /**
   * Send call status message to conversation
   */
  const sendCallMessage = useCallback(async (
    conversationId: string,
    callType: 'video' | 'voice',
    callStatus: 'rejected' | 'ended' | 'missed',
    duration?: number,
    callId?: string
  ): Promise<void> => {
    if (!user) return;

    // Build message content
    const statusMessages: Record<string, string> = {
      rejected: callType === 'video' ? 'Cuộc gọi video bị từ chối' : 'Cuộc gọi thoại bị từ chối',
      ended: callType === 'video' 
        ? `Cuộc gọi video đã kết thúc${duration ? ` (${Math.floor(duration / 60)} phút ${duration % 60} giây)` : ''}`
        : `Cuộc gọi thoại đã kết thúc${duration ? ` (${Math.floor(duration / 60)} phút ${duration % 60} giây)` : ''}`,
      missed: callType === 'video' ? 'Cuộc gọi video nhỡ' : 'Cuộc gọi thoại nhỡ',
    };

    const content = statusMessages[callStatus] || 'Cuộc gọi đã kết thúc';

    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content,
        message_type: 'call',
        metadata: {
          call_id: callId || null,
          call_type: callType,
          call_status: callStatus,
          duration: duration || null,
        },
      });

    if (error) {
      console.error('[useCallsApi] sendCallMessage error:', error);
    }
  }, [user]);

  return {
    getHistory,
    startCall,
    getCall,
    acceptCall,
    rejectCall,
    endCall,
    sendCallMessage,
  };
};

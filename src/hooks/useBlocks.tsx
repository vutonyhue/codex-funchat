/**
 * Hook quản lý Block & Report (5D Light Language)
 * - "Tạm ngừng kết nối" thay vì "Chặn"
 * - "Gửi phản hồi" thay vì "Báo cáo"
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Block {
  id: string;
  blocker_id: string;
  blocked_id: string;
  reason?: string;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id?: string;
  reported_message_id?: string;
  reason: string;
  details?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  created_at: string;
}

export function useBlocks() {
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<Block[]>([]);
  const [blockedByUsers, setBlockedByUsers] = useState<Block[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch blocked users on mount
  useEffect(() => {
    if (!user) return;
    fetchBlocks();
  }, [user]);

  const fetchBlocks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      // Get users I blocked
      const { data: myBlocks, error: myError } = await supabase
        .from('blocks')
        .select('*')
        .eq('blocker_id', user.id);

      if (myError) throw myError;
      setBlockedUsers((myBlocks || []) as Block[]);

      // Get users who blocked me
      const { data: blockedBy, error: byError } = await supabase
        .from('blocks')
        .select('*')
        .eq('blocked_id', user.id);

      if (byError) throw byError;
      setBlockedByUsers((blockedBy || []) as Block[]);
    } catch (error) {
      console.error('[useBlocks] fetchBlocks error:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Check if a user is blocked (either direction)
  const isBlocked = useCallback((userId: string): boolean => {
    return blockedUsers.some(b => b.blocked_id === userId) ||
           blockedByUsers.some(b => b.blocker_id === userId);
  }, [blockedUsers, blockedByUsers]);

  // Check if I blocked this user
  const isBlockedByMe = useCallback((userId: string): boolean => {
    return blockedUsers.some(b => b.blocked_id === userId);
  }, [blockedUsers]);

  // Block a user (Tạm ngừng kết nối)
  const blockUser = useCallback(async (
    blockedId: string, 
    reason?: string
  ): Promise<{ error: Error | null }> => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const { error } = await supabase
        .from('blocks')
        .insert({
          blocker_id: user.id,
          blocked_id: blockedId,
          reason,
        });

      if (error) throw error;

      // Refresh blocks
      await fetchBlocks();
      return { error: null };
    } catch (error) {
      console.error('[useBlocks] blockUser error:', error);
      return { error: error instanceof Error ? error : new Error('Failed to block user') };
    }
  }, [user, fetchBlocks]);

  // Unblock a user (Khôi phục kết nối)
  const unblockUser = useCallback(async (blockedId: string): Promise<{ error: Error | null }> => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const { error } = await supabase
        .from('blocks')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', blockedId);

      if (error) throw error;

      // Refresh blocks
      await fetchBlocks();
      return { error: null };
    } catch (error) {
      console.error('[useBlocks] unblockUser error:', error);
      return { error: error instanceof Error ? error : new Error('Failed to unblock user') };
    }
  }, [user, fetchBlocks]);

  // Report a user (Gửi phản hồi về người dùng)
  const reportUser = useCallback(async (
    reportedUserId: string,
    reason: string,
    details?: string
  ): Promise<{ error: Error | null }> => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const { error } = await supabase
        .from('reports')
        .insert({
          reporter_id: user.id,
          reported_user_id: reportedUserId,
          reason,
          details,
        });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('[useBlocks] reportUser error:', error);
      return { error: error instanceof Error ? error : new Error('Failed to report user') };
    }
  }, [user]);

  // Report a message (Gửi phản hồi về tin nhắn)
  const reportMessage = useCallback(async (
    messageId: string,
    reportedUserId: string,
    reason: string,
    details?: string
  ): Promise<{ error: Error | null }> => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const { error } = await supabase
        .from('reports')
        .insert({
          reporter_id: user.id,
          reported_message_id: messageId,
          reported_user_id: reportedUserId,
          reason,
          details,
        });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('[useBlocks] reportMessage error:', error);
      return { error: error instanceof Error ? error : new Error('Failed to report message') };
    }
  }, [user]);

  return {
    blockedUsers,
    blockedByUsers,
    loading,
    isBlocked,
    isBlockedByMe,
    blockUser,
    unblockUser,
    reportUser,
    reportMessage,
    refetch: fetchBlocks,
  };
}

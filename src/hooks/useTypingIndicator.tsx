/**
 * Typing Indicator Hook (Simplified)
 * 
 * This hook only manages typing state - it does NOT create its own channel.
 * All Supabase Realtime subscriptions are handled by useSupabaseRealtime.
 * This prevents duplicate channel issues.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import type { TypingEventData } from '@/realtime/useSupabaseRealtime';

interface TypingUser {
  id: string;
  name: string;
}

export function useTypingIndicator() {
  const { profile } = useAuth();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  // Receive typing updates from external source (useMessages/useSupabaseRealtime callback)
  const setTypingUsersFromSSE = useCallback((users: TypingEventData[]) => {
    setTypingUsers(prev => {
      const filtered = users
        .filter(u => u.user_id !== profile?.id)
        .map(u => ({
          id: u.user_id,
          name: u.user_name,
        }));
      
      // Only update if changed to prevent unnecessary re-renders
      if (JSON.stringify(filtered) !== JSON.stringify(prev)) {
        return filtered;
      }
      return prev;
    });
  }, [profile?.id]);

  // Auto-clear typing users after 3 seconds of no updates
  useEffect(() => {
    if (typingUsers.length === 0) return;
    
    const timer = setTimeout(() => {
      setTypingUsers([]);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [typingUsers]);

  return {
    typingUsers,
    setTypingUsersFromSSE,
  };
}

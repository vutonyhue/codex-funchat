import { useEffect, useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type PresenceStatus = 'online' | 'away' | 'offline';

interface PresenceData {
  status: PresenceStatus;
  lastSeen: Date | null;
}

// Calculate presence status from last_seen timestamp
export function getPresenceStatus(lastSeen: string | null): PresenceStatus {
  if (!lastSeen) return 'offline';
  
  const now = new Date();
  const lastSeenDate = new Date(lastSeen);
  const diffMinutes = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60);
  
  if (diffMinutes < 2) return 'online';
  if (diffMinutes < 10) return 'away';
  return 'offline';
}

// Format last seen time
export function formatLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return 'Không xác định';
  
  const status = getPresenceStatus(lastSeen);
  if (status === 'online') return 'Đang hoạt động';
  
  const now = new Date();
  const lastSeenDate = new Date(lastSeen);
  const diffMinutes = Math.floor((now.getTime() - lastSeenDate.getTime()) / (1000 * 60));
  
  if (diffMinutes < 60) return `Hoạt động ${diffMinutes} phút trước`;
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Hoạt động ${diffHours} giờ trước`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Hoạt động ${diffDays} ngày trước`;
  
  return 'Đã lâu không hoạt động';
}

// Status color classes
export function getPresenceColor(status: PresenceStatus): string {
  switch (status) {
    case 'online': return 'bg-green-500';
    case 'away': return 'bg-yellow-500';
    case 'offline': return 'bg-muted-foreground/50';
  }
}

// Hook for tracking own presence (heartbeat)
export function usePresenceHeartbeat() {
  const { user } = useAuth();
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  const updatePresence = useCallback(async () => {
    if (!user) return;

    try {
      await supabase
        .from('profiles')
        .update({ 
          last_seen: new Date().toISOString(),
          status: 'online'
        })
        .eq('id', user.id);
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Initial update
    updatePresence();

    // Set up heartbeat every 30 seconds
    heartbeatRef.current = setInterval(updatePresence, 30000);

    // Update on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updatePresence();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, updatePresence]);
}

// Hook for watching another user's presence
export function useUserPresence(userId: string | null | undefined): PresenceData {
  const [presenceData, setPresenceData] = useState<PresenceData>({
    status: 'offline',
    lastSeen: null,
  });

  useEffect(() => {
    if (!userId) return;

    // Fetch initial presence
    const fetchPresence = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('last_seen')
        .eq('id', userId)
        .single();

      if (data?.last_seen) {
        setPresenceData({
          status: getPresenceStatus(data.last_seen),
          lastSeen: new Date(data.last_seen),
        });
      }
    };

    fetchPresence();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`presence-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const lastSeen = payload.new.last_seen;
          if (lastSeen) {
            setPresenceData({
              status: getPresenceStatus(lastSeen),
              lastSeen: new Date(lastSeen),
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return presenceData;
}

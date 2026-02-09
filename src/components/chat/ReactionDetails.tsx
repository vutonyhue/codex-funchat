import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ReactionDetailsProps {
  emoji: string;
  count: number;
  userIds: string[];
  hasReacted: boolean;
  onClick?: () => void;
  className?: string;
}

interface UserProfile {
  id: string;
  display_name: string | null;
  username: string;
  avatar_url: string | null;
}

export default function ReactionDetails({
  emoji,
  count,
  userIds,
  hasReacted,
  onClick,
  className,
}: ReactionDetailsProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // Fetch user profiles when hover opens
  const handleOpenChange = async (open: boolean) => {
    if (open && !hasFetched && userIds.length > 0) {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .in('id', userIds);

        if (error) {
          console.error('Error fetching reaction users:', error);
        } else {
          setUsers(data || []);
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
        setHasFetched(true);
      }
    }
  };

  // Reset when userIds change
  useEffect(() => {
    setHasFetched(false);
    setUsers([]);
  }, [userIds.join(',')]);

  const getDisplayName = (u: UserProfile) => {
    if (u.id === user?.id) return 'Bạn';
    return u.display_name || u.username || 'Người dùng';
  };

  return (
    <HoverCard openDelay={200} closeDelay={100} onOpenChange={handleOpenChange}>
      <HoverCardTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors",
            hasReacted
              ? "bg-primary/20 text-primary border border-primary/30"
              : "bg-muted hover:bg-muted/80 text-muted-foreground",
            className
          )}
        >
          <span className="text-sm">{emoji}</span>
          <span className="font-medium">{count}</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent 
        className="w-48 p-2" 
        side="top" 
        align="start"
        sideOffset={4}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 pb-1 border-b mb-1.5">
            <span className="text-lg">{emoji}</span>
            <span className="text-xs text-muted-foreground">({count})</span>
          </div>
          
          {loading ? (
            <div className="space-y-1.5">
              {[...Array(Math.min(3, count))].map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="w-4 h-4 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {users.slice(0, 10).map((u) => (
                <div key={u.id} className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">•</span>
                  <span className={cn(
                    "truncate",
                    u.id === user?.id && "font-medium text-primary"
                  )}>
                    {getDisplayName(u)}
                  </span>
                </div>
              ))}
              {users.length > 10 && (
                <div className="text-xs text-muted-foreground pl-4">
                  và {users.length - 10} người khác...
                </div>
              )}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

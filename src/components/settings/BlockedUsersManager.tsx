import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBlocks } from '@/hooks/useBlocks';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { UserCheck, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

interface BlockedUser {
  id: string;
  blocked_id: string;
  created_at: string;
  reason: string | null;
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export default function BlockedUsersManager() {
  const { user } = useAuth();
  const { unblockUser } = useBlocks();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<string | null>(null);
  const [confirmUnblock, setConfirmUnblock] = useState<BlockedUser | null>(null);

  // Fetch blocked users
  useEffect(() => {
    const fetchBlocked = async () => {
      if (!user) return;

      setLoading(true);
      
      // First get blocks
      const { data: blocks, error } = await supabase
        .from('blocks')
        .select('id, blocked_id, created_at, reason')
        .eq('blocker_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching blocks:', error);
        setLoading(false);
        return;
      }

      if (!blocks || blocks.length === 0) {
        setBlockedUsers([]);
        setLoading(false);
        return;
      }

      // Get profiles for blocked users
      const blockedIds = blocks.map(b => b.blocked_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', blockedIds);

      // Combine data
      const combined = blocks.map(block => ({
        ...block,
        profile: profiles?.find(p => p.id === block.blocked_id) || null,
      }));

      setBlockedUsers(combined);
      setLoading(false);
    };

    fetchBlocked();
  }, [user]);

  const handleUnblock = async (blockedUser: BlockedUser) => {
    setUnblocking(blockedUser.blocked_id);
    
    const { error } = await unblockUser(blockedUser.blocked_id);
    
    if (error) {
      toast.error('Không thể khôi phục kết nối. Vui lòng thử lại.');
    } else {
      toast.success('Đã khôi phục kết nối');
      setBlockedUsers(prev => prev.filter(b => b.blocked_id !== blockedUser.blocked_id));
    }
    
    setUnblocking(null);
    setConfirmUnblock(null);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Kết nối đã tạm ngừng
          </CardTitle>
          <CardDescription>
            Quản lý những người bạn đã tạm ngừng kết nối
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl border">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-9 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Kết nối đã tạm ngừng
        </CardTitle>
        <CardDescription>
          Quản lý những người bạn đã tạm ngừng kết nối
        </CardDescription>
      </CardHeader>
      <CardContent>
        {blockedUsers.length === 0 ? (
          <div className="text-center py-8">
            <UserCheck className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Bạn chưa tạm ngừng kết nối với ai
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              {blockedUsers.map((blocked) => (
                <div
                  key={blocked.id}
                  className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={blocked.profile?.avatar_url || undefined} />
                    <AvatarFallback className="gradient-accent text-white text-sm font-semibold">
                      {blocked.profile?.display_name?.slice(0, 2).toUpperCase() || 
                       blocked.profile?.username?.slice(0, 2).toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {blocked.profile?.display_name || blocked.profile?.username || 'Người dùng'}
                    </p>
                    {blocked.reason && (
                      <p className="text-xs text-muted-foreground truncate">
                        {blocked.reason}
                      </p>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmUnblock(blocked)}
                    disabled={unblocking === blocked.blocked_id}
                  >
                    {unblocking === blocked.blocked_id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4 mr-1" />
                        Khôi phục
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* Confirm Unblock Dialog */}
      <AlertDialog open={!!confirmUnblock} onOpenChange={(open) => !open && setConfirmUnblock(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Khôi phục kết nối?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có muốn khôi phục kết nối với{' '}
              <span className="font-medium text-foreground">
                {confirmUnblock?.profile?.display_name || confirmUnblock?.profile?.username || 'người này'}
              </span>
              ? Họ sẽ có thể nhắn tin cho bạn trở lại.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmUnblock && handleUnblock(confirmUnblock)}
              className="gradient-primary text-white"
            >
              Khôi phục kết nối
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

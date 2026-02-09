import { useState } from 'react';
import { Conversation, ConversationMember } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { toast } from 'sonner';
import { 
  MoreVertical, 
  Shield, 
  ShieldOff, 
  UserMinus, 
  Crown 
} from 'lucide-react';
import { updateMemberRole, removeMember } from '@/lib/groupAdmin';

interface MemberManagementProps {
  conversation: Conversation;
  isAdmin: boolean;
  onMemberUpdated?: () => void;
}

export default function MemberManagement({
  conversation,
  isAdmin,
  onMemberUpdated,
}: MemberManagementProps) {
  const { user } = useAuth();
  const [removingMember, setRemovingMember] = useState<ConversationMember | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const members = conversation.members || [];
  const isCreator = (memberId: string) => conversation.created_by === memberId;

  const handlePromoteToAdmin = async (member: ConversationMember) => {
    setLoading(member.id);
    const { error } = await updateMemberRole(member.id, 'admin');
    
    if (error) {
      toast.error('Không thể bổ nhiệm admin');
    } else {
      toast.success(`Đã bổ nhiệm ${member.profile?.display_name || member.profile?.username} làm admin`);
      onMemberUpdated?.();
    }
    setLoading(null);
  };

  const handleDemoteFromAdmin = async (member: ConversationMember) => {
    setLoading(member.id);
    const { error } = await updateMemberRole(member.id, 'member');
    
    if (error) {
      toast.error('Không thể hạ chức admin');
    } else {
      toast.success(`Đã hạ chức ${member.profile?.display_name || member.profile?.username}`);
      onMemberUpdated?.();
    }
    setLoading(null);
  };

  const handleRemoveMember = async () => {
    if (!removingMember) return;

    setLoading(removingMember.id);
    const { error } = await removeMember(conversation.id, removingMember.user_id);
    
    if (error) {
      toast.error('Không thể xóa thành viên');
    } else {
      toast.success(`Đã xóa ${removingMember.profile?.display_name || removingMember.profile?.username} khỏi nhóm`);
      onMemberUpdated?.();
    }
    setLoading(null);
    setRemovingMember(null);
  };

  const getRoleBadge = (member: ConversationMember) => {
    if (isCreator(member.user_id)) {
      return (
        <Badge variant="default" className="gap-1 bg-warning/20 text-warning border-warning/30">
          <Crown className="w-3 h-3" />
          Người tạo
        </Badge>
      );
    }
    if (member.role === 'admin') {
      return (
        <Badge variant="secondary" className="gap-1">
          <Shield className="w-3 h-3" />
          Admin
        </Badge>
      );
    }
    return null;
  };

  const canManageMember = (member: ConversationMember) => {
    // Can't manage yourself or the creator
    if (member.user_id === user?.id) return false;
    if (isCreator(member.user_id)) return false;
    return isAdmin;
  };

  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground mb-4">
        {members.length} thành viên
      </div>

      {members.map((member) => (
        <div
          key={member.id}
          className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
        >
          <Avatar className="w-10 h-10">
            <AvatarImage src={member.profile?.avatar_url || undefined} />
            <AvatarFallback className="gradient-primary text-white font-medium">
              {(member.profile?.display_name || member.profile?.username || 'U')
                .slice(0, 2)
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">
                {member.profile?.display_name || member.profile?.username}
              </span>
              {member.user_id === user?.id && (
                <span className="text-xs text-muted-foreground">(Bạn)</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {getRoleBadge(member)}
              {!getRoleBadge(member) && (
                <span className="text-xs text-muted-foreground">Thành viên</span>
              )}
            </div>
          </div>

          {canManageMember(member) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-lg"
                  disabled={loading === member.id}
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {member.role === 'admin' ? (
                  <DropdownMenuItem onClick={() => handleDemoteFromAdmin(member)}>
                    <ShieldOff className="w-4 h-4 mr-2" />
                    Hạ chức Admin
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => handlePromoteToAdmin(member)}>
                    <Shield className="w-4 h-4 mr-2" />
                    Bổ nhiệm Admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setRemovingMember(member)}
                >
                  <UserMinus className="w-4 h-4 mr-2" />
                  Xóa khỏi nhóm
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      ))}

      {/* Confirm Remove Dialog */}
      <AlertDialog open={!!removingMember} onOpenChange={() => setRemovingMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa thành viên</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa{' '}
              <strong>
                {removingMember?.profile?.display_name || removingMember?.profile?.username}
              </strong>{' '}
              khỏi nhóm? Họ sẽ không thể xem tin nhắn trong nhóm nữa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-destructive hover:bg-destructive/90"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

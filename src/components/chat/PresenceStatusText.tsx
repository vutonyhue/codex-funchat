import { Conversation } from '@/types';
import { useUserPresence, formatLastSeen } from '@/hooks/usePresence';

interface PresenceStatusTextProps {
  conversation: Conversation;
  otherMemberId: string | undefined;
}

export default function PresenceStatusText({ 
  conversation, 
  otherMemberId 
}: PresenceStatusTextProps) {
  const { status, lastSeen } = useUserPresence(otherMemberId);
  
  if (conversation.is_group) {
    return (
      <p className="text-xs text-muted-foreground">
        {conversation.members?.length} thành viên
      </p>
    );
  }
  
  const lastSeenStr = otherMemberId 
    ? formatLastSeen(lastSeen?.toISOString() || null)
    : 'Không xác định';
  
  return (
    <p className="text-xs text-muted-foreground flex items-center gap-1">
      {status === 'online' && (
        <span className="w-2 h-2 rounded-full bg-green-500" />
      )}
      {lastSeenStr}
    </p>
  );
}

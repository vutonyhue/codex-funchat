import { Message } from '@/types';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Pin, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface PinnedMessagesProps {
  messages: Message[];
  onUnpin?: (messageId: string) => void;
  onMessageClick?: (messageId: string) => void;
  canUnpin?: boolean;
  className?: string;
}

export default function PinnedMessages({
  messages,
  onUnpin,
  onMessageClick,
  canUnpin = false,
  className,
}: PinnedMessagesProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (messages.length === 0) return null;

  const getPreview = (msg: Message) => {
    if (msg.message_type === 'image') return '📷 Hình ảnh';
    if (msg.message_type === 'file') return '📁 File';
    if (msg.message_type === 'crypto') return '💰 Crypto';
    if (msg.message_type === 'voice') return '🎤 Tin nhắn thoại';
    return msg.content?.slice(0, 60) + (msg.content && msg.content.length > 60 ? '...' : '');
  };

  // Show only 1 message when collapsed, all when expanded
  const visibleMessages = isExpanded ? messages : messages.slice(0, 1);

  return (
    <div className={cn('bg-card/80 backdrop-blur-sm border-b', className)}>
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => messages.length > 1 && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Pin className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary">
            Tin nhắn đã ghim
          </span>
          {messages.length > 1 && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {messages.length}
            </span>
          )}
        </div>
        {messages.length > 1 && (
          <Button variant="ghost" size="icon" className="w-6 h-6">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className={cn(isExpanded && messages.length > 3 ? 'max-h-48' : '')}>
        <div className="px-4 pb-2 space-y-2">
          {visibleMessages.map((message) => (
            <div
              key={message.id}
              className="flex items-start gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer group"
              onClick={() => onMessageClick?.(message.id)}
            >
              <Avatar className="w-8 h-8 shrink-0">
                <AvatarImage src={message.sender?.avatar_url || undefined} />
                <AvatarFallback className="gradient-accent text-white text-xs">
                  {message.sender?.display_name?.slice(0, 2).toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {message.sender?.display_name || 'Người dùng'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(message.created_at), 'HH:mm dd/MM', { locale: vi })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {getPreview(message)}
                </p>
              </div>

              {canUnpin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnpin?.(message.id);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

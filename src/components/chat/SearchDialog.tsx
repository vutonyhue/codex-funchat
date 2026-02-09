import { useState, useCallback, useEffect } from 'react';
import { Message } from '@/types';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Search, X, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  onSearch: (query: string) => Promise<Message[]>;
  onMessageClick?: (messageId: string) => void;
}

export default function SearchDialog({
  open,
  onClose,
  conversationId,
  onSearch,
  onMessageClick,
}: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setHasSearched(false);
    }
  }, [open]);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    
    try {
      const searchResults = await onSearch(searchQuery.trim());
      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [onSearch]);

  const debouncedSearch = useDebouncedCallback(performSearch, 300);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    debouncedSearch(value);
  };

  const getPreview = (msg: Message) => {
    if (msg.message_type === 'image') return '📷 Hình ảnh';
    if (msg.message_type === 'file') return '📁 File';
    if (msg.message_type === 'crypto') return '💰 Crypto';
    if (msg.message_type === 'voice') return '🎤 Tin nhắn thoại';
    return msg.content || '';
  };

  const highlightMatch = (text: string, searchQuery: string) => {
    if (!searchQuery.trim()) return text;
    
    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, i) => 
      regex.test(part) ? (
        <mark key={i} className="bg-primary/30 text-foreground rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            Tìm kiếm tin nhắn
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Nhập từ khóa tìm kiếm..."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              className="pl-9 pr-9"
              autoFocus
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7"
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  setHasSearched(false);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Results */}
          <ScrollArea className="max-h-80">
            {isSearching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-2">
                {results.map((message) => (
                  <div
                    key={message.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                    onClick={() => {
                      onMessageClick?.(message.id);
                      onClose();
                    }}
                  >
                    <Avatar className="w-9 h-9 shrink-0">
                      <AvatarImage src={message.sender?.avatar_url || undefined} />
                      <AvatarFallback className="gradient-accent text-white text-xs">
                        {message.sender?.display_name?.slice(0, 2).toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {message.sender?.display_name || 'Người dùng'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(message.created_at), 'HH:mm dd/MM/yyyy', { locale: vi })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {message.message_type === 'text' 
                          ? highlightMatch(message.content || '', query)
                          : getPreview(message)
                        }
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : hasSearched ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Search className="w-12 h-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Không tìm thấy tin nhắn nào
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Thử tìm với từ khóa khác
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Search className="w-12 h-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Nhập ít nhất 2 ký tự để tìm kiếm
                </p>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

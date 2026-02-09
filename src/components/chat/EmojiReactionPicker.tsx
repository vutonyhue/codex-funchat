import { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EMOJI_CATEGORIES, QUICK_REACTIONS, searchEmojis } from '@/data/emojiData';
import { cn } from '@/lib/utils';

interface EmojiReactionPickerProps {
  onSelect: (emoji: string) => void;
  onClose?: () => void;
  className?: string;
}

export default function EmojiReactionPicker({ 
  onSelect, 
  onClose,
  className 
}: EmojiReactionPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(EMOJI_CATEGORIES[0].id);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return searchEmojis(searchQuery);
  }, [searchQuery]);

  const handleEmojiClick = (emoji: string) => {
    onSelect(emoji);
    onClose?.();
  };

  const displayEmojis = searchResults ?? 
    EMOJI_CATEGORIES.find(c => c.id === activeCategory)?.emojis ?? [];

  return (
    <div className={cn("w-72 bg-popover rounded-lg border shadow-lg", className)}>
      {/* Search */}
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm emoji..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-8 h-8 text-sm"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0.5 top-1/2 -translate-y-1/2 w-6 h-6"
              onClick={() => setSearchQuery('')}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Emoji Grid */}
      <ScrollArea className="h-48 p-2">
        {displayEmojis.length > 0 ? (
          <div className="grid grid-cols-8 gap-0.5">
            {displayEmojis.map((emoji, index) => (
              <button
                key={`${emoji}-${index}`}
                className="w-8 h-8 flex items-center justify-center text-xl hover:bg-muted rounded transition-colors"
                onClick={() => handleEmojiClick(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : searchQuery ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Không tìm thấy emoji
          </div>
        ) : null}
      </ScrollArea>

      {/* Category Tabs */}
      {!searchQuery && (
        <div className="flex items-center justify-around p-1.5 border-t bg-muted/30">
          {EMOJI_CATEGORIES.map((category) => (
            <button
              key={category.id}
              className={cn(
                "w-7 h-7 flex items-center justify-center text-lg rounded transition-colors",
                activeCategory === category.id 
                  ? "bg-primary/10 text-primary" 
                  : "hover:bg-muted text-muted-foreground"
              )}
              onClick={() => setActiveCategory(category.id)}
              title={category.name}
            >
              {category.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Inline picker with quick reactions + expand button
interface QuickReactionBarProps {
  onReaction: (emoji: string) => void;
  className?: string;
}

export function QuickReactionBar({ onReaction, className }: QuickReactionBarProps) {
  const [showFullPicker, setShowFullPicker] = useState(false);

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          className="text-xl hover:scale-125 transition-transform p-1"
          onClick={() => onReaction(emoji)}
        >
          {emoji}
        </button>
      ))}
      
      <Popover open={showFullPicker} onOpenChange={setShowFullPicker}>
        <PopoverTrigger asChild>
          <button className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors">
            <span className="text-lg">+</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end" sideOffset={4}>
          <EmojiReactionPicker 
            onSelect={onReaction} 
            onClose={() => setShowFullPicker(false)} 
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * Mention Suggestions Component
 * Hiển thị gợi ý khi gõ @ trong input
 */
import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Sparkles, User } from 'lucide-react';

interface Suggestion {
  id: string;
  type: 'ai' | 'user';
  name: string;
  description?: string;
  avatar?: string;
}

interface MentionSuggestionsProps {
  inputValue: string;
  cursorPosition: number;
  onSelect: (mention: string) => void;
  onClose: () => void;
  members?: Array<{
    user_id: string;
    profile?: {
      display_name?: string | null;
      username?: string;
      avatar_url?: string | null;
    };
  }>;
}

export default function MentionSuggestions({
  inputValue,
  cursorPosition,
  onSelect,
  onClose,
  members = [],
}: MentionSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect @ trigger and filter suggestions
  useEffect(() => {
    // Find the @ symbol before cursor
    const textBeforeCursor = inputValue.slice(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex === -1) {
      setSuggestions([]);
      return;
    }

    // Check if there's a space after @
    const searchText = textBeforeCursor.slice(lastAtIndex + 1);
    if (searchText.includes(' ') || searchText.includes('\n')) {
      setSuggestions([]);
      return;
    }

    // Build suggestions
    const allSuggestions: Suggestion[] = [
      {
        id: 'angel',
        type: 'ai',
        name: 'Angel AI',
        description: 'Trợ lý AI thông minh',
      },
      // Add other members
      ...members
        .filter(m => m.profile)
        .map(m => ({
          id: m.user_id,
          type: 'user' as const,
          name: m.profile?.display_name || m.profile?.username || 'User',
          avatar: m.profile?.avatar_url || undefined,
        })),
    ];

    // Filter by search text
    const filtered = allSuggestions.filter(s =>
      s.name.toLowerCase().includes(searchText.toLowerCase())
    );

    setSuggestions(filtered);
    setSelectedIndex(0);
  }, [inputValue, cursorPosition, members]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => (i + 1) % suggestions.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => (i - 1 + suggestions.length) % suggestions.length);
          break;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          if (suggestions[selectedIndex]) {
            handleSelect(suggestions[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [suggestions, selectedIndex, onClose]);

  const handleSelect = (suggestion: Suggestion) => {
    const mention = suggestion.type === 'ai' ? '@angel ' : `@${suggestion.name} `;
    onSelect(mention);
    onClose();
  };

  if (suggestions.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 mb-2 w-64 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50"
    >
      <div className="p-2 space-y-1">
        {suggestions.map((suggestion, index) => (
          <button
            key={suggestion.id}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors",
              index === selectedIndex 
                ? "bg-accent text-accent-foreground" 
                : "hover:bg-muted"
            )}
            onClick={() => handleSelect(suggestion)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            {suggestion.type === 'ai' ? (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                {suggestion.avatar ? (
                  <img 
                    src={suggestion.avatar} 
                    alt={suggestion.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <User className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{suggestion.name}</p>
              {suggestion.description && (
                <p className="text-xs text-muted-foreground truncate">
                  {suggestion.description}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

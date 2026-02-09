import { useState, useEffect, useMemo } from 'react';
import { FileText, Search, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { MessageTemplate } from '@/hooks/useTemplates';

interface TemplatesMenuProps {
  templates: MessageTemplate[];
  inputValue: string;
  onSelect: (template: MessageTemplate) => void;
  onClose: () => void;
  onCreateNew?: () => void;
}

export function TemplatesMenu({
  templates,
  inputValue,
  onSelect,
  onClose,
  onCreateNew,
}: TemplatesMenuProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Extract command from input (after /)
  const commandQuery = useMemo(() => {
    if (inputValue.startsWith('/')) {
      return inputValue.slice(1).toLowerCase();
    }
    return '';
  }, [inputValue]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    const query = searchQuery || commandQuery;
    if (!query) return templates;

    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.content.toLowerCase().includes(query) ||
        (t.shortcut && t.shortcut.toLowerCase().includes(query))
    );
  }, [templates, searchQuery, commandQuery]);

  // Auto-select exact match
  useEffect(() => {
    if (commandQuery && !searchQuery) {
      const exactMatch = templates.find(
        (t) => t.shortcut?.toLowerCase() === commandQuery
      );
      if (exactMatch) {
        // Don't auto-select, let user press Enter or click
      }
    }
  }, [commandQuery, searchQuery, templates]);

  if (templates.length === 0) {
    return (
      <div className="absolute bottom-full left-0 mb-2 w-80 rounded-lg border bg-popover p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Mẫu tin nhắn</span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground text-center py-4">
          Chưa có mẫu tin nhắn nào
        </p>
        {onCreateNew && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onCreateNew}
          >
            <Plus className="h-4 w-4 mr-2" />
            Tạo mẫu mới
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="absolute bottom-full left-0 mb-2 w-80 rounded-lg border bg-popover shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Mẫu tin nhắn</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm mẫu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Templates list */}
      <ScrollArea className="max-h-60">
        {filteredTemplates.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Không tìm thấy mẫu nào
          </div>
        ) : (
          <div className="p-1">
            {filteredTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => onSelect(template)}
                className={cn(
                  'w-full text-left p-2 rounded-md hover:bg-accent transition-colors',
                  'flex flex-col gap-1'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate">
                    {template.name}
                  </span>
                  {template.shortcut && (
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      /{template.shortcut}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground line-clamp-2">
                  {template.content}
                </span>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      {onCreateNew && (
        <div className="p-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={onCreateNew}
          >
            <Plus className="h-4 w-4 mr-2" />
            Tạo mẫu mới
          </Button>
        </div>
      )}
    </div>
  );
}

export default TemplatesMenu;

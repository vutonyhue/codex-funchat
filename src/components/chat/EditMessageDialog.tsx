import { useState, useEffect, useRef } from 'react';
import { Message } from '@/types';
import { Pencil, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface EditMessageDialogProps {
  open: boolean;
  onClose: () => void;
  message: Message | null;
  onSave: (messageId: string, newContent: string) => Promise<void>;
}

export default function EditMessageDialog({
  open,
  onClose,
  message,
  onSave,
}: EditMessageDialogProps) {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync content when message changes
  useEffect(() => {
    if (message?.content) {
      setContent(message.content);
    }
  }, [message]);

  // Focus textarea when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.select();
      }, 100);
    }
  }, [open]);

  const handleSave = async () => {
    if (!message || !content.trim()) return;
    if (content.trim() === message.content) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      await onSave(message.id, content.trim());
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-primary" />
            Sửa tin nhắn
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nhập nội dung tin nhắn..."
            className="min-h-[100px] resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Nhấn Enter để lưu, Shift+Enter để xuống dòng
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Hủy
          </Button>
          <Button
            onClick={handleSave}
            disabled={!content.trim() || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Đang lưu...
              </>
            ) : (
              'Lưu thay đổi'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

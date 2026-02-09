import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Clock, X, Edit2, Trash2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  listScheduledMessages,
  updateScheduledMessage,
  cancelScheduledMessage,
  ScheduledMessage,
} from '@/lib/scheduledMessages';

interface ScheduledMessagesListProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
}

export default function ScheduledMessagesList({
  open,
  onOpenChange,
  conversationId,
}: ScheduledMessagesListProps) {
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editDate, setEditDate] = useState('');

  useEffect(() => {
    if (open) {
      fetchMessages();
    }
  }, [open, conversationId]);

  const fetchMessages = async () => {
    setLoading(true);
    const data = await listScheduledMessages(conversationId);
    setMessages(data);
    setLoading(false);
  };

  const handleCancel = async (id: string) => {
    const { error } = await cancelScheduledMessage(id);
    if (error) {
      toast.error('Không thể hủy tin nhắn');
    } else {
      toast.success('Đã hủy tin nhắn đặt lịch');
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }
  };

  const handleStartEdit = (msg: ScheduledMessage) => {
    setEditingId(msg.id);
    setEditContent(msg.content || '');
    const d = new Date(msg.scheduled_at);
    setEditDate(format(d, 'yyyy-MM-dd'));
    setEditTime(format(d, 'HH:mm'));
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    const scheduledAt = new Date(`${editDate}T${editTime}:00`);
    const { error } = await updateScheduledMessage(editingId, {
      content: editContent,
      scheduled_at: scheduledAt.toISOString(),
    });

    if (error) {
      toast.error('Không thể cập nhật tin nhắn');
    } else {
      toast.success('Đã cập nhật tin nhắn');
      setEditingId(null);
      fetchMessages();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Tin nhắn đã đặt lịch
          </DialogTitle>
          <DialogDescription>
            Quản lý các tin nhắn chờ gửi
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Chưa có tin nhắn nào được đặt lịch</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className="p-3 rounded-lg border bg-card">
                  {editingId === msg.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={2}
                        className="text-sm"
                      />
                      <div className="flex gap-2">
                        <Input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="text-sm"
                        />
                        <Input
                          type="time"
                          value={editTime}
                          onChange={(e) => setEditTime(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                          Hủy
                        </Button>
                        <Button size="sm" onClick={handleSaveEdit}>
                          Lưu
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm line-clamp-2 mb-2">{msg.content}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          📅 {format(new Date(msg.scheduled_at), "HH:mm dd/MM/yyyy", { locale: vi })}
                        </p>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleStartEdit(msg)}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleCancel(msg.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

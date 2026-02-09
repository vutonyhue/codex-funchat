/**
 * Dialog "Tạm ngừng kết nối" (Block User)
 * 5D Light Language - Ngôn ngữ tử tế, ấm áp
 */
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { UserMinus, Loader2 } from 'lucide-react';

interface BlockUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  onConfirm: (reason?: string) => Promise<void>;
}

export default function BlockUserDialog({
  open,
  onOpenChange,
  userName,
  onConfirm,
}: BlockUserDialogProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(reason || undefined);
      setReason('');
      onOpenChange(false);
    } catch (error) {
      console.error('Block error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserMinus className="w-5 h-5 text-muted-foreground" />
            Tạm ngừng kết nối
          </DialogTitle>
          <DialogDescription className="text-left">
            Bạn sắp tạm ngừng kết nối với <strong>{userName}</strong>. 
            Điều này có nghĩa là:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm text-muted-foreground">
          <ul className="space-y-2 ml-4 list-disc">
            <li>Bạn sẽ không nhận được tin nhắn từ người này</li>
            <li>Người này sẽ không thể gửi tin nhắn cho bạn</li>
            <li>Cuộc trò chuyện hiện tại sẽ bị ẩn</li>
            <li>Bạn có thể khôi phục kết nối bất cứ lúc nào</li>
          </ul>
        </div>

        <div className="space-y-2 mt-2">
          <Label htmlFor="reason" className="text-sm">
            Lý do (tuỳ chọn)
          </Label>
          <Textarea
            id="reason"
            placeholder="Chia sẻ lý do để chúng tôi hiểu rõ hơn..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="resize-none"
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Thông tin này chỉ được lưu trữ riêng tư và giúp cải thiện trải nghiệm.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Huỷ
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className="bg-muted-foreground hover:bg-muted-foreground/90"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Xác nhận tạm ngừng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

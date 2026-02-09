/**
 * Dialog "Gửi phản hồi" (Report)
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MessageCircleWarning, Loader2, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

// 5D Light Language - Reason options
const REPORT_REASONS = [
  { value: 'unwanted', label: 'Tin nhắn không mong muốn', description: 'Nhận quá nhiều tin nhắn hoặc nội dung không liên quan' },
  { value: 'inappropriate', label: 'Nội dung không phù hợp', description: 'Ngôn ngữ hoặc hình ảnh gây khó chịu' },
  { value: 'scam', label: 'Đáng ngờ về tài chính', description: 'Yêu cầu chuyển tiền hoặc thông tin cá nhân đáng ngờ' },
  { value: 'impersonation', label: 'Giả mạo danh tính', description: 'Người này giả vờ là người khác' },
  { value: 'other', label: 'Lý do khác', description: 'Mô tả chi tiết bên dưới' },
];

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'user' | 'message';
  targetName: string;
  onConfirm: (reason: string, details?: string) => Promise<void>;
}

export default function ReportDialog({
  open,
  onOpenChange,
  type,
  targetName,
  onConfirm,
}: ReportDialogProps) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!reason) return;
    
    setLoading(true);
    try {
      await onConfirm(reason, details || undefined);
      setReason('');
      setDetails('');
      onOpenChange(false);
    } catch (error) {
      console.error('Report error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setReason('');
      setDetails('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircleWarning className="w-5 h-5 text-amber-500" />
            Gửi phản hồi
          </DialogTitle>
          <DialogDescription className="text-left">
            {type === 'message' 
              ? `Phản hồi về tin nhắn từ ${targetName}`
              : `Phản hồi về ${targetName}`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Điều gì khiến bạn không thoải mái?
            </Label>
            <RadioGroup value={reason} onValueChange={setReason}>
              {REPORT_REASONS.map((r) => (
                <div
                  key={r.value}
                  className={cn(
                    "flex items-start space-x-3 rounded-lg border p-3 transition-colors cursor-pointer",
                    reason === r.value 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:bg-muted/50'
                  )}
                  onClick={() => setReason(r.value)}
                >
                  <RadioGroupItem value={r.value} id={r.value} className="mt-0.5" />
                  <div className="flex-1 space-y-0.5">
                    <Label htmlFor={r.value} className="font-medium cursor-pointer">
                      {r.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{r.description}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="details" className="text-sm">
              Chi tiết thêm (tuỳ chọn)
            </Label>
            <Textarea
              id="details"
              placeholder="Chia sẻ thêm để giúp chúng tôi hiểu rõ hơn..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-accent text-sm">
            <Heart className="w-4 h-4 text-accent-foreground mt-0.5 flex-shrink-0" />
            <p className="text-accent-foreground">
              Cảm ơn bạn đã giúp FUN Chat trở thành không gian an toàn và tử tế hơn. 
              Phản hồi của bạn sẽ được xem xét trong vòng 24 giờ.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Huỷ
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !reason}
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Gửi phản hồi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

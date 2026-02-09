/**
 * Dialog tạo Red Envelope (Lì xì)
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Gift, Loader2, Shuffle, Equal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RedEnvelopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maxRecipients: number; // Number of members in conversation
  onConfirm: (params: {
    totalAmount: number;
    currency: string;
    totalRecipients: number;
    distributionType: 'random' | 'equal';
    message?: string;
  }) => Promise<void>;
}

export default function RedEnvelopeDialog({
  open,
  onOpenChange,
  maxRecipients,
  onConfirm,
}: RedEnvelopeDialogProps) {
  const [totalAmount, setTotalAmount] = useState('');
  const [currency, setCurrency] = useState('CAMLY');
  const [totalRecipients, setTotalRecipients] = useState('');
  const [distributionType, setDistributionType] = useState<'random' | 'equal'>('random');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    const amount = parseFloat(totalAmount);
    const recipients = parseInt(totalRecipients);

    if (isNaN(amount) || amount <= 0) return;
    if (isNaN(recipients) || recipients <= 0 || recipients > maxRecipients) return;

    setLoading(true);
    try {
      await onConfirm({
        totalAmount: amount,
        currency,
        totalRecipients: recipients,
        distributionType,
        message: message || undefined,
      });
      
      // Reset form
      setTotalAmount('');
      setTotalRecipients('');
      setMessage('');
      onOpenChange(false);
    } catch (error) {
      console.error('Create envelope error:', error);
    } finally {
      setLoading(false);
    }
  };

  const minAmountPerPerson = distributionType === 'random' 
    ? 0.01 
    : parseFloat(totalAmount) / parseInt(totalRecipients || '1');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Gift className="w-5 h-5" />
            Gửi Lì xì
          </DialogTitle>
          <DialogDescription>
            Tạo lì xì để tặng cho mọi người trong nhóm chat
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Tổng số tiền</Label>
            <div className="flex gap-2">
              <Input
                id="amount"
                type="number"
                placeholder="100"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                min="0.01"
                step="0.01"
                className="flex-1"
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="px-3 py-2 border rounded-md bg-background"
              >
                <option value="CAMLY">CAMLY</option>
                <option value="BNB">BNB</option>
              </select>
            </div>
          </div>

          {/* Recipients */}
          <div className="space-y-2">
            <Label htmlFor="recipients">Số người nhận</Label>
            <Input
              id="recipients"
              type="number"
              placeholder={`Tối đa ${maxRecipients}`}
              value={totalRecipients}
              onChange={(e) => setTotalRecipients(e.target.value)}
              min="1"
              max={maxRecipients}
            />
            <p className="text-xs text-muted-foreground">
              Tối đa {maxRecipients} người (số thành viên trong nhóm)
            </p>
          </div>

          {/* Distribution Type */}
          <div className="space-y-2">
            <Label>Cách chia</Label>
            <RadioGroup
              value={distributionType}
              onValueChange={(v) => setDistributionType(v as 'random' | 'equal')}
              className="grid grid-cols-2 gap-3"
            >
              <div
                className={cn(
                  "flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors",
                  distributionType === 'random'
                    ? 'border-red-500 bg-red-50 dark:bg-red-950/30'
                    : 'border-border hover:bg-muted/50'
                )}
                onClick={() => setDistributionType('random')}
              >
                <RadioGroupItem value="random" id="random" />
                <div className="flex items-center gap-2">
                  <Shuffle className="w-4 h-4 text-red-500" />
                  <Label htmlFor="random" className="cursor-pointer">Ngẫu nhiên</Label>
                </div>
              </div>
              <div
                className={cn(
                  "flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors",
                  distributionType === 'equal'
                    ? 'border-red-500 bg-red-50 dark:bg-red-950/30'
                    : 'border-border hover:bg-muted/50'
                )}
                onClick={() => setDistributionType('equal')}
              >
                <RadioGroupItem value="equal" id="equal" />
                <div className="flex items-center gap-2">
                  <Equal className="w-4 h-4 text-red-500" />
                  <Label htmlFor="equal" className="cursor-pointer">Chia đều</Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Lời chúc (tuỳ chọn)</Label>
            <Textarea
              id="message"
              placeholder="Chúc mừng năm mới! 🎊"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="resize-none"
              rows={2}
              maxLength={100}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Huỷ
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !totalAmount || !totalRecipients}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Gift className="w-4 h-4 mr-2" />
            Gửi lì xì
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

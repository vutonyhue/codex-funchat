import { useState } from 'react';
import { format, addMinutes, isBefore, addDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Clock, CalendarIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ScheduleMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageContent: string;
  onSchedule: (scheduledAt: Date) => void;
}

export default function ScheduleMessageDialog({
  open,
  onOpenChange,
  messageContent,
  onSchedule,
}: ScheduleMessageDialogProps) {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState('');

  const handleSchedule = () => {
    if (!date || !time) {
      toast.error('Vui lòng chọn ngày và giờ');
      return;
    }

    const [hours, minutes] = time.split(':').map(Number);
    const scheduledAt = new Date(date);
    scheduledAt.setHours(hours, minutes, 0, 0);

    const minTime = addMinutes(new Date(), 1);
    if (isBefore(scheduledAt, minTime)) {
      toast.error('Thời gian phải ít nhất 1 phút trong tương lai');
      return;
    }

    const maxTime = addDays(new Date(), 30);
    if (isBefore(maxTime, scheduledAt)) {
      toast.error('Tối đa đặt lịch trước 30 ngày');
      return;
    }

    onSchedule(scheduledAt);
    onOpenChange(false);
    setDate(undefined);
    setTime('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Đặt lịch gửi tin nhắn
          </DialogTitle>
          <DialogDescription>
            Chọn thời gian để tin nhắn được gửi tự động
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Message preview */}
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-xs text-muted-foreground mb-1">Nội dung tin nhắn:</p>
            <p className="text-sm line-clamp-3">{messageContent}</p>
          </div>

          {/* Date picker */}
          <div className="space-y-2">
            <Label>Ngày gửi</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'dd/MM/yyyy', { locale: vi }) : 'Chọn ngày'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => isBefore(d, addMinutes(new Date(), -1)) || isBefore(addDays(new Date(), 30), d)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time picker */}
          <div className="space-y-2">
            <Label>Giờ gửi</Label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Preview */}
          {date && time && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm text-primary font-medium">
                📅 Tin nhắn sẽ được gửi lúc {time} ngày {format(date, 'dd/MM/yyyy')}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleSchedule} disabled={!date || !time}>
            Đặt lịch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

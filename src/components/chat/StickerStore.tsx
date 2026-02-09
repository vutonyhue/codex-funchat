import { useState } from 'react';
import { useStickers } from '@/hooks/useStickers';
import { StickerPack } from '@/types/stickers';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, Crown, Download } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface StickerStoreProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function StickerStore({ open, onOpenChange }: StickerStoreProps) {
  const { packs, loading, ownsPack, acquirePack, removePack } = useStickers();
  const [processingPackId, setProcessingPackId] = useState<string | null>(null);

  const handleAcquire = async (pack: StickerPack) => {
    if (pack.is_premium && pack.price > 0) {
      toast.error('Gói sticker premium sẽ sớm có mặt!');
      return;
    }

    setProcessingPackId(pack.id);
    const { error } = await acquirePack(pack.id);
    setProcessingPackId(null);

    if (error) {
      toast.error('Không thể thêm bộ sticker');
    } else {
      toast.success(`Đã thêm "${pack.name}"`);
    }
  };

  const handleRemove = async (pack: StickerPack) => {
    setProcessingPackId(pack.id);
    const { error } = await removePack(pack.id);
    setProcessingPackId(null);

    if (error) {
      toast.error('Không thể xóa bộ sticker');
    } else {
      toast.success(`Đã xóa "${pack.name}"`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🎨 Kho Sticker
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[400px] -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {packs.map((pack) => {
                const owned = ownsPack(pack.id);
                const isProcessing = processingPackId === pack.id;

                return (
                  <div
                    key={pack.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border",
                      owned ? "border-primary/30 bg-primary/5" : "border-border"
                    )}
                  >
                    {/* Preview */}
                    <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <img
                        src={pack.preview_url || ''}
                        alt={pack.name}
                        className="w-10 h-10 object-contain"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium truncate">{pack.name}</h4>
                        {pack.is_premium && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <Crown className="w-3 h-3" />
                            Premium
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {pack.description}
                      </p>
                      {pack.is_premium && pack.price > 0 && (
                        <p className="text-sm font-medium text-primary">
                          {pack.price} {pack.currency}
                        </p>
                      )}
                    </div>

                    {/* Action button */}
                    <div className="flex-shrink-0">
                      {owned ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemove(pack)}
                          disabled={isProcessing}
                          className="text-muted-foreground"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="w-4 h-4 mr-1" />
                              Đã có
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleAcquire(pack)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Download className="w-4 h-4 mr-1" />
                              Thêm
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

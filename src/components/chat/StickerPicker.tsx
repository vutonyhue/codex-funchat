import { useState, useEffect } from 'react';
import { useStickers } from '@/hooks/useStickers';
import { Sticker, StickerPack } from '@/types/stickers';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Sticker as StickerIcon, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StickerPickerProps {
  onSelect: (sticker: Sticker) => void;
  onOpenStore?: () => void;
}

export default function StickerPicker({ onSelect, onOpenStore }: StickerPickerProps) {
  const { ownedPacks, loading, fetchStickersForPack, getStickersForPack } = useStickers();
  const [open, setOpen] = useState(false);
  const [activePackId, setActivePackId] = useState<string | null>(null);
  const [loadingStickers, setLoadingStickers] = useState(false);

  // Set initial active pack
  useEffect(() => {
    if (ownedPacks.length > 0 && !activePackId) {
      setActivePackId(ownedPacks[0].id);
    }
  }, [ownedPacks, activePackId]);

  // Load stickers when pack changes
  useEffect(() => {
    if (!activePackId) return;
    
    const loadStickers = async () => {
      setLoadingStickers(true);
      await fetchStickersForPack(activePackId);
      setLoadingStickers(false);
    };
    
    loadStickers();
  }, [activePackId, fetchStickersForPack]);

  const handleSelectSticker = (sticker: Sticker) => {
    onSelect(sticker);
    setOpen(false);
  };

  const currentStickers = activePackId ? getStickersForPack(activePackId) : [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="rounded-xl text-muted-foreground hover:text-primary"
        >
          <StickerIcon className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0" 
        align="start"
        side="top"
        sideOffset={10}
      >
        {loading ? (
          <div className="p-4 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : ownedPacks.length === 0 ? (
          <div className="p-6 text-center">
            <StickerIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground mb-3">
              Bạn chưa có bộ sticker nào
            </p>
            <Button size="sm" onClick={onOpenStore}>
              <Plus className="w-4 h-4 mr-1" />
              Khám phá Sticker
            </Button>
          </div>
        ) : (
          <Tabs 
            value={activePackId || undefined} 
            onValueChange={setActivePackId}
            className="w-full"
          >
            {/* Pack tabs */}
            <div className="border-b">
              <ScrollArea className="w-full">
                <TabsList className="h-12 w-full justify-start rounded-none bg-transparent px-2">
                  {ownedPacks.map((pack) => (
                    <TabsTrigger
                      key={pack.id}
                      value={pack.id}
                      className="h-10 w-10 p-0 rounded-lg data-[state=active]:bg-muted"
                    >
                      <img
                        src={pack.preview_url || ''}
                        alt={pack.name}
                        className="w-6 h-6 object-contain"
                      />
                    </TabsTrigger>
                  ))}
                  {/* Add more button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-lg"
                    onClick={onOpenStore}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </TabsList>
              </ScrollArea>
            </div>

            {/* Stickers grid */}
            {ownedPacks.map((pack) => (
              <TabsContent key={pack.id} value={pack.id} className="m-0">
                <ScrollArea className="h-64">
                  <div className="p-2">
                    {loadingStickers && activePackId === pack.id ? (
                      <div className="grid grid-cols-4 gap-2">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <Skeleton key={i} className="w-full aspect-square rounded-lg" />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {currentStickers.map((sticker) => (
                          <button
                            key={sticker.id}
                            onClick={() => handleSelectSticker(sticker)}
                            className={cn(
                              "w-full aspect-square rounded-lg p-2",
                              "hover:bg-muted transition-colors",
                              "focus:outline-none focus:ring-2 focus:ring-primary"
                            )}
                          >
                            <img
                              src={sticker.url}
                              alt={sticker.name}
                              className="w-full h-full object-contain"
                              loading="lazy"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </PopoverContent>
    </Popover>
  );
}

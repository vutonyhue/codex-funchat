import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Copy, RefreshCw, Share2, Link2, Loader2 } from 'lucide-react';
import { getInviteLink, generateInviteLink } from '@/lib/groupAdmin';

interface InviteLinkCardProps {
  conversationId: string;
  isAdmin: boolean;
}

export default function InviteLinkCard({ conversationId, isAdmin }: InviteLinkCardProps) {
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const baseUrl = window.location.origin;
  const fullLink = inviteCode ? `${baseUrl}/join/${inviteCode}` : null;

  useEffect(() => {
    const fetchLink = async () => {
      setLoading(true);
      const { data } = await getInviteLink(conversationId);
      setInviteCode(data);
      setLoading(false);
    };
    fetchLink();
  }, [conversationId]);

  const handleGenerateLink = async () => {
    setGenerating(true);
    const { data, error } = await generateInviteLink(conversationId);
    
    if (error) {
      toast.error('Không thể tạo link mời');
    } else if (data) {
      setInviteCode(data);
      toast.success('Đã tạo link mời mới');
    }
    setGenerating(false);
  };

  const handleCopy = async () => {
    if (!fullLink) return;
    
    try {
      await navigator.clipboard.writeText(fullLink);
      toast.success('Đã sao chép link');
    } catch {
      toast.error('Không thể sao chép');
    }
  };

  const handleShare = async () => {
    if (!fullLink) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Tham gia nhóm chat',
          text: 'Tham gia nhóm chat qua link này:',
          url: fullLink,
        });
      } catch (err) {
        // User cancelled or error
        if ((err as Error).name !== 'AbortError') {
          handleCopy(); // Fallback to copy
        }
      }
    } else {
      handleCopy();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Link2 className="w-5 h-5" />
        <span className="text-sm">
          Chia sẻ link này để mời bạn bè tham gia nhóm
        </span>
      </div>

      {fullLink ? (
        <>
          <div className="flex gap-2">
            <Input
              value={fullLink}
              readOnly
              className="font-mono text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              title="Sao chép"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={handleShare}
            >
              <Share2 className="w-4 h-4" />
              Chia sẻ
            </Button>
            
            {isAdmin && (
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={handleGenerateLink}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Tạo link mới
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Bất kỳ ai có link này đều có thể tham gia nhóm
          </p>
        </>
      ) : (
        <div className="text-center py-6 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto">
            <Link2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Chưa có link mời cho nhóm này
          </p>
          {isAdmin && (
            <Button
              onClick={handleGenerateLink}
              disabled={generating}
              className="gap-2"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4" />
              )}
              Tạo link mời
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

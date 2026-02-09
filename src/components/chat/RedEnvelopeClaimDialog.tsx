/**
 * Dialog mở/nhận Red Envelope (Lì xì)
 */
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Gift, Loader2, PartyPopper, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRedEnvelope, RedEnvelope, RedEnvelopeClaim } from '@/hooks/useRedEnvelope';

interface RedEnvelopeClaimDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  envelopeId: string | null;
  onClaimed?: () => void;
}

export default function RedEnvelopeClaimDialog({
  open,
  onOpenChange,
  envelopeId,
  onClaimed,
}: RedEnvelopeClaimDialogProps) {
  const { loading, claimEnvelope, getEnvelopeDetails } = useRedEnvelope();
  const [envelope, setEnvelope] = useState<RedEnvelope | null>(null);
  const [claims, setClaims] = useState<RedEnvelopeClaim[]>([]);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [userClaimAmount, setUserClaimAmount] = useState<number | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // Fetch envelope details
  useEffect(() => {
    if (!envelopeId || !open) return;

    const fetchDetails = async () => {
      const result = await getEnvelopeDetails(envelopeId);
      if (result.envelope) {
        setEnvelope(result.envelope);
        setClaims(result.claims);
        setHasClaimed(result.hasClaimed);
        setUserClaimAmount(result.userClaimAmount);
      }
    };

    fetchDetails();
  }, [envelopeId, open, getEnvelopeDetails]);

  const handleClaim = async () => {
    if (!envelopeId) return;

    setClaiming(true);
    const { claim, error } = await claimEnvelope(envelopeId);
    setClaiming(false);

    if (claim && !error) {
      setHasClaimed(true);
      setUserClaimAmount(claim.amount);
      setShowCelebration(true);
      onClaimed?.();

      // Hide celebration after 3 seconds
      setTimeout(() => setShowCelebration(false), 3000);
    }
  };

  const handleClose = () => {
    setShowCelebration(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden bg-gradient-to-b from-red-600 to-red-700">
        {/* Celebration Animation */}
        {showCelebration && (
          <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="text-8xl animate-bounce">🎉</div>
          </div>
        )}

        {/* Header */}
        <div className="p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-400/20 flex items-center justify-center">
            <Gift className="w-8 h-8 text-yellow-300" />
          </div>

          {envelope && (
            <>
              <h2 className="text-white font-bold text-xl mb-1">
                {hasClaimed 
                  ? `🎊 Chúc mừng bạn nhận được ${userClaimAmount?.toFixed(2)} ${envelope.currency}!`
                  : 'Lì xì từ bạn bè'
                }
              </h2>
              {envelope.message && (
                <p className="text-white/80 text-sm italic mb-4">"{envelope.message}"</p>
              )}
            </>
          )}
        </div>

        {/* Action Area */}
        <div className="bg-white dark:bg-background rounded-t-3xl p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-red-500" />
            </div>
          ) : hasClaimed ? (
            <div className="space-y-4">
              {/* User's claim amount */}
              <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-xl">
                <PartyPopper className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <p className="text-2xl font-bold text-green-600">
                  {userClaimAmount?.toFixed(2)} {envelope?.currency}
                </p>
                <p className="text-sm text-muted-foreground">Đã nhận vào ví của bạn</p>
              </div>

              {/* Claims list */}
              {claims.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>{claims.length}/{envelope?.total_recipients} người đã nhận</span>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-2">
                    {claims.map((claim) => (
                      <div key={claim.id} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6">
                            <AvatarImage src={claim.user?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {claim.user?.display_name?.slice(0, 1) || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{claim.user?.display_name || 'Người dùng'}</span>
                        </div>
                        <span className="text-sm font-medium text-red-600">
                          {claim.amount.toFixed(2)} {envelope?.currency}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={handleClose}
                className="w-full"
                variant="outline"
              >
                Đóng
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {envelope && (
                <div className="text-center mb-4">
                  <p className="text-3xl font-bold text-red-600">
                    {envelope.total_amount} {envelope.currency}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {envelope.distribution_type === 'random' ? 'Chia ngẫu nhiên' : 'Chia đều'} cho {envelope.total_recipients} người
                  </p>
                </div>
              )}

              <Button
                onClick={handleClaim}
                disabled={claiming}
                className={cn(
                  "w-full py-6 text-lg font-bold rounded-xl",
                  "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                )}
              >
                {claiming ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Gift className="w-5 h-5 mr-2" />
                )}
                Mở lì xì
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Còn {envelope?.total_recipients || 0 - (envelope?.claimed_count || 0)} phần lì xì
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

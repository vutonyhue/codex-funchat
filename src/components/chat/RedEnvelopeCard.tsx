/**
 * Red Envelope Card - Hiển thị lì xì trong chat
 */
import { useState, useEffect } from 'react';
import { Gift, Users, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface RedEnvelopeCardProps {
  envelopeId: string;
  totalAmount: number;
  currency: string;
  totalRecipients: number;
  message?: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  expiresAt?: string;
  onOpen: (envelopeId: string) => void;
}

export default function RedEnvelopeCard({
  envelopeId,
  totalAmount,
  currency,
  totalRecipients,
  message,
  senderId,
  senderName,
  senderAvatar,
  expiresAt,
  onOpen,
}: RedEnvelopeCardProps) {
  const { user } = useAuth();
  const [envelopeData, setEnvelopeData] = useState<{
    claimed_count: number;
    status: string;
    hasClaimed: boolean;
    userAmount?: number;
  } | null>(null);

  // Fetch envelope status
  useEffect(() => {
    const fetchStatus = async () => {
      const { data: envelope } = await supabase
        .from('red_envelopes')
        .select('claimed_count, status')
        .eq('id', envelopeId)
        .single();

      if (envelope) {
        // Check if current user has claimed
        const { data: claim } = await supabase
          .from('red_envelope_claims')
          .select('amount')
          .eq('envelope_id', envelopeId)
          .eq('user_id', user?.id || '')
          .single();

        setEnvelopeData({
          claimed_count: envelope.claimed_count,
          status: envelope.status,
          hasClaimed: !!claim,
          userAmount: claim?.amount,
        });
      }
    };

    fetchStatus();
  }, [envelopeId, user?.id]);

  const isExpired = envelopeData?.status === 'expired';
  const isFullyClaimed = envelopeData?.status === 'fully_claimed';
  const hasClaimed = envelopeData?.hasClaimed;
  const isMine = senderId === user?.id;

  const timeRemaining = expiresAt 
    ? formatDistanceToNow(new Date(expiresAt), { addSuffix: true, locale: vi })
    : null;

  return (
    <div className={cn(
      "rounded-2xl overflow-hidden max-w-xs shadow-lg",
      "bg-gradient-to-br from-red-600 to-red-700",
      (isExpired || isFullyClaimed) && "opacity-75"
    )}>
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-yellow-400/20 flex items-center justify-center">
            <Gift className="w-5 h-5 text-yellow-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">
              Lì xì từ {isMine ? 'bạn' : senderName || 'Người dùng'}
            </p>
            <p className="text-white/70 text-xs">
              {totalAmount} {currency}
            </p>
          </div>
        </div>

        {message && (
          <p className="text-white/90 text-sm italic mb-3 line-clamp-2">
            "{message}"
          </p>
        )}
      </div>

      {/* Action Button */}
      <div className="px-4 pb-4">
        {hasClaimed ? (
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-yellow-300 font-bold text-lg">
              🎉 {envelopeData?.userAmount?.toFixed(2)} {currency}
            </p>
            <p className="text-white/70 text-xs">Bạn đã nhận được</p>
          </div>
        ) : isExpired ? (
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-white/70 text-sm">⏰ Lì xì đã hết hạn</p>
          </div>
        ) : isFullyClaimed ? (
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-white/70 text-sm">🎁 Đã được nhận hết</p>
          </div>
        ) : isMine ? (
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-white/70 text-sm">Bạn đã gửi lì xì này</p>
          </div>
        ) : (
          <Button
            onClick={() => onOpen(envelopeId)}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-red-700 font-bold rounded-xl"
          >
            Mở lì xì
          </Button>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pb-3 flex items-center justify-between text-white/60 text-xs">
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          <span>
            {envelopeData?.claimed_count || 0}/{totalRecipients} đã nhận
          </span>
        </div>
        {timeRemaining && !isExpired && !isFullyClaimed && (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Hết hạn {timeRemaining}</span>
          </div>
        )}
      </div>
    </div>
  );
}

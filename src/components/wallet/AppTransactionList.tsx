import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowUpRight, ArrowDownLeft, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { CryptoTransaction } from '@/hooks/useCryptoTransactions';

interface AppTransactionListProps {
  transactions: CryptoTransaction[];
  loading: boolean;
  userId: string;
}

export default function AppTransactionList({
  transactions,
  loading,
  userId,
}: AppTransactionListProps) {
  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Đang tải giao dịch...</p>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Chưa có giao dịch nào trong ứng dụng</p>
        <p className="text-sm text-muted-foreground mt-2">
          Gửi CAMLY cho bạn bè trong chat để bắt đầu!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((tx) => {
        const isSent = tx.from_user_id === userId;
        const otherUser = isSent ? tx.to_user : tx.from_user;
        const statusColor = tx.status === 'completed' 
          ? 'bg-green-500/10 text-green-600 border-green-500/20' 
          : tx.status === 'pending'
          ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
          : 'bg-red-500/10 text-red-600 border-red-500/20';

        return (
          <div
            key={tx.id}
            className="p-4 rounded-xl bg-card border border-border hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-4">
              {/* Icon or Avatar */}
              <div className="relative">
                {otherUser ? (
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={otherUser.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {otherUser.display_name?.charAt(0) || otherUser.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isSent ? 'bg-red-500/10' : 'bg-green-500/10'
                  }`}>
                    {isSent ? (
                      <ArrowUpRight className="w-5 h-5 text-red-500" />
                    ) : (
                      <ArrowDownLeft className="w-5 h-5 text-green-500" />
                    )}
                  </div>
                )}
                {/* Direction indicator */}
                <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${
                  isSent ? 'bg-red-500' : 'bg-green-500'
                }`}>
                  {isSent ? (
                    <ArrowUpRight className="w-3 h-3 text-white" />
                  ) : (
                    <ArrowDownLeft className="w-3 h-3 text-white" />
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">
                    {isSent ? 'Gửi' : 'Nhận'} {tx.currency}
                    {otherUser && (
                      <span className="text-muted-foreground">
                        {isSent ? ' cho ' : ' từ '}
                        @{otherUser.username}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    {tx.created_at && formatDistanceToNow(new Date(tx.created_at), { 
                      addSuffix: true, 
                      locale: vi 
                    })}
                  </span>
                  <Badge variant="outline" className={`text-xs ${statusColor}`}>
                    {tx.status === 'completed' ? 'Hoàn thành' : 
                     tx.status === 'pending' ? 'Đang xử lý' : 'Thất bại'}
                  </Badge>
                </div>
              </div>

              {/* Amount & Actions */}
              <div className="text-right">
                <p className={`font-semibold ${isSent ? 'text-red-500' : 'text-green-500'}`}>
                  {isSent ? '-' : '+'}{Number(tx.amount).toLocaleString()} {tx.currency}
                </p>
                {tx.tx_hash && (
                  <a
                    href={`https://bscscan.com/tx/${tx.tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    BSCScan
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

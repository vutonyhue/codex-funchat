import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Copy, ExternalLink, QrCode, Wallet, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'react-qr-code';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface CryptoStats {
  total_sent: Record<string, number>;
  total_received: Record<string, number>;
  transaction_count: {
    sent: number;
    received: number;
  };
}

interface WalletOverviewProps {
  isConnected: boolean;
  address: string | null;
  bnbBalance: string;
  camlyBalance: string;
  stats: CryptoStats | null;
  onConnect: () => void;
  onDisconnect: () => void;
  shortenAddress: (address: string) => string;
}

export default function WalletOverview({
  isConnected,
  address,
  bnbBalance,
  camlyBalance,
  stats,
  onConnect,
  onDisconnect,
  shortenAddress,
}: WalletOverviewProps) {
  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast.success('Đã sao chép địa chỉ ví');
    }
  };

  return (
    <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
      <CardContent className="p-6 space-y-6">
        {/* Wallet Connection Status */}
        {isConnected && address ? (
          <>
            {/* Address Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Đã kết nối</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="px-2 py-1 bg-muted rounded text-sm font-mono">
                  {shortenAddress(address)}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleCopyAddress}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => window.open(`https://bscscan.com/address/${address}`, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <QrCode className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-xs">
                    <DialogHeader>
                      <DialogTitle className="text-center">Quét để gửi crypto</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center gap-4 py-4">
                      <div className="bg-white p-4 rounded-xl">
                        <QRCode value={address} size={180} level="H" />
                      </div>
                      <code className="text-xs text-muted-foreground break-all text-center px-4">
                        {address}
                      </code>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Balances */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-xs text-muted-foreground mb-1">BNB</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {bnbBalance}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-pink-500/10 border border-pink-500/20">
                <p className="text-xs text-muted-foreground mb-1">CAMLY</p>
                <p className="text-2xl font-bold text-pink-600 dark:text-pink-400">
                  {parseFloat(camlyBalance).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Stats */}
            {stats && (
              <div className="p-4 rounded-xl bg-muted/50 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">📊 Thống kê giao dịch trong ứng dụng</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Đã gửi: </span>
                    <span className="font-semibold text-red-500">
                      {stats.total_sent['CAMLY']?.toLocaleString() || 0} CAMLY
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Đã nhận: </span>
                    <span className="font-semibold text-green-500">
                      {stats.total_received['CAMLY']?.toLocaleString() || 0} CAMLY
                    </span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Tổng: {stats.transaction_count.sent + stats.transaction_count.received} giao dịch
                </div>
              </div>
            )}

            {/* Disconnect Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={onDisconnect}
              className="w-full"
            >
              Ngắt kết nối ví
            </Button>
          </>
        ) : (
          /* Not Connected State */
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Wallet className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Kết nối ví của bạn</h3>
              <p className="text-sm text-muted-foreground">
                Kết nối MetaMask để xem số dư và lịch sử giao dịch blockchain
              </p>
            </div>
            <Button onClick={onConnect} className="gap-2">
              <Wallet className="w-4 h-4" />
              Kết nối MetaMask
            </Button>
            
            {/* Stats for non-connected users (in-app only) */}
            {stats && (
              <div className="p-4 rounded-xl bg-muted/50 space-y-2 text-left">
                <p className="text-sm font-medium text-muted-foreground">📊 Thống kê giao dịch trong ứng dụng</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Đã gửi: </span>
                    <span className="font-semibold text-red-500">
                      {stats.total_sent['CAMLY']?.toLocaleString() || 0} CAMLY
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Đã nhận: </span>
                    <span className="font-semibold text-green-500">
                      {stats.total_received['CAMLY']?.toLocaleString() || 0} CAMLY
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

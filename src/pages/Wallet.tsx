import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useWallet } from '@/hooks/useWallet';
import { useCryptoTransactions } from '@/hooks/useCryptoTransactions';
import { useTransactionHistory } from '@/hooks/useTransactionHistory';
import WalletOverview from '@/components/wallet/WalletOverview';
import AppTransactionList from '@/components/wallet/AppTransactionList';
import TransactionFilters from '@/components/wallet/TransactionFilters';
import { ArrowLeft, RefreshCw, Loader2, Wallet as WalletIcon } from 'lucide-react';
import { Transaction } from '@/hooks/useTransactionHistory';

export type TransactionFilter = {
  type: 'all' | 'sent' | 'received';
  currency: 'all' | 'CAMLY' | 'BNB';
  timeRange: '7d' | '30d' | 'all';
};

const Wallet = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isEmailVerified } = useAuth();
  const { 
    isConnected, 
    address, 
    bnbBalance, 
    camlyBalance, 
    connect, 
    disconnect, 
    fetchBalances,
    shortenAddress 
  } = useWallet();
  const { 
    transactions: appTransactions, 
    stats, 
    loading: appLoading, 
    fetchHistory, 
    fetchStats 
  } = useCryptoTransactions();
  const { 
    transactions: blockchainTransactions, 
    loading: blockchainLoading, 
    fetchHistory: fetchBlockchainHistory 
  } = useTransactionHistory(address);

  const [activeTab, setActiveTab] = useState('app');
  const [filters, setFilters] = useState<TransactionFilter>({
    type: 'all',
    currency: 'all',
    timeRange: 'all',
  });
  const [refreshing, setRefreshing] = useState(false);

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && user && !isEmailVerified) {
      navigate('/verify-email');
    }
  }, [user, authLoading, isEmailVerified, navigate]);

  // Fetch data on mount
  useEffect(() => {
    if (user) {
      fetchHistory({ type: filters.type });
      fetchStats();
    }
  }, [user, fetchHistory, fetchStats, filters.type]);

  // Fetch blockchain transactions when wallet is connected
  useEffect(() => {
    if (isConnected && address) {
      fetchBlockchainHistory();
    }
  }, [isConnected, address, fetchBlockchainHistory]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchHistory({ type: filters.type }),
        fetchStats(),
        address ? fetchBalances(address) : Promise.resolve(),
        address ? fetchBlockchainHistory() : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleFilterChange = (newFilters: TransactionFilter) => {
    setFilters(newFilters);
    fetchHistory({ type: newFilters.type });
  };

  // Filter blockchain transactions
  const filteredBlockchainTxs = blockchainTransactions.filter((tx: Transaction) => {
    if (filters.type === 'sent' && tx.type !== 'sent') return false;
    if (filters.type === 'received' && tx.type !== 'received') return false;
    if (filters.currency !== 'all' && tx.tokenSymbol !== filters.currency) return false;
    
    if (filters.timeRange !== 'all') {
      const txDate = new Date(parseInt(tx.timeStamp) * 1000);
      const now = new Date();
      const daysAgo = filters.timeRange === '7d' ? 7 : 30;
      const cutoff = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      if (txDate < cutoff) return false;
    }
    
    return true;
  });

  // Filter app transactions
  const filteredAppTxs = appTransactions.filter((tx) => {
    if (filters.currency !== 'all' && tx.currency !== filters.currency) return false;
    
    if (filters.timeRange !== 'all' && tx.created_at) {
      const txDate = new Date(tx.created_at);
      const now = new Date();
      const daysAgo = filters.timeRange === '7d' ? 7 : 30;
      const cutoff = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      if (txDate < cutoff) return false;
    }
    
    return true;
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <WalletIcon className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-semibold">Ví của tôi</h1>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Wallet Overview */}
        <WalletOverview
          isConnected={isConnected}
          address={address}
          bnbBalance={bnbBalance}
          camlyBalance={camlyBalance}
          stats={stats}
          onConnect={connect}
          onDisconnect={disconnect}
          shortenAddress={shortenAddress}
        />

        {/* Tabs & Filters */}
        <div className="flex items-center justify-between gap-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="app">Trong ứng dụng</TabsTrigger>
              <TabsTrigger value="blockchain">Blockchain</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <TransactionFilters
            filters={filters}
            onFilterChange={handleFilterChange}
          />
        </div>

        {/* Transaction Lists */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="app" className="mt-0">
            <AppTransactionList
              transactions={filteredAppTxs}
              loading={appLoading}
              userId={user?.id || ''}
            />
          </TabsContent>
          
          <TabsContent value="blockchain" className="mt-0">
            {!isConnected ? (
              <div className="py-12 text-center">
                <WalletIcon className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground mb-4">
                  Kết nối ví để xem giao dịch blockchain
                </p>
                <Button onClick={connect} className="gap-2">
                  <WalletIcon className="w-4 h-4" />
                  Kết nối MetaMask
                </Button>
              </div>
            ) : blockchainLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin mb-4" />
                <p className="text-muted-foreground">Đang tải giao dịch...</p>
              </div>
            ) : filteredBlockchainTxs.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">Không có giao dịch blockchain</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBlockchainTxs.map((tx: Transaction) => (
                  <div
                    key={tx.hash}
                    className="p-4 rounded-xl bg-card border border-border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          tx.type === 'sent' 
                            ? 'bg-red-500/10 text-red-500' 
                            : 'bg-green-500/10 text-green-500'
                        }`}>
                          {tx.type === 'sent' ? '↑' : '↓'}
                        </div>
                        <div>
                          <p className="font-medium">
                            {tx.type === 'sent' ? 'Gửi' : 'Nhận'} {tx.tokenSymbol}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(parseInt(tx.timeStamp) * 1000).toLocaleString('vi-VN')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${
                          tx.type === 'sent' ? 'text-red-500' : 'text-green-500'
                        }`}>
                          {tx.type === 'sent' ? '-' : '+'}
                          {(parseFloat(tx.value) / Math.pow(10, tx.tokenDecimal)).toFixed(
                            tx.tokenSymbol === 'BNB' ? 6 : 2
                          )} {tx.tokenSymbol}
                        </p>
                        <a
                          href={`https://bscscan.com/tx/${tx.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          Xem trên BSCScan
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Wallet;

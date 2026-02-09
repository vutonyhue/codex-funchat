import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Filter } from 'lucide-react';
import { TransactionFilter } from '@/pages/Wallet';

interface TransactionFiltersProps {
  filters: TransactionFilter;
  onFilterChange: (filters: TransactionFilter) => void;
}

export default function TransactionFilters({
  filters,
  onFilterChange,
}: TransactionFiltersProps) {
  const activeFilterCount = [
    filters.type !== 'all',
    filters.currency !== 'all',
    filters.timeRange !== 'all',
  ].filter(Boolean).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="w-4 h-4" />
          Lọc
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Loại giao dịch</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={filters.type}
          onValueChange={(value) =>
            onFilterChange({ ...filters, type: value as TransactionFilter['type'] })
          }
        >
          <DropdownMenuRadioItem value="all">Tất cả</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="sent">Đã gửi</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="received">Đã nhận</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Loại tiền</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={filters.currency}
          onValueChange={(value) =>
            onFilterChange({ ...filters, currency: value as TransactionFilter['currency'] })
          }
        >
          <DropdownMenuRadioItem value="all">Tất cả</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="CAMLY">CAMLY</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="BNB">BNB</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Thời gian</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={filters.timeRange}
          onValueChange={(value) =>
            onFilterChange({ ...filters, timeRange: value as TransactionFilter['timeRange'] })
          }
        >
          <DropdownMenuRadioItem value="all">Tất cả</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="7d">7 ngày qua</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="30d">30 ngày qua</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        {activeFilterCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center text-muted-foreground"
              onClick={() =>
                onFilterChange({ type: 'all', currency: 'all', timeRange: 'all' })
              }
            >
              Xóa bộ lọc
            </Button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

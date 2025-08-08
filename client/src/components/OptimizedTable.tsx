/**
 * Enterprise-grade optimized table component
 * Virtual scrolling, memoization, and performance optimizations
 */

import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronUp, ChevronDown, Search } from 'lucide-react';
import { useRenderPerformance, useDebounce } from '@/hooks/usePerformance';

interface Column<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: T[keyof T], row: T, index: number) => React.ReactNode;
  width?: string;
}

interface OptimizedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  itemHeight?: number;
  maxVisibleRows?: number;
  onRowClick?: (row: T, index: number) => void;
  loading?: boolean;
  emptyMessage?: string;
  searchPlaceholder?: string;
  className?: string;
}

/**
 * High-performance table with virtual scrolling and optimizations
 */
export function OptimizedTable<T extends Record<string, any>>({
  data,
  columns,
  itemHeight = 48,
  maxVisibleRows = 20,
  onRowClick,
  loading = false,
  emptyMessage = 'No data available',
  searchPlaceholder = 'Search...',
  className,
}: OptimizedTableProps<T>) {
  const { measureRender } = useRenderPerformance('OptimizedTable');
  
  // State management
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });
  
  const [filterConfig, setFilterConfig] = useState<Record<keyof T, string>>({} as Record<keyof T, string>);
  const [globalFilter, setGlobalFilter] = useState('');
  // Debounce search inputs for better performance
  const debouncedGlobalFilter = useDebounce(globalFilter, 300);
  const debouncedFilterConfig = useDebounce(filterConfig, 300);
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  // Memoized filtered and sorted data
  const processedData = useMemo(() => {
    return measureRender('data-processing', () => {
      let result = [...data];

      // Apply global filter
      if (debouncedGlobalFilter) {
        const searchTerm = debouncedGlobalFilter.toLowerCase();
        result = result.filter(row =>
          columns.some(col => {
            const value = row[col.key];
            return String(value).toLowerCase().includes(searchTerm);
          })
        );
      }

      // Apply column filters
      Object.entries(debouncedFilterConfig).forEach(([key, value]) => {
        if (value) {
          const searchTerm = value.toLowerCase();
          result = result.filter(row => {
            const cellValue = row[key as keyof T];
            return String(cellValue).toLowerCase().includes(searchTerm);
          });
        }
      });

      // Apply sorting
      if (sortConfig.key) {
        result.sort((a, b) => {
          const aValue = a[sortConfig.key!];
          const bValue = b[sortConfig.key!];

          let comparison = 0;
          if (aValue > bValue) {
            comparison = 1;
          } else if (aValue < bValue) {
            comparison = -1;
          }

          return sortConfig.direction === 'desc' ? comparison * -1 : comparison;
        });
      }

      return result;
    });
  }, [data, debouncedGlobalFilter, debouncedFilterConfig, sortConfig, columns, measureRender]);

  // Virtual scrolling using react-virtual
  const containerHeight = maxVisibleRows * itemHeight;
  const rowVirtualizer = useVirtualizer({
    count: processedData.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => itemHeight,
    overscan: 5,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();
  const visibleData = virtualRows.map((v) => processedData[v.index]);
  const offsetY = virtualRows[0]?.start ?? 0;

  // Optimized sort handler
  const handleSort = useCallback((key: keyof T) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  // Optimized filter handler
  const handleColumnFilter = useCallback((key: keyof T, value: string) => {
    setFilterConfig(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  // Memoized row component for better performance
  const TableRowMemo = React.memo<{
    row: T;
    index: number;
    columns: Column<T>[];
    onClick?: (row: T, index: number) => void;
  }>(({ row, index, columns, onClick }) => (
    <TableRow
      key={index}
      onClick={() => onClick?.(row, index)}
      className={onClick ? 'cursor-pointer hover:bg-muted/50' : ''}
      style={{ height: itemHeight }}
    >
      {columns.map((column) => (
        <TableCell
          key={String(column.key)}
          style={{ width: column.width }}
          className="truncate"
        >
          {column.render
            ? column.render(row[column.key], row, index)
            : String(row[column.key] || '')
          }
        </TableCell>
      ))}
    </TableRow>
  ));

  // Loading skeleton
  const LoadingSkeleton = useMemo(() => (
    Array.from({ length: Math.min(10, maxVisibleRows) }, (_, i) => (
      <TableRow key={`skeleton-${i}`} style={{ height: itemHeight }}>
        {columns.map((column) => (
          <TableCell key={String(column.key)}>
            <div className="h-4 bg-muted animate-pulse rounded" />
          </TableCell>
        ))}
      </TableRow>
    ))
  ), [columns, itemHeight, maxVisibleRows]);

  // Performance monitoring
  useEffect(() => {
    if (processedData.length > 1000) {
      console.info('Large dataset detected:', {
        totalRows: processedData.length,
        visibleRows: visibleData.length,
        performance: 'Virtual scrolling active',
      });
    }
  }, [processedData.length, visibleData.length]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Global search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder={searchPlaceholder}
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {visibleData.length} of {processedData.length} entries
        {processedData.length !== data.length && ` (filtered from ${data.length})`}
      </div>

      {/* Table container with virtual scrolling */}
      <div
        ref={containerRef}
        className="border rounded-md overflow-auto"
        style={{ height: containerHeight }}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <Table ref={tableRef} className="relative">
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                {columns.map((column) => (
                  <TableHead
                    key={String(column.key)}
                    style={{ width: column.width }}
                    className="border-b"
                  >
                    <div className="space-y-2">
                      {/* Column header with sort */}
                      <div className="flex items-center space-x-2">
                        <span>{column.label}</span>
                        {column.sortable && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort(column.key)}
                            className="h-6 w-6 p-0"
                          >
                            {sortConfig.key === column.key ? (
                              sortConfig.direction === 'asc' ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )
                            ) : (
                              <ChevronUp className="h-3 w-3 opacity-50" />
                            )}
                          </Button>
                        )}
                      </div>
                      
                      {/* Column filter */}
                      {column.filterable && (
                        <Input
                          type="text"
                          placeholder={`Filter ${column.label.toLowerCase()}...`}
                          value={filterConfig[column.key] || ''}
                          onChange={(e) => handleColumnFilter(column.key, e.target.value)}
                          className="h-6 text-xs"
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            
            <TableBody
              style={{
                transform: `translateY(${offsetY}px)`,
              }}
            >
                {loading ? (
                  LoadingSkeleton
                ) : visibleData.length > 0 ? (
                  visibleData.map((row: T, index: number) => (
                    <TableRowMemo
                      key={virtualRows[index].key}
                      row={row}
                      index={virtualRows[index].index}
                      columns={columns}
                      {...(onRowClick ? { onClick: onRowClick } : {})}
                    />
                  ))
                ) : (
                <TableRow style={{ height: itemHeight }}>
                  <TableCell
                    colSpan={columns.length}
                    className="text-center text-muted-foreground"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

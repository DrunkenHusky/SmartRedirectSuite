
import React, { memo } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUp,
  ArrowDown,
  Edit,
  AlertCircle
} from "lucide-react";
import type { UrlRule } from "@shared/schema";
import { useResizableColumns } from "@/hooks/useResizableColumns";
import { ResizeHandle } from "@/components/ui/resize-handle";

interface StatsTableProps {
  entries: any[];
  sortConfig: {
    by: string;
    order: 'asc' | 'desc';
  };
  onSort: (column: string) => void;
  onEditRule: (rule: UrlRule) => void;
  formatTimestamp: (timestamp: string) => string;
}

const StatsTable = memo(({
  entries,
  sortConfig,
  onSort,
  onEditRule,
  formatTimestamp
}: StatsTableProps) => {

  const { columnWidths, handleResizeStart } = useResizableColumns({
    initialWidths: {
      timestamp: 150,
      oldUrl: 250,
      newUrl: 250,
      path: 200,
      referrer: 200,
      rule: 150,
      matchQuality: 100,
    }
  });

  const getSortIcon = (column: string) => {
    if (sortConfig.by !== column) return <ArrowUp className="h-3 w-3 opacity-0" />; // Invisible placeholder for spacing
    return sortConfig.order === 'asc' ? <ArrowUp className="h-3 w-3 flex-shrink-0" /> : <ArrowDown className="h-3 w-3 flex-shrink-0" />;
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full table-fixed border-collapse">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th className="text-left p-2 sm:p-3 relative" style={{ width: columnWidths.timestamp }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSort('timestamp')}
                className="h-auto p-0 font-medium hover:bg-transparent w-full justify-start"
              >
                <span className="flex items-center gap-1 truncate text-xs sm:text-sm">
                  Zeitstempel
                  {getSortIcon('timestamp')}
                </span>
              </Button>
              <ResizeHandle onMouseDown={(e) => handleResizeStart('timestamp', e)} />
            </th>
            <th className="text-left p-2 sm:p-3 relative" style={{ width: columnWidths.oldUrl }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSort('oldUrl')}
                className="h-auto p-0 font-medium hover:bg-transparent w-full justify-start"
              >
                <span className="flex items-center gap-1 truncate text-xs sm:text-sm">
                  Alte URL
                  {getSortIcon('oldUrl')}
                </span>
              </Button>
              <ResizeHandle onMouseDown={(e) => handleResizeStart('oldUrl', e)} />
            </th>
            <th className="text-left p-2 sm:p-3 relative" style={{ width: columnWidths.newUrl }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSort('newUrl')}
                className="h-auto p-0 font-medium hover:bg-transparent w-full justify-start"
              >
                <span className="flex items-center gap-1 truncate text-xs sm:text-sm">
                  Neue URL
                  {getSortIcon('newUrl')}
                </span>
              </Button>
              <ResizeHandle onMouseDown={(e) => handleResizeStart('newUrl', e)} />
            </th>
            <th className="text-left p-2 sm:p-3 relative" style={{ width: columnWidths.path }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSort('path')}
                className="h-auto p-0 font-medium hover:bg-transparent w-full justify-start"
              >
                <span className="flex items-center gap-1 truncate text-xs sm:text-sm">
                  Pfad
                  {getSortIcon('path')}
                </span>
              </Button>
              <ResizeHandle onMouseDown={(e) => handleResizeStart('path', e)} />
            </th>
            <th className="text-left p-2 sm:p-3 relative" style={{ width: columnWidths.referrer }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSort('referrer')}
                className="h-auto p-0 font-medium hover:bg-transparent w-full justify-start"
              >
                <span className="flex items-center gap-1 truncate text-xs sm:text-sm">
                  Referrer
                  {getSortIcon('referrer')}
                </span>
              </Button>
              <ResizeHandle onMouseDown={(e) => handleResizeStart('referrer', e)} />
            </th>
            <th className="text-left p-2 sm:p-3 font-medium text-xs sm:text-sm relative" style={{ width: columnWidths.rule }}>
              Regel
              <ResizeHandle onMouseDown={(e) => handleResizeStart('rule', e)} />
            </th>
            <th className="text-left p-2 sm:p-3 relative" style={{ width: columnWidths.matchQuality }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSort('matchQuality')}
                className="h-auto p-0 font-medium hover:bg-transparent w-full justify-start"
              >
                <span className="flex items-center gap-1 truncate text-xs sm:text-sm">
                  Qualität
                  {getSortIcon('matchQuality')}
                </span>
              </Button>
              <ResizeHandle onMouseDown={(e) => handleResizeStart('matchQuality', e)} />
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry: any) => (
            <tr key={entry.id} className="border-b hover:bg-muted/50">
              <td className="p-2 sm:p-3 text-xs sm:text-sm truncate">
                {formatTimestamp(entry.timestamp)}
              </td>
              <td className="p-2 sm:p-3">
                <div className="w-full" title={entry.oldUrl}>
                   <code className="text-[10px] sm:text-xs text-foreground break-all inline-block max-w-full truncate align-middle">
                    {entry.oldUrl}
                   </code>
                </div>
              </td>
              <td className="p-2 sm:p-3">
                <div className="w-full" title={entry.newUrl || 'N/A'}>
                  <code className="text-[10px] sm:text-xs text-foreground break-all inline-block max-w-full truncate align-middle">
                    {entry.newUrl || 'N/A'}
                  </code>
                </div>
              </td>
              <td className="p-2 sm:p-3">
                <div className="w-full" title={entry.path}>
                    <code className="text-xs sm:text-sm text-foreground inline-block max-w-full truncate align-middle">
                        {entry.path}
                    </code>
                </div>
              </td>
              <td className="p-2 sm:p-3">
                <div className="w-full" title={entry.referrer || ''}>
                  <code className="text-[10px] sm:text-xs text-foreground break-all inline-block max-w-full truncate align-middle">
                    {entry.referrer || '-'}
                  </code>
                </div>
              </td>
              <td className="p-2 sm:p-3">
                {entry.rules && entry.rules.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {entry.rules.map((rule: UrlRule) => (
                      <Button
                        key={rule.id}
                        variant="ghost"
                        size="sm"
                        className="h-auto p-1 text-[10px] sm:text-xs bg-muted hover:bg-muted/80 mb-1"
                        onClick={() => onEditRule(rule)}
                        title={`Regel bearbeiten: ${rule.redirectType}`}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        <span className="truncate max-w-[80px] sm:max-w-[100px] inline-block align-bottom">{rule.matcher}</span>
                        <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0 h-4">
                            {rule.redirectType === 'domain' ? 'D' : rule.redirectType === 'wildcard' ? 'W' : 'P'}
                        </Badge>
                      </Button>
                    ))}
                  </div>
                ) : entry.rule ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-1 text-[10px] sm:text-xs bg-muted hover:bg-muted/80"
                    onClick={() => onEditRule(entry.rule)}
                    title="Regel bearbeiten"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    <span className="truncate max-w-[80px] sm:max-w-[100px] inline-block align-bottom">{entry.rule.matcher}</span>
                  </Button>
                ) : (entry.ruleId || (entry.ruleIds && entry.ruleIds.length > 0)) ? (
                  <span className="text-[10px] sm:text-xs text-muted-foreground italic flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    <span className="hidden sm:inline">Regel nicht mehr vorhanden</span>
                    <span className="sm:hidden">Gelöscht</span>
                  </span>
                ) : (
                  <span className="text-[10px] sm:text-xs text-muted-foreground">-</span>
                )}
              </td>
              <td className="p-2 sm:p-3">
                <span className={`text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded-full ${
                  (entry.matchQuality || 0) >= 90 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  (entry.matchQuality || 0) >= 50 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {entry.matchQuality || 0}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

StatsTable.displayName = "StatsTable";

export { StatsTable };


import React, { memo } from 'react';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { useResizableColumns } from "@/hooks/useResizableColumns";
import { ResizeHandle } from "@/components/ui/resize-handle";
import type { UrlRule } from "@shared/schema";

interface ParsedRuleResult {
  rule: Partial<UrlRule>;
  isValid: boolean;
  errors: string[];
  status: 'new' | 'update' | 'invalid';
}

interface ImportPreviewTableProps {
  data: ParsedRuleResult[];
  limit: number;
  sortConfig: {
    by: 'status' | 'matcher' | 'targetUrl';
    order: 'asc' | 'desc';
  };
  onSort: (column: 'status' | 'matcher' | 'targetUrl') => void;
}

const ImportPreviewTable = memo(({
  data,
  limit,
  sortConfig,
  onSort
}: ImportPreviewTableProps) => {

  const { columnWidths, startResizing } = useResizableColumns({
    status: '100px',
    matcher: '25%',
    targetUrl: '25%',
    type: '12%',
    autoRedirect: '12%',
    queryParams: '12%'
  });

  return (
    <div className="border rounded-md">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="relative" style={{ width: columnWidths.status }}>
              <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent font-medium" onClick={() => onSort('status')}>
                Status {sortConfig.by === 'status' && (sortConfig.order === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />)}
              </Button>
              <ResizeHandle onMouseDown={(e) => startResizing('status', e)} />
            </TableHead>
            <TableHead className="relative" style={{ width: columnWidths.matcher }}>
              <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent font-medium" onClick={() => onSort('matcher')}>
                URL-Pfad Matcher {sortConfig.by === 'matcher' && (sortConfig.order === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />)}
              </Button>
              <ResizeHandle onMouseDown={(e) => startResizing('matcher', e)} />
            </TableHead>
            <TableHead className="relative" style={{ width: columnWidths.targetUrl }}>
              <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent font-medium" onClick={() => onSort('targetUrl')}>
                Ziel-URL {sortConfig.by === 'targetUrl' && (sortConfig.order === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />)}
              </Button>
              <ResizeHandle onMouseDown={(e) => startResizing('targetUrl', e)} />
            </TableHead>
            <TableHead className="relative" style={{ width: columnWidths.type }}>
                Typ
                <ResizeHandle onMouseDown={(e) => startResizing('type', e)} />
            </TableHead>
            <TableHead className="relative" style={{ width: columnWidths.autoRedirect }}>
                Auto-Redirect
                <ResizeHandle onMouseDown={(e) => startResizing('autoRedirect', e)} />
            </TableHead>
            <TableHead className="relative" style={{ width: columnWidths.queryParams }}>
                Query Parameter
                <ResizeHandle onMouseDown={(e) => startResizing('queryParams', e)} />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data
            .slice(0, limit)
            .map((item, i) => (
              <TableRow key={i} className={!item.isValid ? "bg-red-50/50" : ""}>
                <TableCell>
                  <Badge variant="outline" className={
                    item.status === 'new' ? "bg-green-50 text-green-700 border-green-200" :
                    item.status === 'update' ? "bg-blue-50 text-blue-700 border-blue-200" :
                    "bg-red-50 text-red-700 border-red-200"
                  }>
                    {item.status === 'new' ? 'Neu' : item.status === 'update' ? 'Update' : 'Ungültig'}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  <div className="w-full" title={item.rule.matcher || ''}>
                    {item.rule.matcher ? (
                      <Badge variant="secondary" className="truncate max-w-full inline-block align-middle">
                        {item.rule.matcher}
                      </Badge>
                    ) : (
                      '-'
                    )}
                  </div>
                  {!item.isValid && item.errors.length > 0 && (
                    <div className="text-red-600 text-[10px] mt-1 whitespace-normal">{item.errors[0]}</div>
                  )}
                </TableCell>
                <TableCell>
                  {item.rule.targetUrl ? (
                    <div className="w-full" title={item.rule.targetUrl}>
                      <code className="text-xs bg-muted px-2 py-1 rounded inline-block max-w-full truncate align-middle">
                        {item.rule.targetUrl}
                      </code>
                    </div>
                  ) : (
                    <span className="text-xs italic text-muted-foreground">
                      -
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  <Badge variant={(item.rule as any).redirectType === 'wildcard' ? 'destructive' : (item.rule as any).redirectType === 'domain' ? 'outline' : 'default'}>
                    {(item.rule as any).redirectType === 'wildcard' ? 'Vollständig' : (item.rule as any).redirectType === 'domain' ? 'Domain' : 'Teilweise'}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  <Badge variant={item.rule.autoRedirect ? 'default' : 'secondary'}>
                    {item.rule.autoRedirect ? '✓ Aktiv' : '✗ Inaktiv'}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {item.rule.discardQueryParams ? (
                    <Badge variant="outline" className="text-[10px] h-5 px-1 bg-orange-50 text-orange-700 border-orange-200">
                      Entfernen
                    </Badge>
                  ) : item.rule.forwardQueryParams ? (
                    <Badge variant="outline" className="text-[10px] h-5 px-1 bg-blue-50 text-blue-700 border-blue-200">
                      Behalten
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
});

ImportPreviewTable.displayName = "ImportPreviewTable";

export { ImportPreviewTable };

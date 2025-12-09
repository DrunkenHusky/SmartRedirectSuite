
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

interface ImportPreviewTableProps {
  data: any[];
  sortConfig: {
    by: 'status' | 'matcher' | 'targetUrl';
    order: 'asc' | 'desc';
  };
  onSort: (column: 'status' | 'matcher' | 'targetUrl') => void;
  limit: number;
}

const ImportPreviewTable = memo(({
  data,
  sortConfig,
  onSort,
  limit
}: ImportPreviewTableProps) => {

  const { columnWidths, handleResizeStart } = useResizableColumns({
    initialWidths: {
      status: 100,
      matcher: 250,
      targetUrl: 250,
      type: 120,
      auto: 120,
      query: 120,
    }
  });

  return (
    <div className="border rounded-md overflow-x-auto">
      <Table className="table-fixed min-w-full">
          <TableHeader>
              <TableRow>
                  <TableHead className="relative" style={{ width: columnWidths.status }}>
                      <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent font-medium w-full justify-start" onClick={() => onSort('status')}>
                        <span className="flex items-center gap-1 truncate">
                          Status {sortConfig.by === 'status' && (sortConfig.order === 'asc' ? <ArrowUp className="h-3 w-3 flex-shrink-0" /> : <ArrowDown className="h-3 w-3 flex-shrink-0" />)}
                        </span>
                      </Button>
                      <ResizeHandle onMouseDown={(e) => handleResizeStart('status', e)} />
                  </TableHead>
                  <TableHead className="relative" style={{ width: columnWidths.matcher }}>
                      <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent font-medium w-full justify-start" onClick={() => onSort('matcher')}>
                        <span className="flex items-center gap-1 truncate">
                          URL-Pfad Matcher {sortConfig.by === 'matcher' && (sortConfig.order === 'asc' ? <ArrowUp className="h-3 w-3 flex-shrink-0" /> : <ArrowDown className="h-3 w-3 flex-shrink-0" />)}
                        </span>
                      </Button>
                      <ResizeHandle onMouseDown={(e) => handleResizeStart('matcher', e)} />
                  </TableHead>
                  <TableHead className="relative" style={{ width: columnWidths.targetUrl }}>
                      <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent font-medium w-full justify-start" onClick={() => onSort('targetUrl')}>
                        <span className="flex items-center gap-1 truncate">
                          Ziel-URL {sortConfig.by === 'targetUrl' && (sortConfig.order === 'asc' ? <ArrowUp className="h-3 w-3 flex-shrink-0" /> : <ArrowDown className="h-3 w-3 flex-shrink-0" />)}
                        </span>
                      </Button>
                      <ResizeHandle onMouseDown={(e) => handleResizeStart('targetUrl', e)} />
                  </TableHead>
                  <TableHead className="relative" style={{ width: columnWidths.type }}>
                    Typ
                    <ResizeHandle onMouseDown={(e) => handleResizeStart('type', e)} />
                  </TableHead>
                  <TableHead className="relative" style={{ width: columnWidths.auto }}>
                    Auto-Redirect
                    <ResizeHandle onMouseDown={(e) => handleResizeStart('auto', e)} />
                  </TableHead>
                  <TableHead className="relative" style={{ width: columnWidths.query }}>
                    Query Parameter
                    <ResizeHandle onMouseDown={(e) => handleResizeStart('query', e)} />
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
                          <Badge variant="outline" className="text-[10px] h-5 px-1 bg-orange-50 text-orange-700 border-orange-200 inline-block max-w-full truncate">
                            Entfernen
                          </Badge>
                        ) : item.rule.forwardQueryParams ? (
                          <Badge variant="outline" className="text-[10px] h-5 px-1 bg-blue-50 text-blue-700 border-blue-200 inline-block max-w-full truncate">
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

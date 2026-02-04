import React, { memo, useState } from 'react';
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
  ArrowDown,
  ChevronDown,
  ChevronRight
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

const PreviewRow = ({ item }: { item: any }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const rule = item.rule;

  return (
    <>
      <TableRow
        className={`cursor-pointer hover:bg-muted/50 ${!item.isValid ? "bg-red-50/50" : ""}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
          <TableCell>
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <Badge variant="outline" className={
                  item.status === 'new' ? "bg-green-50 text-green-700 border-green-200" :
                  item.status === 'update' ? "bg-blue-50 text-blue-700 border-blue-200" :
                  "bg-red-50 text-red-700 border-red-200"
                }>
                  {item.status === 'new' ? 'Neu' : item.status === 'update' ? 'Update' : 'Ungültig'}
                </Badge>
              </div>
          </TableCell>
          <TableCell className="font-mono text-xs">
            <div className="w-full" title={rule.matcher || ''}>
              {rule.matcher ? (
                <Badge variant="secondary" className="truncate max-w-full inline-block align-middle">
                  {rule.matcher}
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
            {rule.targetUrl ? (
              <div className="w-full" title={rule.targetUrl}>
                <code className="text-xs bg-muted px-2 py-1 rounded inline-block max-w-full truncate align-middle">
                  {rule.targetUrl}
                </code>
              </div>
            ) : (
              <span className="text-xs italic text-muted-foreground">
                -
              </span>
            )}
          </TableCell>
          <TableCell className="text-xs">
              <Badge variant={(rule as any).redirectType === 'wildcard' ? 'destructive' : (rule as any).redirectType === 'domain' ? 'outline' : 'default'}>
                {(rule as any).redirectType === 'wildcard' ? 'Vollständig' : (rule as any).redirectType === 'domain' ? 'Domain' : 'Teilweise'}
              </Badge>
          </TableCell>
          <TableCell className="text-xs">
              <Badge variant={rule.autoRedirect ? 'default' : 'secondary'}>
                {rule.autoRedirect ? '✓ Aktiv' : '✗ Inaktiv'}
              </Badge>
          </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow className={!item.isValid ? "bg-red-50/30" : "bg-muted/10"}>
           <TableCell colSpan={5} className="p-0">
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                 <div className="space-y-2">
                    <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">Query Parameters</h4>
                    <div className="space-y-1 pl-2 border-l-2 border-muted">
                        <div className="flex gap-2 text-xs py-1 border-b border-muted/50">
                            <span>Mode:</span>
                            <span className="font-medium">
                                {rule.discardQueryParams ? 'Discard All' : rule.forwardQueryParams ? 'Keep All' : 'Default (Keep)'}
                            </span>
                        </div>
                        {rule.keptQueryParams && rule.keptQueryParams.length > 0 && (
                            <div className="pt-1">
                                <span className="text-xs font-medium block mb-1">Kept Params (Exceptions):</span>
                                <ul className="list-disc list-inside text-xs space-y-0.5 text-muted-foreground">
                                    {rule.keptQueryParams.map((p: any, i: number) => (
                                        <li key={i}>
                                            <code className="bg-muted px-1 rounded">{p.keyPattern}</code>
                                            {p.targetKey && <span> &rarr; {p.targetKey}</span>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {rule.staticQueryParams && rule.staticQueryParams.length > 0 && (
                            <div className="pt-1">
                                <span className="text-xs font-medium block mb-1">Static Params (Appended):</span>
                                <ul className="list-disc list-inside text-xs space-y-0.5 text-muted-foreground">
                                    {rule.staticQueryParams.map((p: any, i: number) => (
                                        <li key={i}>
                                            <code className="bg-muted px-1 rounded">{p.key}</code> = <code className="bg-muted px-1 rounded">{p.value}</code>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                 </div>

                 <div className="space-y-2">
                    <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">Search & Replace</h4>
                    {rule.searchAndReplace && rule.searchAndReplace.length > 0 ? (
                        <div className="space-y-1 pl-2 border-l-2 border-muted">
                            <ul className="space-y-1 text-xs">
                                {rule.searchAndReplace.map((sr: any, i: number) => (
                                    <li key={i} className="flex flex-col bg-background p-1.5 rounded border">
                                        <div className="flex items-center gap-1">
                                            <span className="text-red-500 font-mono">"{sr.search}"</span>
                                            <span>&rarr;</span>
                                            <span className="text-green-600 font-mono">"{sr.replace || '"" (REMOVE)'}"</span>
                                        </div>
                                        {sr.caseSensitive && <Badge variant="outline" className="w-fit text-[10px] h-4 mt-1">Case Sensitive</Badge>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground italic pl-2">Keine Suchen & Ersetzen Regeln.</p>
                    )}
                 </div>

                 {rule.infoText && (
                    <div className="md:col-span-2 space-y-1">
                         <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">Info / Beschreibung</h4>
                         <p className="text-xs pl-2 border-l-2 border-muted">{rule.infoText}</p>
                    </div>
                 )}
              </div>
           </TableCell>
        </TableRow>
      )}
    </>
  );
};

const ImportPreviewTable = memo(({
  data,
  sortConfig,
  onSort,
  limit
}: ImportPreviewTableProps) => {

  const { columnWidths, handleResizeStart } = useResizableColumns({
    initialWidths: {
      status: 120,
      matcher: 250,
      targetUrl: 250,
      type: 120,
      auto: 100,
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
                    Auto
                    <ResizeHandle onMouseDown={(e) => handleResizeStart('auto', e)} />
                  </TableHead>
              </TableRow>
          </TableHeader>
          <TableBody>
              {data
                .slice(0, limit)
                .map((item, i) => (
                  <PreviewRow key={i} item={item} />
              ))}
          </TableBody>
      </Table>
    </div>
  );
});

ImportPreviewTable.displayName = "ImportPreviewTable";

export { ImportPreviewTable };

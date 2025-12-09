
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
  ArrowDown,
  Edit,
  Trash2
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useResizableColumns } from "@/hooks/useResizableColumns";
import { ResizeHandle } from "@/components/ui/resize-handle";
import type { UrlRule } from "@shared/schema";

interface RulesTableProps {
  rules: UrlRule[];
  selectedRuleIds: string[];
  sortConfig: {
    by: 'matcher' | 'targetUrl' | 'createdAt';
    order: 'asc' | 'desc';
  };
  onSort: (column: 'matcher' | 'targetUrl' | 'createdAt') => void;
  onSelectRule: (ruleId: string) => void;
  onSelectAll: (checked: boolean) => void;
  onEditRule: (rule: UrlRule) => void;
  onDeleteRule: (ruleId: string) => void;
}

const RulesTable = memo(({
  rules,
  selectedRuleIds,
  sortConfig,
  onSort,
  onSelectRule,
  onSelectAll,
  onEditRule,
  onDeleteRule
}: RulesTableProps) => {

  const allSelected = rules.length > 0 && rules.every(rule => selectedRuleIds.includes(rule.id));

  const { columnWidths, startResizing } = useResizableColumns({
    select: '50px',
    matcher: '19%',
    targetUrl: '19%',
    type: '9%',
    autoRedirect: '9%',
    queryParams: '9%',
    info: '14%',
    createdAt: '9%',
    actions: '80px'
  });

  return (
    <div className="hidden lg:block w-full">
      <Table className="w-full table-fixed">
        <TableHeader>
          <TableRow className="border-b border-border">
            <TableHead className="text-left py-3 px-4 relative" style={{ width: columnWidths.select }}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="rounded border border-gray-300 focus:ring-2 focus:ring-blue-500"
                title="Alle Regeln auf dieser Seite auswählen/abwählen"
              />
              <ResizeHandle onMouseDown={(e) => startResizing('select', e)} />
            </TableHead>
            <TableHead className="text-left py-3 px-4 relative" style={{ width: columnWidths.matcher }}>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-medium text-sm hover:bg-transparent"
                onClick={() => onSort('matcher')}
              >
                <span className="flex items-center gap-1">
                  URL-Pfad Matcher
                  {sortConfig.by === 'matcher' && (
                    sortConfig.order === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </span>
              </Button>
              <ResizeHandle onMouseDown={(e) => startResizing('matcher', e)} />
            </TableHead>
            <TableHead className="text-left py-3 px-4 relative" style={{ width: columnWidths.targetUrl }}>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-medium text-sm hover:bg-transparent"
                onClick={() => onSort('targetUrl')}
              >
                <span className="flex items-center gap-1">
                  Ziel-URL
                  {sortConfig.by === 'targetUrl' && (
                    sortConfig.order === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </span>
              </Button>
              <ResizeHandle onMouseDown={(e) => startResizing('targetUrl', e)} />
            </TableHead>
            <TableHead className="text-left py-3 px-4 text-sm font-medium text-foreground relative" style={{ width: columnWidths.type }}>
              Typ
              <ResizeHandle onMouseDown={(e) => startResizing('type', e)} />
            </TableHead>
            <TableHead className="text-left py-3 px-4 text-sm font-medium text-foreground relative" style={{ width: columnWidths.autoRedirect }}>
              Auto-Redirect
              <ResizeHandle onMouseDown={(e) => startResizing('autoRedirect', e)} />
            </TableHead>
            <TableHead className="text-left py-3 px-4 text-sm font-medium text-foreground relative" style={{ width: columnWidths.queryParams }}>
              Query Parameter
              <ResizeHandle onMouseDown={(e) => startResizing('queryParams', e)} />
            </TableHead>
            <TableHead className="text-left py-3 px-4 text-sm font-medium text-foreground relative" style={{ width: columnWidths.info }}>
              Info-Text
              <ResizeHandle onMouseDown={(e) => startResizing('info', e)} />
            </TableHead>
            <TableHead className="text-left py-3 px-4 relative" style={{ width: columnWidths.createdAt }}>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-medium text-sm hover:bg-transparent"
                onClick={() => onSort('createdAt')}
              >
                <span className="flex items-center gap-1">
                  Erstellt am
                  {sortConfig.by === 'createdAt' && (
                    sortConfig.order === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </span>
              </Button>
              <ResizeHandle onMouseDown={(e) => startResizing('createdAt', e)} />
            </TableHead>
            <TableHead className="text-left py-3 px-4 text-sm font-medium text-foreground relative" style={{ width: columnWidths.actions }}>
              Aktionen
              <ResizeHandle onMouseDown={(e) => startResizing('actions', e)} />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule: UrlRule) => (
            <TableRow key={rule.id} className="border-b border-border hover:bg-muted/50">
              <TableCell className="py-3 px-4">
                <input
                  type="checkbox"
                  checked={selectedRuleIds.includes(rule.id)}
                  onChange={() => onSelectRule(rule.id)}
                  className="rounded border border-gray-300 focus:ring-2 focus:ring-blue-500"
                />
              </TableCell>
              <TableCell className="py-3 px-4">
                <div className="w-full" title={rule.matcher}>
                  <Badge variant="secondary" className="truncate max-w-full inline-block align-middle">
                    {rule.matcher}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="py-3 px-4 text-sm">
                {rule.targetUrl ? (
                  <div className="w-full" title={rule.targetUrl}>
                    <code className="text-xs bg-muted px-2 py-1 rounded inline-block max-w-full truncate align-middle">
                      {rule.targetUrl}
                    </code>
                  </div>
                ) : (
                  <span className="italic text-muted-foreground">
                    Automatisch generiert
                  </span>
                )}
              </TableCell>
              <TableCell className="py-3 px-4">
                <Badge variant={(rule as any).redirectType === 'wildcard' ? 'destructive' : (rule as any).redirectType === 'domain' ? 'outline' : 'default'}>
                  {(rule as any).redirectType === 'wildcard' ? 'Vollständig' : (rule as any).redirectType === 'domain' ? 'Domain' : 'Teilweise'}
                </Badge>
              </TableCell>
              <TableCell className="py-3 px-4">
                <Badge variant={rule.autoRedirect ? 'default' : 'secondary'}>
                  {rule.autoRedirect ? '✓ Aktiv' : '✗ Inaktiv'}
                </Badge>
              </TableCell>
              <TableCell className="py-3 px-4 text-xs">
                {rule.discardQueryParams ? (
                  <Badge variant="outline" className="text-[10px] h-5 px-1 bg-orange-50 text-orange-700 border-orange-200">
                    Entfernen
                  </Badge>
                ) : rule.forwardQueryParams ? (
                  <Badge variant="outline" className="text-[10px] h-5 px-1 bg-blue-50 text-blue-700 border-blue-200">
                    Behalten
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="py-3 px-4 text-sm text-muted-foreground">
                {rule.infoText ? rule.infoText.substring(0, 50) + "..." : "-"}
              </TableCell>
              <TableCell className="py-3 px-4 text-xs text-muted-foreground">
                {rule.createdAt ? new Date(rule.createdAt).toLocaleDateString('de-DE') : '-'}
              </TableCell>
              <TableCell className="py-3 px-4">
                <div className="flex space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditRule(rule)}
                    title="Bearbeiten"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        title="Löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Regel löschen</AlertDialogTitle>
                        <AlertDialogDescription>
                          Sind Sie sicher, dass Sie diese Regel löschen möchten?
                          Diese Aktion kann nicht rückgängig gemacht werden.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onDeleteRule(rule.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Löschen
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
});

RulesTable.displayName = "RulesTable";

export { RulesTable };

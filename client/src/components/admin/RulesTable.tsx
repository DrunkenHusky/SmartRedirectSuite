
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
import type { UrlRule } from "@shared/schema";
import { ResizeHandle } from "@/components/ui/resize-handle";

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

  // Initial widths matching the previous classNames
  const [colWidths, setColWidths] = useState<Record<string, string | number>>({
    checkbox: 50,
    matcher: '19%',
    targetUrl: '19%',
    type: '9%',
    autoRedirect: '9%',
    queryParam: '9%',
    info: '14%',
    createdAt: '9%',
    actions: 80
  });

  const handleResize = (key: string, newWidth: number) => {
    setColWidths(prev => ({
      ...prev,
      [key]: newWidth
    }));
  };

  return (
    <div className="hidden lg:block w-full overflow-x-auto">
      <table className="w-full table-fixed min-w-[1000px]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-4 relative" style={{ width: colWidths.checkbox }}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="rounded border border-gray-300 focus:ring-2 focus:ring-blue-500"
                title="Alle Regeln auf dieser Seite auswählen/abwählen"
              />
              <ResizeHandle onResize={(w) => handleResize('checkbox', w)} />
            </th>
            <th className="text-left py-3 px-4 relative" style={{ width: colWidths.matcher }}>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-medium text-sm hover:bg-transparent w-full justify-start"
                onClick={() => onSort('matcher')}
              >
                <span className="flex items-center gap-1 truncate">
                  URL-Pfad Matcher
                  {sortConfig.by === 'matcher' && (
                    sortConfig.order === 'asc' ? <ArrowUp className="h-3 w-3 flex-shrink-0" /> : <ArrowDown className="h-3 w-3 flex-shrink-0" />
                  )}
                </span>
              </Button>
              <ResizeHandle onResize={(w) => handleResize('matcher', w)} />
            </th>
            <th className="text-left py-3 px-4 relative" style={{ width: colWidths.targetUrl }}>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-medium text-sm hover:bg-transparent w-full justify-start"
                onClick={() => onSort('targetUrl')}
              >
                <span className="flex items-center gap-1 truncate">
                  Ziel-URL
                  {sortConfig.by === 'targetUrl' && (
                    sortConfig.order === 'asc' ? <ArrowUp className="h-3 w-3 flex-shrink-0" /> : <ArrowDown className="h-3 w-3 flex-shrink-0" />
                  )}
                </span>
              </Button>
              <ResizeHandle onResize={(w) => handleResize('targetUrl', w)} />
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-foreground relative" style={{ width: colWidths.type }}>
              <span className="truncate block">Typ</span>
              <ResizeHandle onResize={(w) => handleResize('type', w)} />
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-foreground relative" style={{ width: colWidths.autoRedirect }}>
              <span className="truncate block">Auto-Redirect</span>
              <ResizeHandle onResize={(w) => handleResize('autoRedirect', w)} />
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-foreground relative" style={{ width: colWidths.queryParam }}>
              <span className="truncate block">Query Parameter</span>
              <ResizeHandle onResize={(w) => handleResize('queryParam', w)} />
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-foreground relative" style={{ width: colWidths.info }}>
              <span className="truncate block">Info-Text</span>
              <ResizeHandle onResize={(w) => handleResize('info', w)} />
            </th>
            <th className="text-left py-3 px-4 relative" style={{ width: colWidths.createdAt }}>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-medium text-sm hover:bg-transparent w-full justify-start"
                onClick={() => onSort('createdAt')}
              >
                <span className="flex items-center gap-1 truncate">
                  Erstellt am
                  {sortConfig.by === 'createdAt' && (
                    sortConfig.order === 'asc' ? <ArrowUp className="h-3 w-3 flex-shrink-0" /> : <ArrowDown className="h-3 w-3 flex-shrink-0" />
                  )}
                </span>
              </Button>
              <ResizeHandle onResize={(w) => handleResize('createdAt', w)} />
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-foreground relative" style={{ width: colWidths.actions }}>
              <span className="truncate block">Aktionen</span>
              <ResizeHandle onResize={(w) => handleResize('actions', w)} />
            </th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule: UrlRule) => (
            <tr key={rule.id} className="border-b border-border hover:bg-muted/50">
              <td className="py-3 px-4">
                <input
                  type="checkbox"
                  checked={selectedRuleIds.includes(rule.id)}
                  onChange={() => onSelectRule(rule.id)}
                  className="rounded border border-gray-300 focus:ring-2 focus:ring-blue-500"
                />
              </td>
              <td className="py-3 px-4">
                <div className="w-full" title={rule.matcher}>
                  <Badge variant="secondary" className="truncate max-w-full inline-block align-middle">
                    {rule.matcher}
                  </Badge>
                </div>
              </td>
              <td className="py-3 px-4 text-sm">
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
              </td>
              <td className="py-3 px-4">
                <Badge variant={(rule as any).redirectType === 'wildcard' ? 'destructive' : (rule as any).redirectType === 'domain' ? 'outline' : 'default'}>
                  {(rule as any).redirectType === 'wildcard' ? 'Vollständig' : (rule as any).redirectType === 'domain' ? 'Domain' : 'Teilweise'}
                </Badge>
              </td>
              <td className="py-3 px-4">
                <Badge variant={rule.autoRedirect ? 'default' : 'secondary'}>
                  {rule.autoRedirect ? '✓ Aktiv' : '✗ Inaktiv'}
                </Badge>
              </td>
              <td className="py-3 px-4 text-xs">
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
              </td>
              <td className="py-3 px-4 text-sm text-muted-foreground">
                <div className="truncate w-full" title={rule.infoText || ""}>
                  {rule.infoText || "-"}
                </div>
              </td>
              <td className="py-3 px-4 text-xs text-muted-foreground">
                {rule.createdAt ? new Date(rule.createdAt).toLocaleDateString('de-DE') : '-'}
              </td>
              <td className="py-3 px-4">
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

RulesTable.displayName = "RulesTable";

export { RulesTable };

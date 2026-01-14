
import React, { memo } from 'react';
import { useTranslation } from "react-i18next";
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
import { useResizableColumns } from "@/hooks/useResizableColumns";
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
  const { t } = useTranslation();

  const allSelected = rules.length > 0 && rules.every(rule => selectedRuleIds.includes(rule.id));

  const { columnWidths, handleResizeStart } = useResizableColumns({
    initialWidths: {
      checkbox: 50,
      matcher: 250,
      targetUrl: 250,
      type: 120,
      auto: 100,
      query: 120,
      info: 180,
      createdAt: 130,
      actions: 80,
    }
  });

  return (
    <div className="hidden lg:block w-full overflow-x-auto">
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th
              className="text-left py-3 px-4 relative"
              style={{ width: columnWidths.checkbox }}
            >
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="rounded border border-gray-300 focus:ring-2 focus:ring-blue-500"
                title="Alle Regeln auf dieser Seite auswählen/abwählen"
              />
              <ResizeHandle onMouseDown={(e) => handleResizeStart('checkbox', e)} />
            </th>
            <th
              className="text-left py-3 px-4 relative"
              style={{ width: columnWidths.matcher }}
            >
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-medium text-sm hover:bg-transparent w-full justify-start"
                onClick={() => onSort('matcher')}
              >
                <span className="flex items-center gap-1 truncate">
                  {t('rules.matcher')}
                  {sortConfig.by === 'matcher' && (
                    sortConfig.order === 'asc' ? <ArrowUp className="h-3 w-3 flex-shrink-0" /> : <ArrowDown className="h-3 w-3 flex-shrink-0" />
                  )}
                </span>
              </Button>
              <ResizeHandle onMouseDown={(e) => handleResizeStart('matcher', e)} />
            </th>
            <th
              className="text-left py-3 px-4 relative"
              style={{ width: columnWidths.targetUrl }}
            >
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-medium text-sm hover:bg-transparent w-full justify-start"
                onClick={() => onSort('targetUrl')}
              >
                <span className="flex items-center gap-1 truncate">
                  {t('rules.target')}
                  {sortConfig.by === 'targetUrl' && (
                    sortConfig.order === 'asc' ? <ArrowUp className="h-3 w-3 flex-shrink-0" /> : <ArrowDown className="h-3 w-3 flex-shrink-0" />
                  )}
                </span>
              </Button>
              <ResizeHandle onMouseDown={(e) => handleResizeStart('targetUrl', e)} />
            </th>
            <th
              className="text-left py-3 px-4 text-sm font-medium text-foreground relative"
              style={{ width: columnWidths.type }}
            >
              {t('rules.type')}
              <ResizeHandle onMouseDown={(e) => handleResizeStart('type', e)} />
            </th>
            <th
              className="text-left py-3 px-4 text-sm font-medium text-foreground relative"
              style={{ width: columnWidths.auto }}
            >
              Auto-Redirect
              <ResizeHandle onMouseDown={(e) => handleResizeStart('auto', e)} />
            </th>
            <th
              className="text-left py-3 px-4 text-sm font-medium text-foreground relative"
              style={{ width: columnWidths.query }}
            >
              Query Parameter
              <ResizeHandle onMouseDown={(e) => handleResizeStart('query', e)} />
            </th>
            <th
              className="text-left py-3 px-4 text-sm font-medium text-foreground relative"
              style={{ width: columnWidths.info }}
            >
              Info-Text
              <ResizeHandle onMouseDown={(e) => handleResizeStart('info', e)} />
            </th>
            <th
              className="text-left py-3 px-4 relative"
              style={{ width: columnWidths.createdAt }}
            >
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-medium text-sm hover:bg-transparent w-full justify-start"
                onClick={() => onSort('createdAt')}
              >
                <span className="flex items-center gap-1 truncate">
                  {t('rules.created')}
                  {sortConfig.by === 'createdAt' && (
                    sortConfig.order === 'asc' ? <ArrowUp className="h-3 w-3 flex-shrink-0" /> : <ArrowDown className="h-3 w-3 flex-shrink-0" />
                  )}
                </span>
              </Button>
              <ResizeHandle onMouseDown={(e) => handleResizeStart('createdAt', e)} />
            </th>
            <th
              className="text-left py-3 px-4 text-sm font-medium text-foreground relative"
              style={{ width: columnWidths.actions }}
            >
              {t('rules.actions')}
              <ResizeHandle onMouseDown={(e) => handleResizeStart('actions', e)} />
            </th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule: UrlRule) => (
            <tr key={rule.id} className="border-b border-border hover:bg-muted/50">
              <td className="py-3 px-4 truncate">
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
                  <Badge variant="outline" className="text-[10px] h-5 px-1 bg-orange-50 text-orange-700 border-orange-200 inline-block max-w-full truncate">
                    Entfernen
                  </Badge>
                ) : rule.forwardQueryParams ? (
                  <Badge variant="outline" className="text-[10px] h-5 px-1 bg-blue-50 text-blue-700 border-blue-200 inline-block max-w-full truncate">
                    Behalten
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
              <td className="py-3 px-4 text-sm text-muted-foreground truncate" title={rule.infoText || ""}>
                {rule.infoText ? rule.infoText : "-"}
              </td>
              <td className="py-3 px-4 text-xs text-muted-foreground truncate">
                {rule.createdAt ? new Date(rule.createdAt).toLocaleDateString('de-DE') : '-'}
              </td>
              <td className="py-3 px-4">
                <div className="flex space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditRule(rule)}
                    title={t('common.edit')}
                    aria-label={t('common.edit')}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        title={t('common.delete')}
                        aria-label={t('common.delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('common.delete')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          Sind Sie sicher, dass Sie diese Regel löschen möchten?
                          Diese Aktion kann nicht rückgängig gemacht werden.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onDeleteRule(rule.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {t('common.delete')}
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

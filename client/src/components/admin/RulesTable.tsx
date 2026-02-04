import React, { memo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUp,
  ArrowDown,
  Edit,
  Trash2,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2
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
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());

  const allSelected = rules.length > 0 && rules.every(rule => selectedRuleIds.includes(rule.id));

  const toggleExpand = (ruleId: string) => {
    const newExpanded = new Set(expandedRules);
    if (newExpanded.has(ruleId)) {
      newExpanded.delete(ruleId);
    } else {
      newExpanded.add(ruleId);
    }
    setExpandedRules(newExpanded);
  };

  const expandAll = () => {
    setExpandedRules(new Set(rules.map(r => r.id)));
  };

  const collapseAll = () => {
    setExpandedRules(new Set());
  };

  const { columnWidths, handleResizeStart } = useResizableColumns({
    initialWidths: {
      expand: 40,
      checkbox: 40,
      matcher: 300,
      targetUrl: 300,
      type: 100,
      auto: 80,
      createdAt: 100,
      actions: 80,
    }
  });

  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={expandAll} className="h-8 text-xs">
          <Maximize2 className="h-3 w-3 mr-1" /> Expand All
        </Button>
        <Button variant="ghost" size="sm" onClick={collapseAll} className="h-8 text-xs">
          <Minimize2 className="h-3 w-3 mr-1" /> Collapse All
        </Button>
      </div>

      <div className="w-full overflow-x-auto border rounded-md">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="w-[40px] p-2"></th>
              <th
                className="text-left py-3 px-2 relative"
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
                className="text-left py-3 px-2 relative"
                style={{ width: columnWidths.matcher }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium text-sm hover:bg-transparent w-full justify-start"
                  onClick={() => onSort('matcher')}
                >
                  <span className="flex items-center gap-1 truncate">
                    Matcher
                    {sortConfig.by === 'matcher' && (
                      sortConfig.order === 'asc' ? <ArrowUp className="h-3 w-3 flex-shrink-0" /> : <ArrowDown className="h-3 w-3 flex-shrink-0" />
                    )}
                  </span>
                </Button>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('matcher', e)} />
              </th>
              <th
                className="text-left py-3 px-2 relative"
                style={{ width: columnWidths.targetUrl }}
              >
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
                <ResizeHandle onMouseDown={(e) => handleResizeStart('targetUrl', e)} />
              </th>
              <th
                className="text-left py-3 px-2 text-sm font-medium text-foreground relative"
                style={{ width: columnWidths.type }}
              >
                Typ
                <ResizeHandle onMouseDown={(e) => handleResizeStart('type', e)} />
              </th>
              <th
                className="text-left py-3 px-2 text-sm font-medium text-foreground relative"
                style={{ width: columnWidths.auto }}
              >
                Auto
                <ResizeHandle onMouseDown={(e) => handleResizeStart('auto', e)} />
              </th>
              <th
                className="text-left py-3 px-2 relative"
                style={{ width: columnWidths.createdAt }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium text-sm hover:bg-transparent w-full justify-start"
                  onClick={() => onSort('createdAt')}
                >
                  <span className="flex items-center gap-1 truncate">
                    Erstellt
                    {sortConfig.by === 'createdAt' && (
                      sortConfig.order === 'asc' ? <ArrowUp className="h-3 w-3 flex-shrink-0" /> : <ArrowDown className="h-3 w-3 flex-shrink-0" />
                    )}
                  </span>
                </Button>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('createdAt', e)} />
              </th>
              <th
                className="text-left py-3 px-2 text-sm font-medium text-foreground relative"
                style={{ width: columnWidths.actions }}
              >
                Action
                <ResizeHandle onMouseDown={(e) => handleResizeStart('actions', e)} />
              </th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule: UrlRule) => {
              const isExpanded = expandedRules.has(rule.id);
              return (
                <React.Fragment key={rule.id}>
                  <tr
                    className={`border-b border-border hover:bg-muted/50 ${isExpanded ? 'bg-muted/30' : ''}`}
                  >
                    <td className="p-2 text-center cursor-pointer" onClick={() => toggleExpand(rule.id)}>
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </td>
                    <td className="py-3 px-2 truncate">
                      <input
                        type="checkbox"
                        checked={selectedRuleIds.includes(rule.id)}
                        onChange={() => onSelectRule(rule.id)}
                        className="rounded border border-gray-300 focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-3 px-2 font-mono text-xs">
                      <div className="w-full truncate" title={rule.matcher}>
                        {rule.matcher}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-xs">
                      {rule.targetUrl ? (
                        <div className="w-full truncate" title={rule.targetUrl}>
                          {rule.targetUrl}
                        </div>
                      ) : (
                        <span className="italic text-muted-foreground">Auto</span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <Badge variant={(rule as any).redirectType === 'wildcard' ? 'destructive' : (rule as any).redirectType === 'domain' ? 'outline' : 'default'} className="text-[10px] px-1 h-5">
                        {(rule as any).redirectType === 'wildcard' ? 'Wild' : (rule as any).redirectType === 'domain' ? 'Dom' : 'Part'}
                      </Badge>
                    </td>
                    <td className="py-3 px-2">
                      {rule.autoRedirect && <Badge variant="default" className="text-[10px] px-1 h-5">On</Badge>}
                    </td>
                    <td className="py-3 px-2 text-xs text-muted-foreground truncate">
                      {rule.createdAt ? new Date(rule.createdAt).toLocaleDateString('de-DE') : '-'}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditRule(rule)}
                          className="h-6 w-6 p-0"
                          title="Bearbeiten"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              title="Löschen"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Regel löschen</AlertDialogTitle>
                              <AlertDialogDescription>
                                Sind Sie sicher?
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
                  {isExpanded && (
                    <tr className="bg-muted/10 border-b border-border">
                      <td colSpan={8} className="p-0">
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm break-words">
                           <div className="space-y-2">
                              <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">Parameter Konfiguration</h4>
                              <div className="space-y-1 pl-2 border-l-2 border-muted">
                                  <div className="flex items-center gap-2 text-xs py-1 border-b border-muted/50">
                                      <span>Handling Mode:</span>
                                      <span className="font-medium">
                                          {rule.discardQueryParams ? 'Discard All' : 'Default (Keep)'}
                                      </span>
                                  </div>
                                  {rule.keptQueryParams && rule.keptQueryParams.length > 0 && (
                                      <div className="pt-1">
                                          <span className="text-xs font-medium block mb-1">Ausnahmen (Kept):</span>
                                          <ul className="list-disc list-inside text-xs space-y-0.5 text-muted-foreground">
                                              {rule.keptQueryParams.map((p: any, i: number) => (
                                                  <li key={i}>
                                                      <code className="bg-muted px-1 rounded break-all">{p.keyPattern}</code>
                                                      {p.targetKey && <span> &rarr; {p.targetKey}</span>}
                                                  </li>
                                              ))}
                                          </ul>
                                      </div>
                                  )}
                                  {rule.staticQueryParams && rule.staticQueryParams.length > 0 && (
                                      <div className="pt-1">
                                          <span className="text-xs font-medium block mb-1">Statische Parameter:</span>
                                          <ul className="list-disc list-inside text-xs space-y-0.5 text-muted-foreground">
                                              {rule.staticQueryParams.map((p: any, i: number) => (
                                                  <li key={i}>
                                                      <code className="bg-muted px-1 rounded break-all">{p.key}</code> = <code className="bg-muted px-1 rounded break-all">{p.value}</code>
                                                  </li>
                                              ))}
                                          </ul>
                                      </div>
                                  )}
                              </div>
                           </div>

                           <div className="space-y-2">
                              <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">Suchen & Ersetzen</h4>
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
                                  <p className="text-xs text-muted-foreground italic pl-2">Keine.</p>
                              )}
                           </div>

                           {rule.infoText && (
                              <div className="md:col-span-2 space-y-1">
                                   <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">Info / Beschreibung</h4>
                                   <p className="text-xs pl-2 border-l-2 border-muted whitespace-pre-wrap">{rule.infoText}</p>
                              </div>
                           )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

RulesTable.displayName = "RulesTable";

export { RulesTable };

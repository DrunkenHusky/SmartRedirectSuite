import React, { memo, useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowUp,
  ArrowDown,
  Edit,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Zap,
  Settings,
  Globe
} from "lucide-react";
import type { UrlRule } from "@shared/schema";
import { useResizableColumns } from "@/hooks/useResizableColumns";
import { ResizeHandle } from "@/components/ui/resize-handle";

const STORAGE_KEY = 'stats-table-visible-columns';

interface StatsTableProps {
  entries: any[];
  sortConfig: {
    by: string;
    order: 'asc' | 'desc';
  };
  onSort: (column: string) => void;
  onEditRule: (rule: UrlRule) => void;
  formatTimestamp: (timestamp: string) => string;
  showReferrer?: boolean;
  enableLinkQuality?: boolean;
  enableUserFeedback?: boolean;
  settings?: any;
  onNavigateToTab?: (tab: string) => void;
}

const StatsTable = memo(({
  entries,
  sortConfig,
  onSort,
  onEditRule,
  formatTimestamp,
  showReferrer = true,
  enableLinkQuality = true,
  enableUserFeedback = false,
  settings,
  onNavigateToTab
}: StatsTableProps) => {

  const [visibleColumns, setVisibleColumns] = useState(() => {
    const defaults = {
      timestamp: true,
      oldUrl: true,
      newUrl: true,
      path: true,
      referrer: showReferrer,
      rule: true,
      matchQuality: enableLinkQuality,
      feedback: enableUserFeedback,
      globalRules: true
    };
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...defaults, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Failed to load column visibility settings:', e);
    }
    return defaults;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns));
    } catch (e) {
      console.error('Failed to save column visibility settings:', e);
    }
  }, [visibleColumns]);

  const { columnWidths, handleResizeStart } = useResizableColumns({
    initialWidths: {
      timestamp: 150,
      oldUrl: 250,
      newUrl: 250,
      path: 200,
      referrer: 200,
      rule: 150,
      matchQuality: 100,
      feedback: 100,
      globalRules: 150,
    }
  });


  const getSortIcon = (column: string) => {
    if (sortConfig.by !== column) return <ArrowUp className="h-3 w-3 opacity-0" />;
    return sortConfig.order === 'asc' ? <ArrowUp className="h-3 w-3 flex-shrink-0" /> : <ArrowDown className="h-3 w-3 flex-shrink-0" />;
  };

  const toggleColumn = (column: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }));
  };

  return (
    <div className="space-y-4">
      {/* Column Visibility Toggle */}
      <div className="flex justify-end">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto">
              <Settings className="h-4 w-4 mr-2" />
              Spalten anpassen
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Spalten auswählen</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="flex items-center justify-between space-x-2">
                <label htmlFor="col-timestamp" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Zeitstempel</label>
                <Switch id="col-timestamp" checked={visibleColumns.timestamp} onCheckedChange={() => toggleColumn('timestamp')} />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <label htmlFor="col-oldUrl" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Alte URL</label>
                <Switch id="col-oldUrl" checked={visibleColumns.oldUrl} onCheckedChange={() => toggleColumn('oldUrl')} />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <label htmlFor="col-newUrl" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Neue URL</label>
                <Switch id="col-newUrl" checked={visibleColumns.newUrl} onCheckedChange={() => toggleColumn('newUrl')} />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <label htmlFor="col-path" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Pfad</label>
                <Switch id="col-path" checked={visibleColumns.path} onCheckedChange={() => toggleColumn('path')} />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <label htmlFor="col-referrer" className={`text-sm font-medium leading-none ${!showReferrer ? 'opacity-50' : ''}`}>Referrer {!showReferrer && '(Deaktiviert)'}</label>
                <Switch id="col-referrer" checked={visibleColumns.referrer && showReferrer} onCheckedChange={() => toggleColumn('referrer')} disabled={!showReferrer} />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <label htmlFor="col-rule" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Regel</label>
                <Switch id="col-rule" checked={visibleColumns.rule} onCheckedChange={() => toggleColumn('rule')} />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <label htmlFor="col-matchQuality" className={`text-sm font-medium leading-none ${!enableLinkQuality ? 'opacity-50' : ''}`}>Qualität {!enableLinkQuality && '(Deaktiviert)'}</label>
                <Switch id="col-matchQuality" checked={visibleColumns.matchQuality && enableLinkQuality} onCheckedChange={() => toggleColumn('matchQuality')} disabled={!enableLinkQuality} />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <label htmlFor="col-feedback" className={`text-sm font-medium leading-none ${!enableUserFeedback ? 'opacity-50' : ''}`}>Feedback {!enableUserFeedback && '(Deaktiviert)'}</label>
                <Switch id="col-feedback" checked={visibleColumns.feedback && enableUserFeedback} onCheckedChange={() => toggleColumn('feedback')} disabled={!enableUserFeedback} />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <label htmlFor="col-globalRules" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Globale Regeln</label>
                <Switch id="col-globalRules" checked={visibleColumns.globalRules} onCheckedChange={() => toggleColumn('globalRules')} />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="w-full overflow-x-auto">
      <table className="w-full table-fixed border-collapse">
        <thead className="bg-muted/50 border-b">
          <tr>
            {visibleColumns.timestamp && (
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
            )}
            {visibleColumns.oldUrl && (
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
            )}
            {visibleColumns.newUrl && (
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
            )}
            {visibleColumns.path && (
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
            )}
            {visibleColumns.referrer && showReferrer && (
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
            )}
            {visibleColumns.rule && (
            <th className="text-left p-2 sm:p-3 font-medium text-xs sm:text-sm relative" style={{ width: columnWidths.rule }}>
              Regel
              <ResizeHandle onMouseDown={(e) => handleResizeStart('rule', e)} />
            </th>
            )}
            {visibleColumns.matchQuality && enableLinkQuality && (
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
            )}
            {visibleColumns.globalRules && (
            <th className="text-left p-2 sm:p-3 font-medium text-xs sm:text-sm relative" style={{ width: columnWidths.globalRules }}>
              Globale Regeln
              <ResizeHandle onMouseDown={(e) => handleResizeStart('globalRules', e)} />
            </th>
            )}
{visibleColumns.feedback && enableUserFeedback && (
            <th className="text-left p-2 sm:p-3 font-medium text-xs sm:text-sm relative" style={{ width: columnWidths.feedback }}>
              Feedback
              <ResizeHandle onMouseDown={(e) => handleResizeStart('feedback', e)} />
            </th>
            )}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry: any) => (
            <tr key={entry.id} className="border-b hover:bg-muted/50">
              {visibleColumns.timestamp && (
              <td className="p-2 sm:p-3 text-xs sm:text-sm truncate">
                {formatTimestamp(entry.timestamp)}
              </td>
              )}
              {visibleColumns.oldUrl && (
              <td className="p-2 sm:p-3">
                <div className="w-full" title={entry.oldUrl}>
                   <a
                     href={entry.oldUrl}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="text-[10px] sm:text-xs text-foreground hover:text-blue-600 dark:hover:text-blue-400 break-all inline-block max-w-full truncate align-middle"
                   >
                     <code>{entry.oldUrl}</code>
                   </a>
                </div>
              </td>
              )}
              {visibleColumns.newUrl && (
              <td className="p-2 sm:p-3">
                <div className="w-full" title={entry.newUrl || 'N/A'}>
                  {entry.newUrl ? (
                    <a
                      href={entry.newUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-400 hover:underline break-all inline-block max-w-full truncate align-middle font-mono"
                    >
                      {entry.newUrl}
                    </a>
                  ) : (
                    <code className="text-[10px] sm:text-xs text-foreground break-all inline-block max-w-full truncate align-middle">
                      N/A
                    </code>
                  )}
                </div>
              </td>
              )}
              {visibleColumns.path && (
              <td className="p-2 sm:p-3">
                <div className="w-full" title={entry.path}>
                    <code className="text-xs sm:text-sm text-foreground inline-block max-w-full truncate align-middle">
                        {entry.path}
                    </code>
                </div>
              </td>
              )}
              {visibleColumns.referrer && showReferrer && (
              <td className="p-2 sm:p-3">
                <div className="w-full" title={entry.referrer || 'Direct'}>
                  {entry.referrer ? (
                    <a
                      href={entry.referrer}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-400 hover:underline break-all inline-block max-w-full truncate align-middle font-mono"
                    >
                      {entry.referrer}
                    </a>
                  ) : (
                  entry.redirectStrategy === 'smart-search' ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-1 text-[10px] sm:text-xs bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400"
                        onClick={() => onNavigateToTab?.('general')}
                        title="Intelligente Suche (Fallback)"
                    >
                        <Settings className="h-3 w-3 mr-1" />
                        Smart Search
                    </Button>
                  ) : entry.redirectStrategy === 'domain-fallback' ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-1 text-[10px] sm:text-xs bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                        onClick={() => onNavigateToTab?.('general')}
                        title="Standard Domain-Weiterleitung (Fallback)"
                    >
                        <Settings className="h-3 w-3 mr-1" />
                        Domain Redirect
                    </Button>
                  ) : (
                    <span className="text-[10px] sm:text-xs text-muted-foreground">-</span>
                  )
                )}
                </div>
              </td>
              )}
              {visibleColumns.rule && (
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
              )}
              {visibleColumns.matchQuality && enableLinkQuality && (
              <td className="p-2 sm:p-3">
                <span className={`text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded-full ${
                  (entry.matchQuality || 0) >= 90 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  (entry.matchQuality || 0) >= 50 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {entry.matchQuality || 0}%
                </span>
              </td>
              )}
                          {visibleColumns.globalRules && (
              <td className="p-2 sm:p-3">
                {entry.appliedGlobalRules && entry.appliedGlobalRules.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {entry.appliedGlobalRules.map((rule: any, idx: number) => {
                        // Check if rule still exists in settings
                        let exists = false;
                        if (settings) {
                            if (rule.type === 'search') exists = (settings.globalSearchAndReplace || []).some((r: any) => r.id === rule.id);
                            else if (rule.type === 'static') exists = (settings.globalStaticQueryParams || []).some((r: any) => r.id === rule.id);
                            else if (rule.type === 'kept') exists = (settings.globalKeptQueryParams || []).some((r: any) => r.id === rule.id);
                        } else {
                            exists = true; // optimistic
                        }

                        return (
                          <Badge
                            key={idx}
                            variant="outline"
                            className={`text-[9px] px-1 py-0 h-auto cursor-pointer hover:bg-muted ${!exists ? 'opacity-50 line-through' : ''}`}
                            onClick={() => onNavigateToTab?.('global-rules')}
                            title={`${rule.description} ${!exists ? '(Gelöscht)' : ''}`}
                          >
                            <Globe className="h-2 w-2 mr-1 inline" />
                            {rule.description}
                          </Badge>
                        );
                    })}
                  </div>
                ) : (
                  <span className="text-[10px] sm:text-xs text-muted-foreground">-</span>
                )}
              </td>
              )}
              {visibleColumns.feedback && enableUserFeedback && (
              <td className="p-2 sm:p-3">
                {entry.feedback === 'OK' ? (
                  <ThumbsUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                ) : entry.feedback === 'auto-redirect' ? (
                  <div className="flex items-center gap-1" title="Automatische Weiterleitung">
                     <Zap className="h-4 w-4 text-blue-500" />
                     <span className="text-[10px] text-muted-foreground hidden lg:inline">Auto</span>
                  </div>
                ) : entry.feedback === 'NOK' ? (
                  <div className="flex flex-col gap-1">
                    <ThumbsDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                    {entry.userProposedUrl && (
                      <div className="mt-1 p-1.5 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900 rounded text-[10px] text-red-800 dark:text-red-300 max-w-[200px] break-all">
                        <span className="font-semibold block mb-0.5">Vorschlag:</span>
                        <a
                          href={entry.userProposedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-inherit"
                        >
                          {entry.userProposedUrl}
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
});

StatsTable.displayName = "StatsTable";

export { StatsTable };

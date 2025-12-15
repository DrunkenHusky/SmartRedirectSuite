
import React, { memo } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUp,
  ArrowDown,
  Edit,
  Trash2,
  Info
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

interface RulesCardListProps {
  rules: UrlRule[];
  sortConfig: {
    by: 'matcher' | 'targetUrl' | 'createdAt';
    order: 'asc' | 'desc';
  };
  onSort: (column: 'matcher' | 'targetUrl' | 'createdAt') => void;
  onEditRule: (rule: UrlRule) => void;
  onDeleteRule: (ruleId: string) => void;
}

const RulesCardList = memo(({
  rules,
  sortConfig,
  onSort,
  onEditRule,
  onDeleteRule
}: RulesCardListProps) => {

  return (
    <div className="lg:hidden space-y-3">
      {/* Sort Controls */}
      <div className="flex flex-wrap gap-2 pb-4 border-b border-border">
        <Button
          variant={sortConfig.by === 'matcher' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSort('matcher')}
          className="text-xs"
        >
          URL-Pfad
          {sortConfig.by === 'matcher' && (
            sortConfig.order === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />
          )}
        </Button>
        <Button
          variant={sortConfig.by === 'targetUrl' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSort('targetUrl')}
          className="text-xs"
        >
          Ziel-URL
          {sortConfig.by === 'targetUrl' && (
            sortConfig.order === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />
          )}
        </Button>
        <Button
          variant={sortConfig.by === 'createdAt' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSort('createdAt')}
          className="text-xs"
        >
          Erstellt am
          {sortConfig.by === 'createdAt' && (
            sortConfig.order === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />
          )}
        </Button>
      </div>

      {/* Multi-select info */}
      {rules.length > 1 && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
            <Info className="h-4 w-4 flex-shrink-0" />
            <span>
              <strong>Hinweis:</strong> Das Auswählen und Löschen mehrerer Regeln ist nur auf Desktop-Geräten verfügbar.
            </span>
          </div>
        </div>
      )}

      {rules.map((rule: UrlRule) => (
        <div key={rule.id} className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors">
          {/* Header with Matcher and Actions */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <Badge variant="secondary" className="mb-2 text-xs">
                {rule.matcher}
              </Badge>
              <div className="flex flex-wrap gap-2">
                <Badge variant={(rule as any).redirectType === 'wildcard' ? 'destructive' : (rule as any).redirectType === 'domain' ? 'outline' : 'default'} className="text-xs">
                  {(rule as any).redirectType === 'wildcard' ? 'Vollständig' : (rule as any).redirectType === 'domain' ? 'Domain' : 'Teilweise'}
                </Badge>
                <Badge variant={rule.autoRedirect ? 'default' : 'secondary'} className="text-xs">
                  {rule.autoRedirect ? '✓ Auto-Redirect' : '✗ Manuell'}
                </Badge>
                {rule.discardQueryParams ? (
                  <Badge variant="outline" className="text-[10px] h-5 px-1 bg-orange-50 text-orange-700 border-orange-200">
                    Params Entfernen
                  </Badge>
                ) : rule.forwardQueryParams ? (
                  <Badge variant="outline" className="text-[10px] h-5 px-1 bg-blue-50 text-blue-700 border-blue-200">
                    Params Behalten
                  </Badge>
                ) : null}
              </div>
            </div>
            <div className="flex space-x-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEditRule(rule)}
                title="Bearbeiten"
                aria-label={`Regel ${rule.matcher} bearbeiten`}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive h-8 w-8 p-0"
                    title="Löschen"
                    aria-label={`Regel ${rule.matcher} löschen`}
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
          </div>

          {/* Target URL */}
          <div className="mb-3">
            <div className="text-xs text-muted-foreground mb-1">Ziel-URL:</div>
            {rule.targetUrl ? (
              <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
                {rule.targetUrl}
              </code>
            ) : (
              <span className="text-xs italic text-muted-foreground">
                Automatisch generiert
              </span>
            )}
          </div>

          {/* Info Text */}
          {rule.infoText && (
            <div className="mb-3">
              <div className="text-xs text-muted-foreground mb-1">Info-Text:</div>
              <p className="text-xs text-foreground break-words">
                {rule.infoText.length > 100 ? rule.infoText.substring(0, 100) + "..." : rule.infoText}
              </p>
            </div>
          )}

          {/* Created Date */}
          <div className="text-xs text-muted-foreground">
            Erstellt: {rule.createdAt ? new Date(rule.createdAt).toLocaleDateString('de-DE') : '-'}
          </div>
        </div>
      ))}
    </div>
  );
});

RulesCardList.displayName = "RulesCardList";

export { RulesCardList };

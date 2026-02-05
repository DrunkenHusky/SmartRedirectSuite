const fs = require('fs');
const path = require('path');

const filePath = path.join('client', 'src', 'components', 'admin', 'StatsTable.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Import Globe
const importSearch = 'Settings\n} from "lucide-react";';
const importInsert = 'Settings,\n  Globe\n} from "lucide-react";';
content = content.replace(importSearch, importInsert);

// 2. Update Props Interface
const propsSearch = 'enableUserFeedback?: boolean;';
const propsInsert = 'enableUserFeedback?: boolean;\n  settings?: any;\n  onNavigateToTab?: (tab: string) => void;';
content = content.replace(propsSearch, propsInsert);

// 3. Update Props Destructuring
const destructureSearch = 'enableUserFeedback = false';
const destructureInsert = 'enableUserFeedback = false,\n  settings,\n  onNavigateToTab';
content = content.replace(destructureSearch, destructureInsert);

// 4. Update Initial Visible Columns
const visibleSearch = 'feedback: enableUserFeedback';
const visibleInsert = 'feedback: enableUserFeedback,\n      globalRules: true';
content = content.replace(visibleSearch, visibleInsert);

// 5. Update Initial Column Widths
const widthSearch = 'feedback: 100,';
const widthInsert = 'feedback: 100,\n      globalRules: 150,';
content = content.replace(widthSearch, widthInsert);

// 6. Add Column Toggle UI
const toggleSearch = '<Switch id="col-feedback" checked={visibleColumns.feedback && enableUserFeedback} onCheckedChange={() => toggleColumn(\'feedback\')} disabled={!enableUserFeedback} />';
const toggleInsert = `<Switch id="col-feedback" checked={visibleColumns.feedback && enableUserFeedback} onCheckedChange={() => toggleColumn('feedback')} disabled={!enableUserFeedback} />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <label htmlFor="col-globalRules" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Globale Regeln</label>
                <Switch id="col-globalRules" checked={visibleColumns.globalRules} onCheckedChange={() => toggleColumn('globalRules')} />`;
content = content.replace(toggleSearch, toggleInsert);

// 7. Add Column Header
const headerSearch = '{visibleColumns.feedback && enableUserFeedback && (';
const headerInsert = `{visibleColumns.globalRules && (
            <th className="text-left p-2 sm:p-3 font-medium text-xs sm:text-sm relative" style={{ width: columnWidths.globalRules }}>
              Globale Regeln
              <ResizeHandle onMouseDown={(e) => handleResizeStart('globalRules', e)} />
            </th>
            )}
            {visibleColumns.feedback && enableUserFeedback && (`;
content = content.replace(headerSearch, headerInsert);

// 8. Update Rule Column Logic (Fallback)
const ruleCellFallback = '(<span className="text-[10px] sm:text-xs text-muted-foreground">-</span>)';
const ruleCellNewContent = `(
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
                )`;

content = content.replace(
    /\) : \(\s*<span className="text-\[10px\] sm:text-xs text-muted-foreground">-<\/span>\s*\)\}/,
    `) : ${ruleCellNewContent}}`
);

// 9. Add Global Rules Column Cell
const cellSearch = '{visibleColumns.feedback && enableUserFeedback && (';
// Use explicit string concatenation to avoid template literal hell in bash
const cellInsert = `{visibleColumns.globalRules && (
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
                            className={\`text-[9px] px-1 py-0 h-auto cursor-pointer hover:bg-muted \${!exists ? 'opacity-50 line-through' : ''}\`}
                            onClick={() => onNavigateToTab?.('global-rules')}
                            title={\`\${rule.description} \${!exists ? '(Gelöscht)' : ''}\`}
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
              {visibleColumns.feedback && enableUserFeedback && (`;
content = content.replace(cellSearch, cellInsert);

fs.writeFileSync(filePath, content);
console.log('StatsTable updated');

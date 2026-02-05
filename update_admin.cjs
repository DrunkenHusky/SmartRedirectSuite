const fs = require('fs');
const path = require('path');

const filePath = path.join('client', 'src', 'pages', 'admin.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Import GlobalRulesSettings
const importSearch = 'import { SatisfactionChart } from "@/components/admin/SatisfactionChart";';
const importInsert = 'import { SatisfactionChart } from "@/components/admin/SatisfactionChart";\nimport { GlobalRulesSettings } from "@/components/admin/GlobalRulesSettings";';
content = content.replace(importSearch, importInsert);

// 2. Initialize state
const stateSearch = 'smartSearchRules: [] as { pattern: string; order: number; pathPattern?: string; searchUrl?: string; skipEncoding?: boolean }[],';
const stateInsert = `smartSearchRules: [] as { pattern: string; order: number; pathPattern?: string; searchUrl?: string; skipEncoding?: boolean }[],
    globalSearchAndReplace: [] as any[],
    globalStaticQueryParams: [] as any[],
    globalKeptQueryParams: [] as any[],`;
content = content.replace(stateSearch, stateInsert);

// 3. Initialize in useEffect
const effectSearch = 'smartSearchRules: settingsData.smartSearchRules || [],';
const effectInsert = `smartSearchRules: settingsData.smartSearchRules || [],
        globalSearchAndReplace: settingsData.globalSearchAndReplace || [],
        globalStaticQueryParams: settingsData.globalStaticQueryParams || [],
        globalKeptQueryParams: settingsData.globalKeptQueryParams || [],`;
content = content.replace(effectSearch, effectInsert);

// 4. Add Tab Trigger
const triggerSearch = '<TabsTrigger value="general"';
// We want to add it as the second tab (or anywhere reasonable). Let's put it after "Regeln" (rules)
// Wait, "Regeln" is "rules". "general" is first.
// The user asked for "Global Rules" tab.
// I'll put it after "rules" tab.
const triggerRulesSearch = '<TabsTrigger value="rules" className="flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-2 py-3 px-1 sm:px-3 text-xs sm:text-sm min-h-[56px] sm:min-h-[48px]">';
// I need to match the whole block or just insert before "stats".
const triggerStatsSearch = '<TabsTrigger value="stats"';
const triggerInsert = `<TabsTrigger value="global-rules" className="flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-2 py-3 px-1 sm:px-3 text-xs sm:text-sm min-h-[56px] sm:min-h-[48px]">
                  <Globe className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="truncate leading-tight text-center">Global</span>
                </TabsTrigger>
                <TabsTrigger value="stats"`;

content = content.replace(triggerStatsSearch, triggerInsert);

// 5. Update Grid columns for TabsList
// It was grid-cols-4. Now grid-cols-5.
const gridSearch = 'className="grid w-full grid-cols-4 h-auto"';
const gridReplace = 'className="grid w-full grid-cols-5 h-auto"';
content = content.replace(gridSearch, gridReplace);

// 6. Add Tab Content
// Insert before <TabsContent value="stats"
const contentStatsSearch = '<TabsContent value="stats" className="space-y-6">';
const contentInsert = `<TabsContent value="global-rules">
              <GlobalRulesSettings
                settings={generalSettings as any}
                onUpdate={(updates) => setGeneralSettings({ ...generalSettings, ...updates })}
              />
            </TabsContent>
            <TabsContent value="stats" className="space-y-6">`;

content = content.replace(contentStatsSearch, contentInsert);

// 7. Add Globe icon to imports
// Assuming Globe is not imported. I checked imports in step 1, it wasn't there.
// I need to add Globe to lucide-react imports.
const lucideSearch = 'Activity\n} from "lucide-react";';
const lucideReplace = 'Activity,\n  Globe\n} from "lucide-react";';
content = content.replace(lucideSearch, lucideReplace);

fs.writeFileSync(filePath, content);
console.log("Admin page updated");

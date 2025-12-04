
import { ImportExportService } from '../server/import-export';
import fs from 'fs';
import path from 'path';
import { UrlRule } from '../shared/schema';

const sampleRules: UrlRule[] = [
  {
    id: "uuid-placeholder-1", // Will be ignored on import if not matching existing
    matcher: "/old-page",
    targetUrl: "https://example.com/new-page",
    redirectType: "partial",
    autoRedirect: false,
    infoText: "Simple partial redirect",
    createdAt: new Date().toISOString()
  },
  {
    id: "uuid-placeholder-2",
    matcher: "/legacy-section",
    targetUrl: "https://example.com/modern-section",
    redirectType: "wildcard",
    autoRedirect: true,
    infoText: "Wildcard redirect with auto-redirect enabled",
    createdAt: new Date().toISOString()
  }
];

// Generate CSV
const csvContent = ImportExportService.generateCSV(sampleRules);
fs.writeFileSync(path.join(process.cwd(), 'sample-rules-import.csv'), csvContent);
console.log('Generated sample-rules-import.csv');

// Generate Excel
const excelBuffer = ImportExportService.generateExcel(sampleRules);
fs.writeFileSync(path.join(process.cwd(), 'sample-rules-import.xlsx'), excelBuffer);
console.log('Generated sample-rules-import.xlsx');


import { ImportExportService } from '../server/import-export';
import fs from 'fs';
import path from 'path';
import { UrlRule } from '../shared/schema';

// Simplified sample rules with only essential fields
const sampleRules: UrlRule[] = [
  {
    matcher: "/old-page",
    targetUrl: "https://example.com/new-page",
    redirectType: 'wildcard',
    infoText: 'Exact Page Redirect',
    autoRedirect: false
  } as any,
  {
    matcher: "/legacy-section",
    targetUrl: "https://example.com/modern-section",
    redirectType: 'partial',
    infoText: 'Section/Folder Redirect',
    autoRedirect: true
  } as any
];

// Custom generation to avoid optional columns in CSV/Excel for samples
import { stringify } from 'csv-stringify/sync';
import { utils, write } from '@e965/xlsx';

// 1. CSV
const csvData = sampleRules.map(r => ({
  ID: '', // ID column is useful for updates
  Matcher: r.matcher,
  'Target URL': r.targetUrl,
  Type: r.redirectType,
  Info: r.infoText,
  'Auto Redirect': r.autoRedirect
}));
const csvContent = stringify(csvData, { header: true });
fs.writeFileSync(path.join(process.cwd(), 'sample-rules-import.csv'), csvContent);
console.log('Generated sample-rules-import.csv');

// 2. Excel
const excelData = sampleRules.map(r => ({
  ID: '',
  Matcher: r.matcher,
  'Target URL': r.targetUrl,
  Type: r.redirectType,
  Info: r.infoText,
  'Auto Redirect': r.autoRedirect
}));
const workbook = utils.book_new();
const worksheet = utils.json_to_sheet(excelData);
utils.book_append_sheet(workbook, worksheet, 'Rules');
const excelBuffer = write(workbook, { type: 'buffer', bookType: 'xlsx' });
fs.writeFileSync(path.join(process.cwd(), 'sample-rules-import.xlsx'), excelBuffer as unknown as Buffer);
console.log('Generated sample-rules-import.xlsx');

// 3. JSON
const jsonRules = sampleRules.map(r => ({
  matcher: r.matcher,
  targetUrl: r.targetUrl,
  redirectType: r.redirectType,
  infoText: r.infoText,
  autoRedirect: r.autoRedirect
}));
const jsonContent = JSON.stringify(jsonRules, null, 2);
fs.writeFileSync(path.join(process.cwd(), 'sample-rules-import.json'), jsonContent);
console.log('Generated sample-rules-import.json');

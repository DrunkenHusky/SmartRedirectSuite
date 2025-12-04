
import { ImportExportService } from '../server/import-export';
import fs from 'fs';
import path from 'path';
import { UrlRule } from '../shared/schema';

// Simplified sample rules with only essential fields
const sampleRules: UrlRule[] = [
  {
    matcher: "/old-page",
    targetUrl: "https://example.com/new-page",
    // Optional fields are omitted in the source data for generation to keep the file clean
    // The generator might add empty columns if the interface expects them,
    // but we want minimal columns for the sample file.
  } as any,
  {
    matcher: "/legacy-section",
    targetUrl: "https://example.com/modern-section",
  } as any
];

// Custom generation to avoid optional columns in CSV/Excel for samples
import { stringify } from 'csv-stringify/sync';
import { utils, write } from 'xlsx';

// 1. CSV
const csvData = sampleRules.map(r => ({
  Matcher: r.matcher,
  'Target URL': r.targetUrl
}));
const csvContent = stringify(csvData, { header: true });
fs.writeFileSync(path.join(process.cwd(), 'sample-rules-import.csv'), csvContent);
console.log('Generated sample-rules-import.csv');

// 2. Excel
const excelData = sampleRules.map(r => ({
  Matcher: r.matcher,
  'Target URL': r.targetUrl
}));
const workbook = utils.book_new();
const worksheet = utils.json_to_sheet(excelData);
utils.book_append_sheet(workbook, worksheet, 'Rules');
const excelBuffer = write(workbook, { type: 'buffer', bookType: 'xlsx' });
fs.writeFileSync(path.join(process.cwd(), 'sample-rules-import.xlsx'), excelBuffer);
console.log('Generated sample-rules-import.xlsx');

// 3. JSON (Keep full structure or simplified? Usually JSON users are advanced, but consistency helps)
// Let's keep JSON simple too, but maybe with type hint
const jsonRules = sampleRules.map(r => ({
  matcher: r.matcher,
  targetUrl: r.targetUrl,
  redirectType: 'partial', // Hint at default
  infoText: 'Optional description'
}));
const jsonContent = JSON.stringify(jsonRules, null, 2);
fs.writeFileSync(path.join(process.cwd(), 'sample-rules-import.json'), jsonContent);
console.log('Generated sample-rules-import.json');

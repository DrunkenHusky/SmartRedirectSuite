
import { ImportExportService } from '../../server/import-export';
import { strict as assert } from 'assert';
import { utils, write } from 'xlsx';

async function testCsvParsing() {
  console.log('Testing CSV Parsing...');
  const csvContent = `Matcher,Target URL,Type,Auto Redirect
/old,https://new.com,partial,true
/wild,https://wild.com,wildcard,false
`;
  const buffer = Buffer.from(csvContent);
  const rawRules = ImportExportService.parseFile(buffer, 'test.csv');

  assert.equal(rawRules.length, 2);
  assert.equal(rawRules[0].Matcher, '/old');
  assert.equal(rawRules[0]['Target URL'], 'https://new.com');

  const normalized = ImportExportService.normalizeRules(rawRules);
  assert.equal(normalized.length, 2);

  const rule1 = normalized[0];
  assert.equal(rule1.isValid, true);
  assert.equal(rule1.rule.matcher, '/old');
  assert.equal(rule1.rule.targetUrl, 'https://new.com');
  assert.equal(rule1.rule.redirectType, 'partial');
  assert.equal(rule1.rule.autoRedirect, true);

  const rule2 = normalized[1];
  assert.equal(rule2.isValid, true);
  assert.equal(rule2.rule.redirectType, 'wildcard');
  assert.equal(rule2.rule.autoRedirect, false);

  console.log('CSV Parsing passed!');
}

async function testExcelParsing() {
  console.log('Testing Excel Parsing...');
  // Create a simple excel file in memory
  const data = [
    { Matcher: '/excel', 'Target URL': 'https://excel.com', Type: 'partial', 'Auto Redirect': 1 }
  ];
  const worksheet = utils.json_to_sheet(data);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, 'Rules');
  const buffer = write(workbook, { type: 'buffer', bookType: 'xlsx' });

  const rawRules = ImportExportService.parseFile(buffer, 'test.xlsx');
  assert.equal(rawRules.length, 1);

  const normalized = ImportExportService.normalizeRules(rawRules);
  assert.equal(normalized[0].rule.matcher, '/excel');
  assert.equal(normalized[0].rule.autoRedirect, true); // 1 should be converted to true

  console.log('Excel Parsing passed!');
}

async function testValidation() {
  console.log('Testing Validation...');

  const rawRules = [
    { Matcher: '', 'Target URL': 'https://valid.com' },
    { Matcher: '/valid', 'Target URL': '' }
  ];

  const normalized = ImportExportService.normalizeRules(rawRules);

  // Rule 1: Invalid because Matcher is empty
  assert.equal(normalized[0].isValid, false);
  assert.ok(normalized[0].errors.some(e => e.includes('Matcher')));

  console.log('Validation passed!');
}

async function runTests() {
  try {
    await testCsvParsing();
    await testExcelParsing();
    await testValidation();
    console.log('All tests passed successfully.');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

runTests();

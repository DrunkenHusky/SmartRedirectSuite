
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { storage } from '../../server/storage';

// Mock storage if needed, but integration tests usually run against the real server or storage module
// Since we are running this as a script via tsx, we can import storage directly.

const DATA_DIR = path.join(process.cwd(), 'data');
const RULES_FILE = path.join(DATA_DIR, 'rules.json');

async function resetRules() {
  await storage.clearAllRules();
}

async function runTest() {
  console.log('Starting parameter handling cleanup test...');
  await resetRules();

  // Test Case 1: Wildcard rule should not have discardQueryParams: true
  // User sets both, but for wildcard, only forwardQueryParams matters.
  // If discardQueryParams is stored as true, it's redundant/confusing.
  console.log('Creating wildcard rule with conflicting flags...');
  const wildcardRule = await storage.createUrlRule({
    matcher: '/wildcard-test',
    targetUrl: 'https://example.com',
    redirectType: 'wildcard',
    discardQueryParams: true, // Should be cleaned to false
    forwardQueryParams: true, // Should be kept
    autoRedirect: false
  });

  console.log('Wildcard rule created:', wildcardRule);

  // Test Case 2: Partial rule should not have forwardQueryParams: true
  // For partial, only discardQueryParams matters.
  console.log('Creating partial rule with conflicting flags...');
  const partialRule = await storage.createUrlRule({
    matcher: '/partial-test',
    targetUrl: 'https://example.com',
    redirectType: 'partial',
    discardQueryParams: true, // Should be kept
    forwardQueryParams: true, // Should be cleaned to false
    autoRedirect: false
  });

  console.log('Partial rule created:', partialRule);

  // Verify
  let failed = false;

  if (wildcardRule.discardQueryParams !== true) {
     console.log('PASS: Wildcard rule discardQueryParams is NOT true (it was cleaned or default behavior changed?) Wait, current behavior SHOULD be that it stores it as true if we pass true.');
  } else {
     console.log('FAIL (Expected for reproduction): Wildcard rule stored discardQueryParams: true');
     failed = true;
  }

  if (partialRule.forwardQueryParams !== true) {
      console.log('PASS: Partial rule forwardQueryParams is NOT true.');
  } else {
      console.log('FAIL (Expected for reproduction): Partial rule stored forwardQueryParams: true');
      failed = true;
  }

  if (failed) {
      console.log('Reproduction successful: Invalid flags are currently being stored.');
  } else {
      console.log('Reproduction failed: Invalid flags are already being cleaned?');
  }
}

runTest().catch(console.error);

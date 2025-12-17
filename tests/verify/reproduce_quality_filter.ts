
import fs from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';

// Setup temp environment
const originalCwd = process.cwd();
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-quality-'));
const dataDir = path.join(tmpDir, 'data');

console.log(`Setting up test environment in ${tmpDir}`);

fs.mkdirSync(dataDir, { recursive: true });

// Mock tracking data
const trackingData = [
  {
    id: randomUUID(),
    path: '/high-quality',
    oldUrl: 'http://old.com/high',
    timestamp: new Date().toISOString(),
    matchQuality: 100
  },
  {
    id: randomUUID(),
    path: '/medium-quality',
    oldUrl: 'http://old.com/medium',
    timestamp: new Date().toISOString(),
    matchQuality: 90
  },
  {
    id: randomUUID(),
    path: '/low-quality',
    oldUrl: 'http://old.com/low',
    timestamp: new Date().toISOString(),
    matchQuality: 50
  },
  {
    id: randomUUID(),
    path: '/no-quality',
    oldUrl: 'http://old.com/no',
    timestamp: new Date().toISOString(),
    matchQuality: 0
  },
  {
    id: randomUUID(),
    path: '/missing-quality',
    oldUrl: 'http://old.com/missing',
    timestamp: new Date().toISOString()
    // missing matchQuality
  }
];

fs.writeFileSync(path.join(dataDir, 'tracking.json'), JSON.stringify(trackingData, null, 2));
fs.writeFileSync(path.join(dataDir, 'rules.json'), '[]');
fs.writeFileSync(path.join(dataDir, 'settings.json'), '{}');

// Switch CWD so storage uses the temp dir
process.chdir(tmpDir);

// Now import storage (using dynamic import to ensure it runs after CWD change)
async function runTest() {
  try {
    // We need to import relative to the ORIGINAL CWD, but running in NEW CWD.
    // Absolute path to the module.
    const storagePath = path.join(originalCwd, 'server/storage.ts');
    const { storage } = await import(storagePath);

    console.log('Storage loaded. Testing filtering...');

    // Test 1: minQuality = 90
    console.log('\n--- Test 1: minQuality = 90 ---');
    const res1 = await storage.getTrackingEntriesPaginated(1, 10, undefined, 'timestamp', 'desc', 'all', 90, undefined);
    console.log(`Got ${res1.entries.length} entries.`);
    res1.entries.forEach(e => console.log(` - ${e.path}: ${e.matchQuality}`));

    if (res1.entries.length !== 2) console.error('FAIL: Expected 2 entries (100, 90)');
    if (!res1.entries.find(e => e.matchQuality === 100)) console.error('FAIL: Missing 100');
    if (!res1.entries.find(e => e.matchQuality === 90)) console.error('FAIL: Missing 90');

    // Test 2: maxQuality = 50
    console.log('\n--- Test 2: maxQuality = 50 ---');
    const res2 = await storage.getTrackingEntriesPaginated(1, 10, undefined, 'timestamp', 'desc', 'all', undefined, 50);
    console.log(`Got ${res2.entries.length} entries.`);
    res2.entries.forEach(e => console.log(` - ${e.path}: ${e.matchQuality}`));

    // Should get 50, 0, and missing (treated as 0)
    if (res2.entries.length !== 3) console.error('FAIL: Expected 3 entries (50, 0, missing)');

    // Test 3: minQuality = 100
    console.log('\n--- Test 3: minQuality = 100 ---');
    const res3 = await storage.getTrackingEntriesPaginated(1, 10, undefined, 'timestamp', 'desc', 'all', 100, undefined);
    console.log(`Got ${res3.entries.length} entries.`);
    if (res3.entries.length !== 1) console.error('FAIL: Expected 1 entry (100)');

    // Test 4: maxQuality = 99
    console.log('\n--- Test 4: maxQuality = 99 ---');
    const res4 = await storage.getTrackingEntriesPaginated(1, 10, undefined, 'timestamp', 'desc', 'all', undefined, 99);
    console.log(`Got ${res4.entries.length} entries.`);
    if (res4.entries.length !== 4) console.error('FAIL: Expected 4 entries (everything except 100)');

    console.log('\nDone.');

  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    // Cleanup
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

runTest();

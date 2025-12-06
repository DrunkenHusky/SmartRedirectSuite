
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { storage } from '../../server/storage';
import { InsertUrlTracking } from '../../shared/schema';

// Setup temporary data directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(process.cwd(), "data");

test('Stats Deletion Integration Test', async (t) => {
    // 1. Add some tracking data
    const trackingEntry: InsertUrlTracking = {
        path: "/test-path",
        userAgent: "TestAgent",
        ip: "127.0.0.1",
        referrer: "http://example.com",
        oldUrl: "http://old.com/test-path",
        timestamp: new Date().toISOString()
    };

    await storage.trackUrlAccess(trackingEntry);

    // Verify data exists
    let stats = await storage.getTrackingStats();
    assert.ok(stats.total > 0, "Stats should have entries before deletion");

    // 2. Clear all tracking data
    await storage.clearAllTracking();

    // 3. Verify data is gone
    stats = await storage.getTrackingStats();
    assert.strictEqual(stats.total, 0, "Stats total should be 0 after deletion");

    const allEntries = await storage.getAllTrackingEntries();
    assert.strictEqual(allEntries.length, 0, "All tracking entries should be empty array");

    console.log("Stats deletion test passed successfully");
});

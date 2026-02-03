import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { storage } from '../../server/storage.js';

const TRACKING_FILE = path.join(process.cwd(), 'data', 'tracking.json');

// Helper to clear tracking data safely
async function clearTracking() {
  await fs.writeFile(TRACKING_FILE, '[]');
  // Force reload/clear cache in storage (assuming internal method or public clear)
  // storage.clearAllTracking is available
  await storage.clearAllTracking();
}

test('Feedback Statistics Integration Test', async (t) => {
  // Setup
  await clearTracking();

  await t.test('Counts "auto-redirect" feedback correctly', async () => {
    // 1. Insert tracking entry with auto-redirect feedback
    await storage.trackUrlAccess({
      oldUrl: 'http://old.com/auto',
      newUrl: 'http://new.com/auto',
      path: '/auto',
      timestamp: new Date().toISOString(),
      userAgent: 'Bot/1.0',
      matchQuality: 100,
      feedback: 'auto-redirect'
    });

    // 2. Fetch stats
    const stats = await storage.getTrackingStats();

    // 3. Assert
    assert.strictEqual(stats.feedback.autoRedirect, 1, 'Should count 1 auto-redirect');
    assert.strictEqual(stats.feedback.ok, 0, 'Should have 0 OK');
    assert.strictEqual(stats.feedback.nok, 0, 'Should have 0 NOK');
  });

  await t.test('Counts mixed feedback types correctly', async () => {
    // Add OK
    await storage.trackUrlAccess({
      oldUrl: 'http://old.com/ok',
      newUrl: 'http://new.com/ok',
      path: '/ok',
      timestamp: new Date().toISOString(),
      feedback: 'OK'
    });

    // Add NOK
    await storage.trackUrlAccess({
      oldUrl: 'http://old.com/nok',
      newUrl: 'http://new.com/nok',
      path: '/nok',
      timestamp: new Date().toISOString(),
      feedback: 'NOK'
    });

    // Add Missing (no feedback)
    await storage.trackUrlAccess({
      oldUrl: 'http://old.com/none',
      newUrl: 'http://new.com/none',
      path: '/none',
      timestamp: new Date().toISOString(),
      feedback: null
    });

    const stats = await storage.getTrackingStats();

    // Previous 1 auto-redirect + new entries
    assert.strictEqual(stats.feedback.autoRedirect, 1, 'Auto-redirect count preserved');
    assert.strictEqual(stats.feedback.ok, 1, 'OK count correct');
    assert.strictEqual(stats.feedback.nok, 1, 'NOK count correct');
    assert.strictEqual(stats.feedback.missing, 1, 'Missing feedback count correct');
    assert.strictEqual(stats.total, 4, 'Total count correct');
  });

  await t.test('Updates existing tracking entry with feedback correctly', async () => {
    // 1. Create entry without feedback
    const entry = await storage.trackUrlAccess({
      oldUrl: 'http://old.com/update-test',
      newUrl: 'http://new.com/update-test',
      path: '/update-test',
      timestamp: new Date().toISOString(),
      feedback: null
    });

    const trackingId = entry.id;
    assert.ok(trackingId, 'Tracking ID created');

    // 2. Update feedback using storage method (simulate API call)
    const success = await storage.updateUrlTracking(trackingId, { feedback: 'OK' });
    assert.ok(success, 'Update should return true');

    // 3. Verify update
    const entries = await storage.getAllTrackingEntries();
    const updatedEntry = entries.find(e => e.id === trackingId);

    assert.ok(updatedEntry, 'Entry should exist');
    assert.strictEqual(updatedEntry?.feedback, 'OK', 'Feedback should be updated to OK');
  });

  // Cleanup
  await clearTracking();
});

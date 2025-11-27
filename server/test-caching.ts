
import { storage } from "./storage";
import { LocalFileUploadService } from "./localFileUpload";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { strict as assert } from "assert";
import { randomUUID } from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const RULES_FILE = path.join(DATA_DIR, "rules.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

// Backups
const RULES_BACKUP = path.join(DATA_DIR, "rules.json.test-backup");
const SETTINGS_BACKUP = path.join(DATA_DIR, "settings.json.test-backup");

async function runTests() {
  console.log("Starting Comprehensive Caching Tests...");

  // 1. Backup
  let rulesBackup = false;
  let settingsBackup = false;
  try {
    await fs.copyFile(RULES_FILE, RULES_BACKUP);
    rulesBackup = true;
  } catch {}
  try {
    await fs.copyFile(SETTINGS_FILE, SETTINGS_BACKUP);
    settingsBackup = true;
  } catch {}

  // Ensure upload dir
  if (!fsSync.existsSync(UPLOAD_DIR)) {
    fsSync.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  try {
    // === SETUP ===
    await storage.clearAllRules();

    // === TEST 1: RULE CACHING ===
    console.log("\n[Test 1] Rule Caching (Hit & Write)");
    const rule1 = await storage.createUrlRule({
      matcher: "/cache-test-1",
      targetUrl: "https://example.com/1",
      redirectType: "permanent",
      autoRedirect: false
    });

    // Check in-memory
    let rules = await storage.getUrlRules();
    assert.equal(rules.length, 1);

    // Modify disk manually (hack)
    await fs.writeFile(RULES_FILE, JSON.stringify([{ ...rule1, matcher: "/hacked" }]));

    // Check cache (should ignore hack)
    rules = await storage.getUrlRules();
    assert.equal(rules[0].matcher, "/cache-test-1", "FAIL: Rule read from disk instead of cache");

    // Write new rule (should update cache and fix disk)
    await storage.createUrlRule({
      matcher: "/cache-test-2",
      targetUrl: "https://example.com/2",
      redirectType: "permanent",
      autoRedirect: false
    });

    rules = await storage.getUrlRules();
    assert.equal(rules.length, 2, "FAIL: Cache not updated after write");
    const fileRules = JSON.parse(await fs.readFile(RULES_FILE, "utf-8"));
    assert.equal(fileRules.length, 2, "FAIL: Disk not updated after write");
    console.log("  -> PASS");

    // === TEST 2: PAGINATION SAFETY ===
    console.log("\n[Test 2] Pagination Safety");
    await storage.createUrlRule({
      matcher: "/a-first",
      targetUrl: "https://example.com/a",
      redirectType: "permanent",
      autoRedirect: false
    });
    // Cache order: /cache-test-1, /cache-test-2, /a-first
    // Sorted order: /a-first, /cache-test-1, ...

    await storage.getUrlRulesPaginated(1, 10, undefined, "matcher", "asc");
    rules = await storage.getUrlRules();
    assert.equal(rules[0].matcher, "/cache-test-1", "FAIL: Pagination sorted the cache in-place!");
    console.log("  -> PASS");

    // === TEST 3: IMPORT RULES ===
    console.log("\n[Test 3] Import Rules");
    const importData = [
      { matcher: "/import-1", targetUrl: "https://example.com/i1" }
    ];
    await storage.importUrlRules(importData as any);
    rules = await storage.getUrlRules();
    assert.ok(rules.find(r => r.matcher === "/import-1"), "FAIL: Import didn't update cache");
    console.log("  -> PASS");

    // === TEST 4: SETTINGS CACHING & IMPORT ===
    console.log("\n[Test 4] Settings Caching & Import");
    const initialSettings = await storage.getGeneralSettings();
    const originalTitle = initialSettings.mainTitle;

    // Hack disk
    await fs.writeFile(SETTINGS_FILE, JSON.stringify({ ...initialSettings, mainTitle: "HACKED" }));
    const cachedSettings = await storage.getGeneralSettings();
    assert.equal(cachedSettings.mainTitle, originalTitle, "FAIL: Settings read from disk instead of cache");

    // Simulate Import (Update)
    const newTitle = "IMPORTED TITLE " + randomUUID();
    const importSettings = { ...initialSettings, mainTitle: newTitle };
    delete (importSettings as any).id;
    delete (importSettings as any).updatedAt;

    await storage.updateGeneralSettings(importSettings as any);
    const updatedSettings = await storage.getGeneralSettings();
    assert.equal(updatedSettings.mainTitle, newTitle, "FAIL: Settings cache not updated after import");

    const diskSettings = JSON.parse(await fs.readFile(SETTINGS_FILE, "utf-8"));
    assert.equal(diskSettings.mainTitle, newTitle, "FAIL: Disk settings not updated");
    console.log("  -> PASS");

    // === TEST 5: FILE EXISTENCE ===
    console.log("\n[Test 5] File Existence Cache");
    const fileService = new LocalFileUploadService();
    const testFile = `test-file-${randomUUID()}.txt`;
    const testPath = path.join(UPLOAD_DIR, testFile);

    fsSync.writeFileSync(testPath, "content");
    fileService.registerFile(testFile);

    // Manual delete from disk
    fsSync.unlinkSync(testPath);
    assert.ok(fileService.fileExists(testFile), "FAIL: File existence should check cache");

    // Service delete
    fileService.deleteFile(testFile);
    assert.ok(!fileService.fileExists(testFile), "FAIL: Service delete should clear cache");
    console.log("  -> PASS");

    console.log("\nALL TESTS PASSED");

  } catch (error) {
    console.error("\nTEST FAILED:", error);
    process.exit(1);
  } finally {
    console.log("\n[Cleanup]");
    if (rulesBackup) {
      await fs.copyFile(RULES_BACKUP, RULES_FILE);
      await fs.unlink(RULES_BACKUP);
    }
    if (settingsBackup) {
      await fs.copyFile(SETTINGS_BACKUP, SETTINGS_FILE);
      await fs.unlink(SETTINGS_BACKUP);
    }
  }
}

runTests();

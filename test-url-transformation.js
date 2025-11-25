// Test script to verify URL transformation logic

import fs from "node:fs";
import assert from "node:assert/strict";
import { selectMostSpecificRule } from "./shared/ruleMatching.ts";
import { RULE_MATCHING_CONFIG } from "./shared/constants.ts";

// Load sample rules used for testing
const rulesPath = new URL("./data/rules.json", import.meta.url);
const rules = JSON.parse(fs.readFileSync(rulesPath, "utf-8"));

function findMatchingRule(path) {
  return selectMostSpecificRule(path, rules, RULE_MATCHING_CONFIG);
}

function generateUrl(path, rule, domain = "https://newurlofdifferentapp.com") {
  const base = domain.replace(/\/$/, "");
  if (!rule) {
    return base + path;
  }

  if (rule.mode === "COMPLETE") {
    return rule.targetUrl;
  }

  // Handle PARTIAL mode
  const cleanMatcher = rule.matcher.replace(/\/$/, "");
  const cleanTargetPath = rule.targetPath.replace(/^\/|\/$/g, "");
  const idx = path.toLowerCase().indexOf(cleanMatcher.toLowerCase());
  const before = idx !== -1 ? path.slice(0, idx) : "";
  const after = idx !== -1 ? path.slice(idx + cleanMatcher.length) : "";
  const newPath = `${before}/${cleanTargetPath}${after}`.replace(/\/+/g, "/");
  return base + newPath;
}

async function testScenario(name, path, expectedMode, expectedResult) {
  const rule = findMatchingRule(path);
  if (expectedMode === null) {
    assert.strictEqual(rule, null, `${name}: expected no rule`);
  } else {
    assert.ok(rule, `${name}: expected rule`);
    assert.strictEqual(
      rule.mode,
      expectedMode,
      `${name}: mode mismatch`,
    );
  }
  const newUrl = generateUrl(path, rule);
  assert.strictEqual(newUrl, expectedResult, `${name}: URL mismatch`);
}

async function run() {
  await testScenario(
    "Test 1: COMPLETE mode rule",
    "/sample-old-path-full",
    "COMPLETE",
    "https://newurlofdifferentapp.com/sample-new-path",
  );
  await testScenario(
    "Test 2: PARTIAL mode rule",
    "/sample-old-path/006002",
    "PARTIAL",
    "https://newurlofdifferentapp.com/sample-new-path/006002",
  );
  await testScenario(
    "Test 3: No matching rule",
    "/no-rule-matches-this",
    null,
    "https://newurlofdifferentapp.com/no-rule-matches-this",
  );
  await testScenario(
    "Test 4: COMPLETE mode rule ignores additional segments",
    "/sample-old-path-full/006965",
    "COMPLETE",
    "https://newurlofdifferentapp.com/sample-new-path",
  );
  await testScenario(
    "Test 5: PARTIAL mode rule match in sub-path",
    "/foo/sample-old-path/123",
    "PARTIAL",
    "https://newurlofdifferentapp.com/foo/sample-new-path/123",
  );
  await testScenario(
    "Test 6: COMPLETE mode rule match in sub-path",
    "/foo/sample-old-path-full/999",
    "COMPLETE",
    "https://newurlofdifferentapp.com/sample-new-path",
  );
  console.log("All tests passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

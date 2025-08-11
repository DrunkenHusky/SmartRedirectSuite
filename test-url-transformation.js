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
  if (rule.redirectType === "wildcard") {
    return rule.targetUrl;
  }
  const cleanMatcher = rule.matcher.replace(/\/$/, "");
  const cleanTarget = rule.targetUrl.replace(/^\/|\/$/g, "");
  const idx = path.toLowerCase().indexOf(cleanMatcher.toLowerCase());
  const before = idx !== -1 ? path.slice(0, idx) : "";
  const after = idx !== -1 ? path.slice(idx + cleanMatcher.length) : "";
  const newPath = `${before}/${cleanTarget}${after}`.replace(/\/+/g, "/");
  return base + newPath;
}

async function testScenario(name, path, expectedType, expectedResult) {
  const rule = findMatchingRule(path);
  if (expectedType === null) {
    assert.strictEqual(rule, null, `${name}: expected no rule`);
  } else {
    assert.ok(rule, `${name}: expected rule`);
    assert.strictEqual(
      rule.redirectType,
      expectedType,
      `${name}: type mismatch`,
    );
  }
  const newUrl = generateUrl(path, rule);
  assert.strictEqual(newUrl, expectedResult, `${name}: URL mismatch`);
}

async function run() {
  await testScenario(
    "Test 1: Wildcard rule (Vollständig)",
    "/sample-old-path-full",
    "wildcard",
    "https://newurlofdifferentapp.com/sample-new-path",
  );
  await testScenario(
    "Test 2: Partial rule (Teilweise)",
    "/sample-old-path/006002",
    "partial",
    "https://newurlofdifferentapp.com/sample-new-path/006002",
  );
  await testScenario(
    "Test 3: No matching rule",
    "/no-rule-matches-this",
    null,
    "https://newurlofdifferentapp.com/no-rule-matches-this",
  );
  await testScenario(
    "Test 4: Wildcard rule ignores additional segments",
    "/sample-old-path-full/006965",
    "wildcard",
    "https://newurlofdifferentapp.com/sample-new-path",
  );
  await testScenario(
    "Test 5: Partial rule match in sub-path",
    "/foo/sample-old-path/123",
    "partial",
    "https://newurlofdifferentapp.com/foo/sample-new-path/123",
  );
  await testScenario(
    "Test 6: Wildcard rule match in sub-path",
    "/foo/sample-old-path-full/999",
    "wildcard",
    "https://newurlofdifferentapp.com/sample-new-path",
  );
  console.log("All tests passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

import assert from "node:assert/strict";
import { findMatchingRule } from "../../shared/ruleMatching";
import { RULE_MATCHING_CONFIG } from "../../shared/constants";
import type { UrlRule } from "../../shared/schema";

function makeRule(id: string, matcher: string, createdOffset = 0): UrlRule {
  return {
    id,
    matcher,
    targetUrl: "",
    redirectType: "partial",
    infoText: "",
    autoRedirect: false,
    createdAt: new Date(2020, 0, 1 + createdOffset).toISOString(),
  };
}

async function runTests() {
  console.log("Running ruleMatching tests...");

  // Test 1: Exact Match
  {
    const rules = [makeRule("1", "/exact")];
    const match = findMatchingRule("/exact", rules, RULE_MATCHING_CONFIG);
    assert.ok(match, "Exact match not found");
    assert.equal(match.rule.id, "1");
    assert.equal(match.quality, 100);
    assert.equal(match.level, "green");
  }

  // Test 2: Partial Match (Prefix)
  {
    const rules = [makeRule("1", "/partial")];
    const match = findMatchingRule("/partial/suffix", rules, RULE_MATCHING_CONFIG);
    assert.ok(match, "Partial match not found");
    assert.equal(match.rule.id, "1");
    assert.equal(match.quality, 50);
  }

  // Test 3: Wildcard Match
  {
    const rules = [makeRule("1", "/wild/*")];
    const match = findMatchingRule("/wild/card", rules, RULE_MATCHING_CONFIG);
    assert.ok(match, "Wildcard match not found");
    assert.equal(match.rule.id, "1");
    assert.equal(match.quality, 100);
  }

  // Test 4: Query Params
  {
    const rules = [makeRule("1", "/query?q=1")];
    const match = findMatchingRule("/query?q=1", rules, RULE_MATCHING_CONFIG);
    assert.ok(match, "Query param match not found");
    assert.equal(match.rule.id, "1");
    assert.equal(match.quality, 100);
  }

  // Test 5: Extra Query Params
  {
    const rules = [makeRule("1", "/query")];
    const match = findMatchingRule("/query?extra=1", rules, RULE_MATCHING_CONFIG);
    assert.ok(match, "Match with extra query params not found");
    assert.equal(match.rule.id, "1");
    assert.equal(match.quality, 75);
  }

  // Test 6: Domain Match
  {
    const rules = [makeRule("1", "example.com")];
    const match = findMatchingRule("http://example.com/foo", rules, RULE_MATCHING_CONFIG);
    assert.ok(match, "Domain match not found");
    assert.equal(match.rule.id, "1");
    assert.equal(match.quality, 100);
  }

  // Test 7: Specificity (Longer path wins)
  {
    const rules = [makeRule("1", "/a/b"), makeRule("2", "/a/b/c")];
    const match = findMatchingRule("/a/b/c", rules, RULE_MATCHING_CONFIG);
    assert.ok(match, "Specificity match not found");
    assert.equal(match.rule.id, "2");
  }

  console.log("All ruleMatching tests passed!");
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

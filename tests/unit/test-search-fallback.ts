import { generateSearchUrl } from '../../client/src/lib/url-utils';
import { assert } from 'console';

function runTests() {
  console.log("Running Search Fallback Unit Tests...");

  const testCases = [
    {
      name: "Simple path",
      url: "http://example.com/products/shoes",
      base: "https://search.com?q=",
      expected: "https://search.com?q=shoes"
    },
    {
      name: "Path with trailing slash",
      url: "http://example.com/products/shoes/",
      base: "https://search.com?q=",
      expected: "https://search.com?q=shoes"
    },
    {
      name: "Path with query params",
      url: "http://example.com/products/shoes?size=42&color=red",
      base: "https://search.com?q=",
      expected: "https://search.com?q=shoes"
    },
    {
      name: "Deep path",
      url: "http://example.com/a/b/c/d/target",
      base: "https://search.com?q=",
      expected: "https://search.com?q=target"
    },
    {
      name: "Encoded characters",
      url: "http://example.com/search/caf%C3%A9",
      base: "https://search.com?q=",
      expected: "https://search.com?q=caf%C3%A9"
    },
    {
      name: "Root path (should return empty or handle gracefully)",
      url: "http://example.com/",
      base: "https://search.com?q=",
      expected: "https://search.com?q="
    },
    {
      name: "Search base with existing params",
      url: "http://example.com/item",
      base: "https://search.com/results?lang=en&q=",
      expected: "https://search.com/results?lang=en&q=item"
    }
  ];

  let passed = 0;
  let failed = 0;

  testCases.forEach((tc, index) => {
    try {
      const result = generateSearchUrl(tc.url, tc.base);
      if (result === tc.expected) {
        console.log(`✅ Test ${index + 1} Passed: ${tc.name}`);
        passed++;
      } else {
        console.error(`❌ Test ${index + 1} Failed: ${tc.name}`);
        console.error(`   Expected: ${tc.expected}`);
        console.error(`   Actual:   ${result}`);
        failed++;
      }
    } catch (e) {
      console.error(`❌ Test ${index + 1} Error: ${tc.name}`, e);
      failed++;
    }
  });

  console.log(`\nResults: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) process.exit(1);
}

runTests();

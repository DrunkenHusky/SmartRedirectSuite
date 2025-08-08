// Test script to verify URL transformation logic
const fetch = require('node-fetch');

async function testScenario(name, path, expectedType, expectedResult) {
  console.log(`\n--- ${name} ---`);
  
  try {
    // Check rule matching
    const ruleResponse = await fetch("http://localhost:5000/api/check-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    
    const ruleData = await ruleResponse.json();
    console.log(`Path: ${path}`);
    console.log(`Rule found: ${ruleData.hasMatch ? 'YES' : 'NO'}`);
    
    if (ruleData.rule) {
      console.log(`- Matcher: ${ruleData.rule.matcher}`);
      console.log(`- Target: ${ruleData.rule.targetUrl}`);
      console.log(`- Type: ${ruleData.rule.redirectType}`);
    }
    
    console.log(`Expected result: ${expectedResult}`);
    
  } catch (error) {
    console.log(`ERROR: ${error.message}`);
  }
}

// Manual verification instead of full automated test
console.log("URL Transformation Test Cases");
console.log("=============================");

testScenario(
  "Test 1: Wildcard rule (Vollständig)",
  "/sample-old-path-full",
  "wildcard",
  "https://newurlofdifferentapp.com/sample-new-path"
);

testScenario(
  "Test 2: Partial rule (Teilweise)", 
  "/sample-old-path-006002",
  "partial",
  "https://newurlofdifferentapp.com/sample-new-path-006002"
);

testScenario(
  "Test 3: No matching rule",
  "/no-rule-matches-this",
  null,
  "https://newurlofdifferentapp.com/no-rule-matches-this"
);

testScenario(
  "Test 4: Complex partial case",
  "/sample-old-path-full-006965",
  "wildcard", // Should match exact wildcard rule
  "https://newurlofdifferentapp.com/sample-new-path-006965"
);
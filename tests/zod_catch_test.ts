
import { z } from "zod";

const schema = z.object({
  ruleId: z.string().uuid().optional().catch(undefined)
});

const testCases = [
  { val: undefined, name: "undefined" },
  { val: "c0d48375-e41a-4512-ae92-929d4b8c9e73", name: "Valid UUID" },
  { val: "invalid-uuid", name: "Invalid UUID string" },
  { val: "", name: "Empty string" },
  { val: null, name: "Null" }
];

console.log("Testing Zod catch behavior...");

testCases.forEach(tc => {
  try {
    const result = schema.parse({ ruleId: tc.val });
    console.log(`[PASS] ${tc.name}:`, JSON.stringify(result));
  } catch (err) {
    console.log(`[FAIL] ${tc.name}:`, err.message);
  }
});

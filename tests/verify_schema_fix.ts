
import { insertUrlTrackingSchema } from "../shared/schema";
import { z } from "zod";

const testCases = [
  { val: undefined, name: "undefined" },
  { val: "c0d48375-e41a-4512-ae92-929d4b8c9e73", name: "Valid UUID" },
  { val: "invalid-uuid", name: "Invalid UUID string" },
  { val: "", name: "Empty string" },
  { val: null, name: "Null" }
];

console.log("Testing actual schema behavior...");

testCases.forEach(tc => {
  try {
    const payload = {
        oldUrl: "http://example.com",
        path: "/foo",
        timestamp: new Date().toISOString(),
        ruleId: tc.val
    };
    const result = insertUrlTrackingSchema.parse(payload);
    console.log(`[PASS] ${tc.name}: ruleId=${JSON.stringify(result.ruleId)}`);
  } catch (err) {
    if (err instanceof z.ZodError) {
        console.log(`[FAIL] ${tc.name}:`, JSON.stringify(err.errors));
    } else {
        console.log(`[FAIL] ${tc.name}:`, err);
    }
  }
});

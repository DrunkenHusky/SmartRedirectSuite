import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { storage } from "../../server/storage";
import { urlUtils } from "../../shared/utils";

console.log("Running referrer tracking integration test...");

// Test extractHostname again just to be sure in this context
// This also verifies that urlUtils is correctly loaded with the new function
const hostname = urlUtils.extractHostname("https://google.com/search");
console.log("Extracted hostname:", hostname);
assert.equal(hostname, "google.com");

async function runTest() {
  // 1. Clear tracking
  await storage.clearAllTracking();

  // 2. Track requests with referrers
  await storage.trackUrlAccess({
    oldUrl: "http://mysite.com/page1",
    path: "/page1",
    timestamp: new Date().toISOString(),
    userAgent: "TestBot",
    referrer: "https://google.com/search?q=test"
  });

  await storage.trackUrlAccess({
    oldUrl: "http://mysite.com/page2",
    path: "/page2",
    timestamp: new Date().toISOString(),
    userAgent: "TestBot",
    referrer: "https://google.com/images"
  });

  await storage.trackUrlAccess({
    oldUrl: "http://mysite.com/page3",
    path: "/page3",
    timestamp: new Date().toISOString(),
    userAgent: "TestBot",
    referrer: "https://facebook.com/feed"
  });

  await storage.trackUrlAccess({
    oldUrl: "http://mysite.com/page4",
    path: "/page4",
    timestamp: new Date().toISOString(),
    userAgent: "TestBot",
    referrer: null // Direct
  });

  // 3. Verify getTopReferrers
  const topReferrers = await storage.getTopReferrers(10, "all");
  console.log("Top Referrers:", topReferrers);

  assert.equal(topReferrers.length, 2);
  const google = topReferrers.find(r => r.domain === "google.com");
  const facebook = topReferrers.find(r => r.domain === "facebook.com");

  assert.ok(google, "google.com should be present");
  assert.equal(google?.count, 2, "google.com count should be 2");

  assert.ok(facebook, "facebook.com should be present");
  assert.equal(facebook?.count, 1, "facebook.com count should be 1");

  // 4. Verify searchTrackingEntries
  const searchResults = await storage.searchTrackingEntries("google.com");
  console.log("Search Results for 'google.com':", searchResults.length);
  assert.equal(searchResults.length, 2, "Should find 2 entries with google.com referrer");

  // 5. Verify CSV Export format (simulated logic check)
  const trackingData = await storage.getTrackingData("all");
  const track = trackingData.find(t => t.referrer && t.referrer.includes("google"));
  if (track) {
      const csvRow = `"${track.id}","${track.oldUrl}","${(track as any).newUrl || ''}","${track.path}","${track.referrer || ''}","${track.timestamp}","${track.userAgent || ''}"`;
      console.log("CSV Row sample:", csvRow);
      assert.ok(csvRow.includes("google.com"), "CSV row should contain referrer");
  } else {
      assert.fail("Could not find google track for CSV check");
  }

  console.log("Referrer tracking integration test PASSED");
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});

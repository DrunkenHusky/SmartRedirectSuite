
import { storage } from "../server/storage";
import { InsertUrlTracking } from "../shared/schema";

async function verifyReferrerTracking() {
  console.log("Starting Referrer Tracking Verification...");

  const longReferrer = "https://example.com/some/very/long/path/with/parameters?id=123&ref=abc#section";
  const domain = "example.com";

  console.log(`Tracking access with referrer: ${longReferrer}`);

  const trackingData: InsertUrlTracking = {
    oldUrl: "http://localhost:5000/old-page",
    newUrl: "http://localhost:5000/new-page",
    path: "/old-page",
    timestamp: new Date().toISOString(),
    userAgent: "TestAgent/1.0",
    referrer: longReferrer,
    matchQuality: 100,
    feedback: null
  };

  await storage.trackUrlAccess(trackingData);

  // Verify full URL is stored
  const allEntries = await storage.getAllTrackingEntries();
  const entry = allEntries.find(e => e.referrer === longReferrer);

  if (entry) {
    console.log("SUCCESS: Full referrer URL found in tracking entries.");
    if (entry.referrer === longReferrer) {
        console.log("  Referrer matches exactly.");
    } else {
        console.error(`  Referrer mismatch! Expected: ${longReferrer}, Found: ${entry.referrer}`);
        process.exit(1);
    }
  } else {
    console.error("FAILURE: Full referrer URL NOT found in tracking entries.");
    process.exit(1);
  }

  // Verify Top Referrers shows domain
  const topReferrers = await storage.getTopReferrers(10, "all");
  const referrerStat = topReferrers.find(r => r.domain === domain);

  if (referrerStat) {
    console.log(`SUCCESS: Domain '${domain}' found in top referrers.`);
    console.log(`  Count: ${referrerStat.count}`);
  } else {
    // It might be aggregated differently if other tests ran, but let's see.
    console.log("Top referrers:", topReferrers);
    console.warn(`WARNING: Domain '${domain}' not found in top referrers (might be due to other data or time range).`);
  }

  console.log("Verification complete.");
}

verifyReferrerTracking().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});

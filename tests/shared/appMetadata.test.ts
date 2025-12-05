import assert from "node:assert/strict";
import applicationPackage from "../../package.json" assert { type: "json" };
import { APPLICATION_METADATA } from "../../shared/appMetadata";

(() => {
  assert.equal(
    APPLICATION_METADATA.name,
    applicationPackage.name,
    "Application name should follow package.json",
  );
  assert.equal(
    APPLICATION_METADATA.version,
    applicationPackage.version,
    "Application version should follow package.json",
  );
  assert.ok(
    APPLICATION_METADATA.displayName.trim().length > 0,
    "Display name should always be present",
  );
  assert.ok(
    APPLICATION_METADATA.displayName.includes(" "),
    "Display name should be human-friendly with spaces",
  );
  console.log("appMetadata tests passed");
})();

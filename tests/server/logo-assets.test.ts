import assert from "node:assert/strict";
import path from "node:path";
import {
  buildDatabaseLogoUrl,
  detectImageMimeType,
  extractDatabaseLogoId,
  extractLocalUploadFilename,
  resolveLocalUploadFilePath,
} from "../../server/logoAssets";

function runLogoAssetHelperTests() {
  console.log("Running logo asset helper tests...");

  const logoId = "55555555-5555-4555-8555-555555555555";
  assert.equal(buildDatabaseLogoUrl(logoId), `/api/logo/${logoId}`);
  assert.equal(extractDatabaseLogoId(`/api/logo/${logoId}`), logoId);
  assert.equal(extractDatabaseLogoId("/uploads/logo.png"), null);

  assert.equal(extractLocalUploadFilename("/uploads/logo%20with%20spaces.svg"), "logo with spaces.svg");
  assert.equal(extractLocalUploadFilename("/uploads/../secret.svg"), null);
  assert.equal(extractLocalUploadFilename("/api/logo/not-local"), null);

  const uploadPath = path.join(process.cwd(), "data", "uploads");
  assert.equal(resolveLocalUploadFilePath("logo.png", uploadPath), path.join(uploadPath, "logo.png"));
  assert.equal(resolveLocalUploadFilePath("../logo.png", uploadPath), null);
  assert.equal(resolveLocalUploadFilePath("nested/logo.png", uploadPath), null);

  assert.equal(detectImageMimeType("brand.SVG"), "image/svg+xml");
  assert.equal(detectImageMimeType("brand.unknown"), "application/octet-stream");

  console.log("logo asset helper tests passed");
}

runLogoAssetHelperTests();

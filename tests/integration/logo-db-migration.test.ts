import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "srs-logo-db-migration-"));
process.chdir(tempDirectory);
process.env.DB_DIALECT = "sqlite";
process.env.DB_STORAGE = path.join(tempDirectory, "data", "logo.sqlite");
process.env.LOCAL_UPLOAD_PATH = path.join(tempDirectory, "data", "uploads");

const dataDirectory = path.join(tempDirectory, "data");
const uploadDirectory = path.join(dataDirectory, "uploads");
const legacyLogoFilename = "legacy-logo.svg";
const legacyLogoContent = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>');

await fs.mkdir(uploadDirectory, { recursive: true });
await fs.writeFile(path.join(uploadDirectory, legacyLogoFilename), legacyLogoContent);
await fs.writeFile(
  path.join(dataDirectory, "settings.json"),
  JSON.stringify({
    id: "44444444-4444-4444-8444-444444444444",
    headerTitle: "Migrated Logo Settings",
    headerLogoUrl: `/uploads/${legacyLogoFilename}`,
  }),
);

const dbModule = await import("../../server/db");
const { storage } = await import("../../server/storage");

async function runLogoDatabaseMigrationTests() {
  console.log("Running logo database migration tests...");

  const settings = await storage.getGeneralSettings();
  assert.match(
    settings.headerLogoUrl ?? "",
    /^\/api\/logo\/[0-9a-f-]{36}$/i,
    "Legacy local upload logos must be migrated to a database-backed logo URL",
  );
  assert.equal(settings.headerTitle, "Migrated Logo Settings");

  const logoId = settings.headerLogoUrl!.replace("/api/logo/", "");
  const logoAsset = await dbModule.LogoAssetModel.findByPk(logoId);
  assert.ok(logoAsset, "Migrated logo asset must exist in the database");
  assert.equal(logoAsset!.getDataValue("filename"), legacyLogoFilename);
  assert.equal(logoAsset!.getDataValue("mimeType"), "image/svg+xml");
  assert.deepEqual(Buffer.from(logoAsset!.getDataValue("data") as Buffer), legacyLogoContent);

  const entry = await dbModule.GeneralSettingEntryModel.findByPk("headerLogoUrl");
  assert.equal(entry?.get("value"), settings.headerLogoUrl, "General settings must point to the migrated database logo URL");

  console.log("logo database migration tests passed");
}

await runLogoDatabaseMigrationTests();

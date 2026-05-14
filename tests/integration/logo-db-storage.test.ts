import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";

const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "srs-logo-db-"));
process.chdir(tempDirectory);
process.env.DB_DIALECT = "sqlite";
process.env.DB_STORAGE = path.join(tempDirectory, "data", "logo.sqlite");
process.env.LOCAL_UPLOAD_PATH = path.join(tempDirectory, "data", "uploads");

const dataDirectory = path.join(tempDirectory, "data");
const uploadDirectory = path.join(dataDirectory, "uploads");
const legacyLogoFilename = "legacy-logo.svg";
const legacyLogoContent = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><text>Logo</text></svg>');

await fs.mkdir(uploadDirectory, { recursive: true });
await fs.writeFile(path.join(uploadDirectory, legacyLogoFilename), legacyLogoContent);
await fs.writeFile(
  path.join(dataDirectory, "settings.json"),
  JSON.stringify({
    id: "11111111-1111-4111-8111-111111111111",
    headerTitle: "Legacy Settings",
    headerLogoUrl: `/uploads/${legacyLogoFilename}`,
    updatedAt: "2024-01-01T00:00:00.000Z",
  }),
);

const dbModule = await import("../../server/db");
const { storage } = await import("../../server/storage");
const { registerRoutes } = await import("../../server/routes");

async function runLogoDatabaseStorageTests() {
  console.log("Running logo database storage tests...");

  const migratedSettings = await storage.getGeneralSettings();
  assert.match(
    migratedSettings.headerLogoUrl ?? "",
    /^\/api\/logo\/[0-9a-f-]+$/,
    "Startup migration must rewrite legacy /uploads logo URLs to DB-backed /api/logo URLs",
  );

  await fs.access(path.join(dataDirectory, "settings.json.bak"));
  assert.deepEqual(
    await fs.readFile(path.join(uploadDirectory, legacyLogoFilename)),
    legacyLogoContent,
    "Startup migration must preserve the legacy logo file while DB-backed URLs roll out",
  );

  const logoId = migratedSettings.headerLogoUrl!.replace("/api/logo/", "");
  const migratedLogo = await storage.getLogoAsset(logoId);
  assert.ok(migratedLogo, "Migrated legacy logo must be available as a database asset");
  assert.equal(migratedLogo.filename, legacyLogoFilename);
  assert.equal(migratedLogo.contentType, "image/svg+xml");
  assert.deepEqual(migratedLogo.data, legacyLogoContent);

  const createdLogo = await storage.createLogoAsset({
    filename: "uploaded.png",
    contentType: "image/png",
    data: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  });
  const updatedSettings = await storage.updateGeneralSettings({
    headerLogoUrl: `/api/logo/${createdLogo.id}`,
  } as any);
  assert.equal(updatedSettings.headerLogoUrl, `/api/logo/${createdLogo.id}`);

  const app = express();
  app.use(express.json());
  const server = await registerRoutes(app);

  const response = await request(server).get(`/api/logo/${createdLogo.id}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers["content-type"], "image/png");
  assert.deepEqual(response.body, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  const deleteResult = await storage.deleteLogoAsset(createdLogo.id);
  assert.equal(deleteResult, true);
  assert.equal(await storage.getLogoAsset(createdLogo.id), undefined);

  server.close();
  await dbModule.sequelize.close();
  console.log("logo database storage tests passed");
}

runLogoDatabaseStorageTests().catch(async (error) => {
  console.error(error);
  await dbModule.sequelize.close().catch(() => undefined);
  process.exit(1);
});

import assert from "node:assert/strict";
import path from "node:path";
import { APPLICATION_METADATA } from "./shared/appMetadata";
import { resolvePackageJsonPath } from "./vite.config";

async function importFreshConfig() {
  return import(`./vite.config.ts?cache-bust=${Date.now()}`);
}

(async () => {
  const configModule = await importFreshConfig();
  const config = configModule.default;
  assert.equal(
    config.define?.__APP_VERSION__,
    JSON.stringify(APPLICATION_METADATA.version),
    "Vite config should expose app version from package.json",
  );
  assert.equal(
    config.define?.__APP_NAME__,
    JSON.stringify(APPLICATION_METADATA.displayName),
    "Vite config should expose app name from application metadata",
  );

  const distDirectory = path.resolve(import.meta.dirname, "dist");
  const resolvedPathFromDist = resolvePackageJsonPath(distDirectory);
  assert.equal(
    resolvedPathFromDist,
    path.resolve(import.meta.dirname, "package.json"),
    "Resolver should fall back to project root when build output lacks package.json",
  );

  console.log("test-vite-config passed");
})();

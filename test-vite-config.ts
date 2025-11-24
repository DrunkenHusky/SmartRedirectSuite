import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { resolvePackageJsonPath } from "./vite.config";

const projectPackageJson = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, "package.json"), "utf-8"),
);

async function importFreshConfig() {
  return import(`./vite.config.ts?cache-bust=${Date.now()}`);
}

(async () => {
  const configModule = await importFreshConfig();
  const config = configModule.default;
  assert.equal(
    config.define?.__APP_VERSION__,
    JSON.stringify(projectPackageJson.version),
    "Vite config should expose app version from package.json",
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

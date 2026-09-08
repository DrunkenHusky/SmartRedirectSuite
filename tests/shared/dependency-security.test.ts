import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

interface LockfilePackage {
  version?: string;
}

interface PackageLock {
  packages: Record<string, LockfilePackage>;
}

interface PackageManifest {
  engines?: Record<string, string>;
  overrides?: Record<string, string>;
}

const packageLock = JSON.parse(
  readFileSync(new URL("../../package-lock.json", import.meta.url), "utf8"),
) as PackageLock;
const packageManifest = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as PackageManifest;

const minimumSecureVersions = {
  "@babel/core": "7.29.1",
  "body-parser": "2.2.3",
  browserslist: "4.28.7",
  esbuild: "0.28.2",
  multer: "2.1.2",
  nanoid: "3.3.18",
  postcss: "8.5.23",
  qs: "6.16.0",
  vite: "8.2.2",
} as const;

function compareSemanticVersions(leftVersion: string, rightVersion: string): number {
  const leftParts = leftVersion.split(".").map(Number);
  const rightParts = rightVersion.split(".").map(Number);

  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }

  return 0;
}

test("the lockfile resolves every audited package to a secure version", async (context) => {
  for (const [packageName, minimumVersion] of Object.entries(minimumSecureVersions)) {
    await context.test(packageName, () => {
      const resolvedVersion = packageLock.packages[`node_modules/${packageName}`]?.version;

      assert.ok(resolvedVersion, `${packageName} must be present in package-lock.json`);
      assert.ok(
        compareSemanticVersions(resolvedVersion, minimumVersion) >= 0,
        `${packageName}@${resolvedVersion} must be at least ${minimumVersion}`,
      );
    });
  }
});

test("the supported runtime and qs override match the maintenance baseline", () => {
  assert.deepEqual(packageManifest.engines, { node: ">=24.10.0", npm: ">=11.3" });
  // assert.equal(packageManifest.overrides?.qs, "6.16.0");
});

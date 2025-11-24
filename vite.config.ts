import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

const viteConfigDirectory = import.meta.dirname;

export function resolvePackageJsonPath(baseDirectory = viteConfigDirectory) {
  const candidatePaths = [
    path.resolve(baseDirectory, "package.json"),
    path.resolve(baseDirectory, "..", "package.json"),
  ];

  const existingPath = candidatePaths.find((candidatePath) =>
    fs.existsSync(candidatePath),
  );

  if (!existingPath) {
    throw new Error(
      "package.json not found in build or project root; ensure dependencies are installed",
    );
  }

  return existingPath;
}

const packageJsonPath = resolvePackageJsonPath();
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

export default defineConfig({
  define: {
    '__APP_VERSION__': JSON.stringify(packageJson.version)
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      allow: [path.resolve(import.meta.dirname)],
      // Vite's default deny list blocks any path segment starting with a dot which
      // breaks when the repository itself lives inside a dot-prefixed directory
      // (e.g. a bare repo clone under `.git`). We keep strict mode and replace the
      // broad deny list with a targeted block list for sensitive environment files
      // while still permitting dot-path ancestors of the project root.
      deny: ["**/.env", "**/.env.*"],
    },
  },
});

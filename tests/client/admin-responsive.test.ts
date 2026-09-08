import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");

const adminPage = readSource("client/src/pages/admin.tsx");
const dialog = readSource("client/src/components/ui/dialog.tsx");
const alertDialog = readSource("client/src/components/ui/alert-dialog.tsx");
const globalRules = readSource("client/src/components/admin/GlobalRulesSettings.tsx");

assert.match(adminPage, /className="admin-shell min-h-screen/);
assert.match(adminPage, /grid-cols-3[^"]*sm:grid-cols-5/);
assert.match(adminPage, /admin-rule-actions grid grid-cols-1/);
assert.match(adminPage, /admin-dialog-actions sticky bottom-0/);

for (const modalSource of [dialog, alertDialog]) {
  assert.match(modalSource, /w-\[calc\(100%-1rem\)\]/);
  assert.match(modalSource, /max-h-\[calc\(100dvh-1rem\)\]/);
  assert.match(modalSource, /\[&_button\]:min-h-11/);
}

assert.match(globalRules, /admin-editor-row flex flex-col/);
assert.match(globalRules, /w-full sm:w-auto/);

console.log("Admin responsive layout contract tests passed");

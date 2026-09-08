import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");

const adminPage = readSource("client/src/pages/admin.tsx");
const dialog = readSource("client/src/components/ui/dialog.tsx");
const alertDialog = readSource("client/src/components/ui/alert-dialog.tsx");
const globalRules = readSource("client/src/components/admin/GlobalRulesSettings.tsx");
const adminStyles = readSource("client/src/index.css");

assert.match(adminPage, /className="admin-shell min-h-screen/);
assert.match(adminPage, /grid-cols-3[^"]*sm:grid-cols-5/);
assert.match(adminPage, /admin-rule-actions grid grid-cols-1/);
assert.match(adminPage, /admin-dialog-actions sticky bottom-0/);
assert.match(adminPage, /className="admin-rule-form/);
assert.equal(
  adminPage.match(/admin-rule-editor-row flex flex-col sm:flex-row/g)?.length,
  3,
  "all three repeatable rule editor rows must stack on smartphones",
);

for (const modalSource of [dialog, alertDialog]) {
  assert.match(modalSource, /w-\[calc\(100%-1rem\)\]/);
  assert.match(modalSource, /max-h-\[calc\(100dvh-1rem\)\]/);
  assert.match(modalSource, /\[&_button\]:min-h-11/);
}

assert.match(globalRules, /admin-editor-row flex flex-col/);
assert.match(globalRules, /w-full sm:w-auto/);
assert.match(adminStyles, /\.admin-shell\s*\{[^}]*overflow-x:\s*clip/s);
assert.match(adminStyles, /\.admin-rule-form (?:input|textarea),/);
assert.match(adminStyles, /min-height:\s*44px/);
assert.match(adminStyles, /\.admin-editor-row > \*/);

console.log("Admin responsive layout contract tests passed");

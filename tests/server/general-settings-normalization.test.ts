import assert from "node:assert/strict";
import { normalizeGeneralSettings } from "../../shared/generalSettings";

function runGeneralSettingsNormalizationTests() {
  console.log("Running general settings normalization tests...");

  const normalizedSettings = normalizeGeneralSettings({
    footerCopyright: "© 2026 Migrated Footer",
    mainTitle: "Migrierter Titel",
    defaultNewDomain: "not-a-valid-url",
  } as any, "11111111-1111-4111-8111-111111111111");

  assert.equal(
    normalizedSettings.footerCopyright,
    "© 2026 Migrated Footer",
    "Valid settings.json fields must survive even when another legacy field is invalid",
  );
  assert.equal(normalizedSettings.mainTitle, "Migrierter Titel");
  assert.equal(normalizedSettings.defaultNewDomain, "https://thisisthenewurl.com/");

  const smartSearchSettings = normalizeGeneralSettings({
    footerCopyright: "© 2026 Smart Search Footer",
    defaultRedirectMode: "search",
    defaultSearchUrl: null,
  } as any, "22222222-2222-4222-8222-222222222222");

  assert.equal(smartSearchSettings.footerCopyright, "© 2026 Smart Search Footer");
  assert.equal(
    smartSearchSettings.defaultRedirectMode,
    "domain",
    "Invalid cross-field smart-search settings must fall back without dropping unrelated migrated values",
  );

  const corruptedEntrySettings = normalizeGeneralSettings({
    id: "not-a-uuid",
    footerCopyright: "© 2026 Existing Footer",
    headerIcon: "BrokenIcon",
    headerLogoUrl: "relative-logo.png",
    enableCopyButton: "true",
    infoItems: "[]",
    globalSearchAndReplace: "[]",
    updatedAt: "not-a-date",
  } as any, "not-a-uuid");

  assert.match(corruptedEntrySettings.id, /^[0-9a-f-]{36}$/i);
  assert.equal(corruptedEntrySettings.footerCopyright, "© 2026 Existing Footer");
  assert.equal(corruptedEntrySettings.headerIcon, "ArrowRightLeft");
  assert.equal(corruptedEntrySettings.enableCopyButton, true);
  assert.deepEqual(corruptedEntrySettings.infoItems, []);

  const rawEntrySettings = normalizeGeneralSettings({
    id: '"33333333-3333-4333-8333-333333333333"' as any,
    footerCopyright: '"© 2026 Raw DB Footer"' as any,
    enableCopyButton: 'true' as any,
    maxStatsEntries: '25' as any,
    infoItems: '["First","Second"]' as any,
  } as any, "33333333-3333-4333-8333-333333333333");

  assert.equal(rawEntrySettings.id, "33333333-3333-4333-8333-333333333333");
  assert.equal(rawEntrySettings.footerCopyright, "© 2026 Raw DB Footer");
  assert.equal(rawEntrySettings.enableCopyButton, true);
  assert.equal(rawEntrySettings.maxStatsEntries, 0);
  assert.deepEqual(rawEntrySettings.infoItems, ["First", "Second"]);

  console.log("general settings normalization tests passed");
}

runGeneralSettingsNormalizationTests();

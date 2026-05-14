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

  console.log("general settings normalization tests passed");
}

runGeneralSettingsNormalizationTests();

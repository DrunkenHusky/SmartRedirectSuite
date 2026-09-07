import assert from "node:assert/strict";
import { loadConfiguration } from "../server/config";

const validEnvironment = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://app:secret@database:5432/app",
  SESSION_SECRET: "a-secure-session-secret-with-32-characters",
  ADMIN_PASSWORD: "a-secure-password",
};

const configuration = loadConfiguration(validEnvironment);
assert.equal(configuration.PORT, 5000);
assert.equal(configuration.oauthEnabled, false);
assert.throws(() => loadConfiguration({ ...validEnvironment, DATABASE_URL: "sqlite:test.db" }), /DATABASE_URL/);
assert.throws(() => loadConfiguration({ ...validEnvironment, ADMIN_PASSWORD: undefined }), /ADMIN_PASSWORD/);
assert.throws(() => loadConfiguration({ ...validEnvironment, OAUTH_ISSUER_URL: "https://id.example.com" }), /OAuth configuration/);
const oauthConfiguration = loadConfiguration({ ...validEnvironment, ADMIN_PASSWORD: undefined,
  OAUTH_ISSUER_URL: "https://id.example.com", OAUTH_CLIENT_ID: "client", OAUTH_CLIENT_SECRET: "secret",
  OAUTH_REDIRECT_URI: "https://app.example.com/api/admin/oauth/callback" });
assert.equal(oauthConfiguration.oauthEnabled, true);

console.log("configuration tests passed");

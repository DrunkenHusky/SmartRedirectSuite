import assert from "node:assert/strict";

process.env.DB_DIALECT = "sqlite";
const { normalizeDatabaseDialect, loadDatabaseConfig, sequelize } = await import("../../server/db");

console.log("Running database configuration tests...");

assert.equal(normalizeDatabaseDialect("postgresql"), "postgres");
assert.equal(normalizeDatabaseDialect("mariadb"), "mariadb");
assert.throws(
  () => normalizeDatabaseDialect("oracle"),
  /Unsupported DB_DIALECT/,
  "Unsupported dialects must fail during configuration validation",
);

const postgresConfig = loadDatabaseConfig({
  DB_DIALECT: "postgresql",
  DB_NAME: "smartredirect",
  DB_USER: "redirectuser",
  DB_PASSWORD: "redirectpass",
  DB_HOST: "db",
  DB_SSL: "true",
});

assert.equal(postgresConfig.dialect, "postgres");
assert.equal(postgresConfig.port, 5432);
assert.equal(postgresConfig.ssl, true);

const mariadbConfig = loadDatabaseConfig({
  DB_DIALECT: "mariadb",
  DB_NAME: "smartredirect",
  DB_USER: "redirectuser",
  DB_PASSWORD: "redirectpass",
  DB_HOST: "db",
});

assert.equal(mariadbConfig.dialect, "mariadb");
assert.equal(mariadbConfig.port, 3306);

await sequelize.close();
console.log("database configuration tests passed");

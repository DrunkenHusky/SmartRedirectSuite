import assert from "node:assert/strict";
import Module from "node:module";

const loadModule = Module as unknown as { _load: (...parameters: unknown[]) => unknown };
const originalLoad = loadModule._load;
const openedDatabases: FakeBetterSqliteDatabase[] = [];

class FakeBetterSqliteStatement {
  constructor(private readonly database: FakeBetterSqliteDatabase, private readonly sql: string) {}

  run(...parameters: unknown[]) {
    this.database.operations.push({ method: "run", sql: this.sql, parameters });
    return { lastInsertRowid: 42, changes: 3 };
  }

  get(...parameters: unknown[]) {
    this.database.operations.push({ method: "get", sql: this.sql, parameters });
    return { id: 1, name: "single-row" };
  }

  all(...parameters: unknown[]) {
    this.database.operations.push({ method: "all", sql: this.sql, parameters });
    return [{ id: 1 }, { id: 2 }];
  }
}

class FakeBetterSqliteDatabase {
  open = true;
  readonly operations: Array<{ method: string; sql: string; parameters: unknown[] }> = [];
  readonly pragmas: string[] = [];

  constructor(readonly filename: string, readonly options: { readonly?: boolean; fileMustExist?: boolean } = {}) {
    openedDatabases.push(this);
  }

  prepare(sql: string) {
    return new FakeBetterSqliteStatement(this, sql);
  }

  exec(sql: string) {
    this.operations.push({ method: "exec", sql, parameters: [] });
  }

  pragma(sql: string) {
    this.pragmas.push(sql);
  }

  close() {
    this.open = false;
  }
}

loadModule._load = (request: unknown, ...parameters: unknown[]) => {
  if (request === "better-sqlite3") {
    return FakeBetterSqliteDatabase;
  }
  return originalLoad.call(Module, request, ...parameters);
};

async function waitForMicrotasks(): Promise<void> {
  await new Promise<void>(resolve => queueMicrotask(resolve));
}

async function runBetterSqlite3DialectTests() {
  try {
    const { BetterSqlite3SequelizeDialect } = await import("../../server/betterSqlite3Dialect");

    let openCallbackCalled = false;
    const database = new BetterSqlite3SequelizeDialect.Database(
      "/tmp/smartredirect.sqlite",
      BetterSqlite3SequelizeDialect.OPEN_READWRITE | BetterSqlite3SequelizeDialect.OPEN_CREATE,
      error => {
        assert.equal(error, null);
        openCallbackCalled = true;
      },
    );
    await waitForMicrotasks();

    assert.equal(openCallbackCalled, true, "constructor must preserve sqlite3-style async open callbacks");
    assert.equal(openedDatabases[0].filename, "/tmp/smartredirect.sqlite");
    assert.deepEqual(openedDatabases[0].options, { readonly: false, fileMustExist: false });
    assert.deepEqual(openedDatabases[0].pragmas, ["busy_timeout = 5000"]);

    await new Promise<void>((resolve, reject) => {
      database.run("INSERT INTO redirects(target) VALUES (?)", ["https://example.com"], function (error) {
        try {
          assert.equal(error, null);
          assert.equal(this.lastID, 42);
          assert.equal(this.changes, 3);
          resolve();
        } catch (assertionError) {
          reject(assertionError);
        }
      });
    });

    const selectedRows = await new Promise<unknown>((resolve, reject) => {
      database.all("SELECT * FROM redirects WHERE target = ?", ["https://example.com"], (error, rows) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(rows);
      });
    });

    assert.deepEqual(selectedRows, [{ id: 1 }, { id: 2 }]);
    assert.deepEqual(openedDatabases[0].operations.slice(0, 2), [
      { method: "run", sql: "INSERT INTO redirects(target) VALUES (?)", parameters: ["https://example.com"] },
      { method: "all", sql: "SELECT * FROM redirects WHERE target = ?", parameters: ["https://example.com"] },
    ]);

    let serializeCalled = false;
    database.serialize(() => {
      serializeCalled = true;
    });
    assert.equal(serializeCalled, true, "serialize must keep Sequelize sqlite query scheduling compatible");

    await new Promise<void>((resolve, reject) => {
      database.close(error => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    assert.equal(openedDatabases[0].open, false);

    console.log("better-sqlite3 dialect tests passed");
  } finally {
    loadModule._load = originalLoad;
  }
}

runBetterSqlite3DialectTests().catch(error => {
  console.error(error);
  loadModule._load = originalLoad;
  process.exit(1);
});

import { createRequire } from 'module';

interface BetterSqliteStatement {
  readonly reader?: boolean;
  all(...parameters: unknown[]): unknown[];
  get(...parameters: unknown[]): unknown;
  run(...parameters: unknown[]): { lastInsertRowid?: number | bigint; changes?: number };
}

interface BetterSqliteDatabase {
  readonly name?: string;
  open: boolean;
  prepare(sql: string): BetterSqliteStatement;
  exec(sql: string): void;
  close(): void;
  pragma(sql: string): unknown;
}

interface BetterSqliteConstructor {
  new (filename: string, options?: { readonly?: boolean; fileMustExist?: boolean }): BetterSqliteDatabase;
}

type SqliteCallback = (error: Error | null, rows?: unknown) => void;

type SqliteRunCallback = (this: { lastID: number | bigint | undefined; changes: number }, error: Error | null) => void;

const require = createRequire(import.meta.url);

function loadBetterSqliteDatabase(): BetterSqliteConstructor {
  return require('better-sqlite3') as BetterSqliteConstructor;
}

function deferCallback(callback: () => void): void {
  queueMicrotask(callback);
}

function normalizeParameters(parameters: unknown): unknown[] {
  if (parameters === undefined || parameters === null) {
    return [];
  }

  return Array.isArray(parameters) ? parameters : [parameters];
}

function extractCallback<T extends (...args: unknown[]) => void>(parameters: unknown[], callback: T | undefined): T | undefined {
  const lastParameter = parameters[parameters.length - 1];
  if (typeof lastParameter === 'function') {
    return parameters.pop() as T;
  }
  return callback;
}

function invokeCallback(callback: SqliteCallback | undefined, error: Error | null, rows?: unknown): void {
  if (!callback) {
    return;
  }

  deferCallback(() => callback(error, rows));
}

function isNonReturningStatementError(error: unknown): boolean {
  return error instanceof TypeError && error.message.includes('This statement does not return data');
}

function runNonReturningStatement(statement: BetterSqliteStatement, parameters: unknown[]): void {
  statement.run(...parameters);
}

export class BetterSqlite3SequelizeDatabase {
  readonly filename: string;
  readonly uuid?: string;
  private readonly database!: BetterSqliteDatabase;

  constructor(filename: string, mode?: number, callback?: SqliteCallback) {
    this.filename = filename;

    try {
      const BetterSqliteDatabase = loadBetterSqliteDatabase();
      this.database = new BetterSqliteDatabase(filename, {
        readonly: mode === BetterSqlite3SequelizeDialect.OPEN_READONLY,
        fileMustExist: Boolean(mode && (mode & BetterSqlite3SequelizeDialect.OPEN_CREATE) === 0),
      });
      this.database.pragma('busy_timeout = 5000');
      invokeCallback(callback, null);
    } catch (error) {
      invokeCallback(callback, error as Error);
      throw error;
    }
  }

  serialize(callback: () => void): void {
    callback();
  }

  run(sql: string, ...parameters: unknown[]): this {
    const callback = extractCallback<SqliteRunCallback>(parameters, undefined);

    try {
      const normalizedParameters = normalizeParameters(parameters[0]);
      const result = this.database.prepare(sql).run(...normalizedParameters);
      const sqliteStatementContext = { lastID: result.lastInsertRowid, changes: result.changes ?? 0 };
      if (callback) {
        deferCallback(() => callback.call(sqliteStatementContext, null));
      }
    } catch (error) {
      if (callback) {
        const sqliteStatementContext = { lastID: undefined, changes: 0 };
        deferCallback(() => callback.call(sqliteStatementContext, error as Error));
      } else {
        throw error;
      }
    }

    return this;
  }

  get(sql: string, ...parameters: unknown[]): this {
    const callback = extractCallback<SqliteCallback>(parameters, undefined);

    try {
      const normalizedParameters = normalizeParameters(parameters[0]);
      const statement = this.database.prepare(sql);
      if (statement.reader === false) {
        runNonReturningStatement(statement, normalizedParameters);
        invokeCallback(callback, null);
        return this;
      }

      const row = statement.get(...normalizedParameters);
      invokeCallback(callback, null, row);
    } catch (error) {
      if (isNonReturningStatementError(error)) {
        try {
          runNonReturningStatement(this.database.prepare(sql), normalizeParameters(parameters[0]));
          invokeCallback(callback, null);
        } catch (runError) {
          if (callback) {
            invokeCallback(callback, runError as Error);
          } else {
            throw runError;
          }
        }
      } else if (callback) {
        invokeCallback(callback, error as Error);
      } else {
        throw error;
      }
    }

    return this;
  }

  all(sql: string, ...parameters: unknown[]): this {
    const callback = extractCallback<SqliteCallback>(parameters, undefined);

    try {
      const normalizedParameters = normalizeParameters(parameters[0]);
      const statement = this.database.prepare(sql);
      if (statement.reader === false) {
        runNonReturningStatement(statement, normalizedParameters);
        invokeCallback(callback, null, []);
        return this;
      }

      const rows = statement.all(...normalizedParameters);
      invokeCallback(callback, null, rows);
    } catch (error) {
      if (isNonReturningStatementError(error)) {
        try {
          runNonReturningStatement(this.database.prepare(sql), normalizeParameters(parameters[0]));
          invokeCallback(callback, null, []);
        } catch (runError) {
          if (callback) {
            invokeCallback(callback, runError as Error);
          } else {
            throw runError;
          }
        }
      } else if (callback) {
        invokeCallback(callback, error as Error);
      } else {
        throw error;
      }
    }

    return this;
  }

  exec(sql: string, callback?: SqliteCallback): this {
    try {
      this.database.exec(sql);
      invokeCallback(callback, null);
    } catch (error) {
      if (callback) {
        invokeCallback(callback, error as Error);
      } else {
        throw error;
      }
    }

    return this;
  }

  close(callback?: SqliteCallback): void {
    try {
      if (this.database.open) {
        this.database.close();
      }
      invokeCallback(callback, null);
    } catch (error) {
      if (callback) {
        invokeCallback(callback, error as Error);
      } else {
        throw error;
      }
    }
  }
}

export const BetterSqlite3SequelizeDialect = {
  OPEN_READONLY: 0x00000001,
  OPEN_READWRITE: 0x00000002,
  OPEN_CREATE: 0x00000004,
  Database: BetterSqlite3SequelizeDatabase,
};

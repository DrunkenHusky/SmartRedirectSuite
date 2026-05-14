import { Sequelize, DataTypes } from 'sequelize';
import type { Dialect, Options } from 'sequelize';
import path from 'path';
import fs from 'fs/promises';
import { z } from 'zod';

const dialectAliases = {
  postgresql: 'postgres',
} as const;

const supportedDialects = ['sqlite', 'postgres', 'mysql', 'mariadb'] as const;
type SupportedDialect = (typeof supportedDialects)[number];

const databaseEnvSchema = z.object({
  DB_DIALECT: z.string().optional().default('sqlite'),
  DB_STORAGE: z.string().optional(),
  DB_NAME: z.string().optional().default('smartredirect'),
  DB_USER: z.string().optional().default('root'),
  DB_PASSWORD: z.string().optional().default(''),
  DB_HOST: z.string().optional().default('localhost'),
  DB_PORT: z.string().optional(),
  DB_SSL: z.string().optional().default('false'),
  DB_POOL_MAX: z.string().optional().default('5'),
  DB_POOL_MIN: z.string().optional().default('0'),
  DB_POOL_ACQUIRE_MS: z.string().optional().default('30000'),
  DB_POOL_IDLE_MS: z.string().optional().default('10000'),
});

export interface DatabaseConfig {
  dialect: SupportedDialect;
  storagePath: string;
  database: string;
  username: string;
  password: string;
  host: string;
  port: number;
  ssl: boolean;
  pool: {
    max: number;
    min: number;
    acquire: number;
    idle: number;
  };
}

function parsePositiveInteger(value: string, fallback: number, name: string): number {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }

  return parsedValue || fallback;
}

export function normalizeDatabaseDialect(rawDialect: string | undefined): SupportedDialect {
  const normalizedDialect = (rawDialect || 'sqlite').trim().toLowerCase();
  const aliasedDialect = dialectAliases[normalizedDialect as keyof typeof dialectAliases] ?? normalizedDialect;

  if (!supportedDialects.includes(aliasedDialect as SupportedDialect)) {
    throw new Error(
      `Unsupported DB_DIALECT "${rawDialect}". Supported values: sqlite, postgres/postgresql, mysql, mariadb.`,
    );
  }

  return aliasedDialect as SupportedDialect;
}

export function loadDatabaseConfig(env: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  const parsedEnvironment = databaseEnvSchema.parse(env);
  const dialect = normalizeDatabaseDialect(parsedEnvironment.DB_DIALECT);
  const defaultPort = dialect === 'postgres' ? 5432 : 3306;

  return {
    dialect,
    storagePath: parsedEnvironment.DB_STORAGE || path.join(process.cwd(), 'data', 'database.sqlite'),
    database: parsedEnvironment.DB_NAME,
    username: parsedEnvironment.DB_USER,
    password: parsedEnvironment.DB_PASSWORD,
    host: parsedEnvironment.DB_HOST,
    port: dialect === 'sqlite' ? 0 : parsePositiveInteger(parsedEnvironment.DB_PORT || String(defaultPort), defaultPort, 'DB_PORT'),
    ssl: parsedEnvironment.DB_SSL.toLowerCase() === 'true',
    pool: {
      max: parsePositiveInteger(parsedEnvironment.DB_POOL_MAX, 5, 'DB_POOL_MAX'),
      min: parsePositiveInteger(parsedEnvironment.DB_POOL_MIN, 0, 'DB_POOL_MIN'),
      acquire: parsePositiveInteger(parsedEnvironment.DB_POOL_ACQUIRE_MS, 30000, 'DB_POOL_ACQUIRE_MS'),
      idle: parsePositiveInteger(parsedEnvironment.DB_POOL_IDLE_MS, 10000, 'DB_POOL_IDLE_MS'),
    },
  };
}

function createSequelizeOptions(config: DatabaseConfig): Options {
  const commonOptions: Options = {
    dialect: config.dialect as Dialect,
    logging: false,
    pool: config.dialect === 'sqlite' ? undefined : config.pool,
  };

  if (config.dialect === 'sqlite') {
    return {
      ...commonOptions,
      storage: config.storagePath,
    };
  }

  return {
    ...commonOptions,
    host: config.host,
    port: config.port,
    dialectOptions: config.ssl
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : undefined,
  };
}

export function createSequelize(config: DatabaseConfig = loadDatabaseConfig()): Sequelize {
  if (config.dialect === 'sqlite') {
    return new Sequelize(createSequelizeOptions(config));
  }

  return new Sequelize(config.database, config.username, config.password, createSequelizeOptions(config));
}

export function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (typeof value !== 'string') {
    return value as T;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function serializeJsonField(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return JSON.stringify(value);
}

const databaseConfig = loadDatabaseConfig();
const sequelize = createSequelize(databaseConfig);
const modelOptions = {};

export const UrlRuleModel = sequelize.define('UrlRule', {
  id: {
    type: DataTypes.TEXT,
    primaryKey: true,
  },
  matcher: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  targetUrl: DataTypes.TEXT,
  redirectType: DataTypes.TEXT,
  infoText: DataTypes.TEXT,
  createdAt: DataTypes.TEXT,
  autoRedirect: DataTypes.BOOLEAN,
  discardQueryParams: DataTypes.BOOLEAN,
  keptQueryParams: {
    type: DataTypes.TEXT,
    get() {
      return parseJsonField(this.getDataValue('keptQueryParams'), []);
    },
    set(value) {
      this.setDataValue('keptQueryParams', serializeJsonField(value));
    },
  },
  forwardQueryParams: DataTypes.BOOLEAN,
  searchAndReplace: {
    type: DataTypes.TEXT,
    get() {
      return parseJsonField(this.getDataValue('searchAndReplace'), []);
    },
    set(value) {
      this.setDataValue('searchAndReplace', serializeJsonField(value));
    },
  },
  staticQueryParams: {
    type: DataTypes.TEXT,
    get() {
      return parseJsonField(this.getDataValue('staticQueryParams'), []);
    },
    set(value) {
      this.setDataValue('staticQueryParams', serializeJsonField(value));
    },
  },
}, {
  ...modelOptions,
  indexes: [
    { fields: ['matcher'] },
    { fields: ['createdAt'] },
  ],
});

export const UrlTrackingModel = sequelize.define('UrlTracking', {
  id: {
    type: DataTypes.TEXT,
    primaryKey: true,
  },
  timestamp: DataTypes.TEXT,
  oldUrl: DataTypes.TEXT,
  newUrl: DataTypes.TEXT,
  path: DataTypes.TEXT,
  ruleId: DataTypes.TEXT,
  ruleIds: {
    type: DataTypes.TEXT,
    get() {
      return parseJsonField(this.getDataValue('ruleIds'), []);
    },
    set(value) {
      this.setDataValue('ruleIds', serializeJsonField(value));
    },
  },
  matchedRuleInfo: {
    type: DataTypes.TEXT,
    get() {
      return parseJsonField(this.getDataValue('matchedRuleInfo'), undefined);
    },
    set(value) {
      this.setDataValue('matchedRuleInfo', serializeJsonField(value));
    },
  },
  userAgent: DataTypes.TEXT,
  referrer: DataTypes.TEXT,
  clientIp: DataTypes.TEXT,
  matchQuality: DataTypes.FLOAT,
  matchType: DataTypes.TEXT,
  feedback: DataTypes.TEXT,
  userProposedUrl: DataTypes.TEXT,
  searchQueryInfo: {
    type: DataTypes.TEXT,
    get() {
      return parseJsonField(this.getDataValue('searchQueryInfo'), undefined);
    },
    set(value) {
      this.setDataValue('searchQueryInfo', serializeJsonField(value));
    },
  },
}, {
  ...modelOptions,
  indexes: [
    { fields: ['timestamp'] },
    { fields: ['path'] },
    { fields: ['ruleId'] },
    { fields: ['feedback'] },
    { fields: ['matchQuality'] },
  ],
});

export const AdminSessionModel = sequelize.define('AdminSession', {
  id: {
    type: DataTypes.TEXT,
    primaryKey: true,
  },
  data: {
    type: DataTypes.TEXT,
    allowNull: false,
    get() {
      return parseJsonField(this.getDataValue('data'), {});
    },
    set(value) {
      this.setDataValue('data', JSON.stringify(value ?? {}));
    },
  },
  expiresAt: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  ...modelOptions,
  indexes: [
    { fields: ['expiresAt'] },
  ],
});

export const GeneralSettingsModel = sequelize.define('GeneralSettings', {
  id: {
    type: DataTypes.TEXT,
    primaryKey: true,
  },
  data: {
    type: DataTypes.TEXT,
    allowNull: false,
    get() {
      return parseJsonField(this.getDataValue('data'), {});
    },
    set(value) {
      this.setDataValue('data', JSON.stringify(value ?? {}));
    },
  },
}, modelOptions);

export const GeneralSettingEntryModel = sequelize.define('GeneralSettingEntry', {
  key: {
    type: DataTypes.TEXT,
    primaryKey: true,
  },
  category: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: false,
    get() {
      return parseJsonField(this.getDataValue('value'), null);
    },
    set(value) {
      this.setDataValue('value', JSON.stringify(value));
    },
  },
}, {
  ...modelOptions,
  indexes: [
    { fields: ['category'] },
  ],
});

export const TranslationModel = sequelize.define('Translation', {
  lang: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  data: {
    type: DataTypes.TEXT,
    allowNull: false,
    get() {
      return parseJsonField(this.getDataValue('data'), {});
    },
    set(value) {
      this.setDataValue('data', JSON.stringify(value ?? {}));
    },
  },
}, modelOptions);

let initDbPromise: Promise<void> | null = null;

export async function initDb() {
  if (!initDbPromise) {
    initDbPromise = (async () => {
      if (databaseConfig.dialect === 'sqlite') {
        await fs.mkdir(path.dirname(databaseConfig.storagePath), { recursive: true });
      }

      await sequelize.authenticate();
      await sequelize.sync();
    })();
  }

  return initDbPromise;
}

export { sequelize, databaseConfig };

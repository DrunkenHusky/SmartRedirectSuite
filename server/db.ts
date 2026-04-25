import { Sequelize, DataTypes, Model } from 'sequelize';
import path from 'path';

const dialect = process.env.DB_DIALECT || 'sqlite';
const storagePath = process.env.DB_STORAGE || path.join(process.cwd(), 'data', 'database.sqlite');

let sequelize: Sequelize;

if (dialect === 'sqlite') {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: storagePath,
    logging: false,
  });
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME || 'smartredirect',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || (dialect === 'postgres' ? '5432' : '3306'), 10),
      dialect: dialect as any,
      logging: false,
    }
  );
}

// Models
export const UrlRuleModel = sequelize.define('UrlRule', {
  id: {
    type: DataTypes.TEXT,
    primaryKey: true,
  },
  matcher: DataTypes.TEXT,
  targetUrl: DataTypes.TEXT,
  redirectType: DataTypes.TEXT,
  infoText: DataTypes.TEXT,
  createdAt: DataTypes.TEXT,
  autoRedirect: DataTypes.BOOLEAN,
  discardQueryParams: DataTypes.BOOLEAN,
  keptQueryParams: {
    type: DataTypes.TEXT,
    get() {
      const val = this.getDataValue('keptQueryParams');
      return val ? JSON.parse(val) : [];
    },
    set(val) {
      this.setDataValue('keptQueryParams', JSON.stringify(val));
    }
  },
  forwardQueryParams: DataTypes.BOOLEAN,
  searchAndReplace: {
    type: DataTypes.TEXT,
    get() {
      const val = this.getDataValue('searchAndReplace');
      return val ? JSON.parse(val) : [];
    },
    set(val) {
      this.setDataValue('searchAndReplace', JSON.stringify(val));
    }
  },
  staticQueryParams: {
    type: DataTypes.TEXT,
    get() {
      const val = this.getDataValue('staticQueryParams');
      return val ? JSON.parse(val) : [];
    },
    set(val) {
      this.setDataValue('staticQueryParams', JSON.stringify(val));
    }
  }
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
      const val = this.getDataValue('ruleIds');
      return val ? JSON.parse(val) : [];
    },
    set(val) {
      this.setDataValue('ruleIds', val ? JSON.stringify(val) : null);
    }
  },
  matchedRuleInfo: {
    type: DataTypes.TEXT,
    get() {
      const val = this.getDataValue('matchedRuleInfo');
      return val ? JSON.parse(val) : undefined;
    },
    set(val) {
      this.setDataValue('matchedRuleInfo', val ? JSON.stringify(val) : null);
    }
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
      const val = this.getDataValue('searchQueryInfo');
      return val ? JSON.parse(val) : undefined;
    },
    set(val) {
      this.setDataValue('searchQueryInfo', val ? JSON.stringify(val) : null);
    }
  }
});

export const GeneralSettingsModel = sequelize.define('GeneralSettings', {
  id: {
    type: DataTypes.TEXT,
    primaryKey: true,
  },
  // just store everything as a single JSON text field for simplicity,
  // since settings is a single object
  data: {
    type: DataTypes.TEXT,
    get() {
      const val = this.getDataValue('data');
      return val ? JSON.parse(val) : {};
    },
    set(val) {
      this.setDataValue('data', JSON.stringify(val));
    }
  }
});


export const TranslationModel = sequelize.define('Translation', {
  lang: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  data: {
    type: DataTypes.TEXT,
    get() {
      const val = this.getDataValue('data');
      return val ? JSON.parse(val) : {};
    },
    set(val) {
      this.setDataValue('data', JSON.stringify(val));
    }
  }
});

export async function initDb() {
  await sequelize.sync();
}

export { sequelize };

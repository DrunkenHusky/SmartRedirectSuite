# SmartRedirect Suite - Architecture Overview

The application has a modular structure and clearly separates frontend, backend and shared types.

## Components
- **client/**: React 19 + TypeScript frontend, bundled with Vite.
- **server/**: Express-based backend with Sequelize database storage (SQLite by default, PostgreSQL/MariaDB/MySQL optional), rule cache, translation persistence, and database-backed session handling.
- **shared/**: Shared TypeScript types and validation schemes.

## Process
1. Requests reach the `server/` module.
2. The server initializes the database adapter from the `DB_*` environment variables. SQLite uses `data/database.sqlite`; `postgres`/`postgresql`, `mariadb`, and `mysql` use the same storage interface.
3. Existing JSON files (`rules.json`, `settings.json`, `tracking.json`) are imported once at startup and backed up as `.bak` files.
4. The server checks rules against an **in-memory cache** built from the database and invalidated after rule imports or changes.
5. Admin routes use Express Session with `DatabaseSessionStore`; expired sessions are pruned and all sessions are invalidated on startup.
6. Validated data is delivered to the `client/` frontend.
7. `shared/` provides type definitions and Zod schemas for both sides.

The architecture enables high-performance processing of over 100,000 rules through intelligent caching and optimized data structures.

## Internationalization

The frontend initializes i18next with English as the fallback language, browser-language detection, and cookie caching for explicit language-switch choices. Translation dictionaries are loaded from `/api/translations/{languageCode}` so administrators can update UI copy without rebuilding the application. The backend stores dictionaries in the `Translation` table, seeds the built-in languages (`en`, `de`, `it`, `es`, `fr`), validates custom language codes, and merges missing non-English keys with English fallback values.


## Dependency maintenance notes

`npm audit --audit-level=low` is part of CI so advisories in runtime and development dependencies stop pull requests before tests, build, and release. Local installations should use the npm version range declared in `package.json`.

Known transitive deprecation notes remain for dependencies below and require architecture-level migrations rather than safe patch updates:

- `dottie` is pulled in by Sequelize 6.x. Moving away from it requires a Sequelize 7 or ORM migration.
- `prebuild-install` is pulled in by `sqlite3`. Replacing it requires validating a different SQLite driver or ORM dialect integration.

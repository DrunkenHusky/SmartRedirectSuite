# Bolt's Journal

## 2024-05-24 - Initial Setup
**Learning:** Initialized Bolt's journal.
**Action:** Always check this file for past learnings before starting.
## 2025-12-13 - [Route-based Code Splitting]
**Learning:** The application was bundling the large `AdminPage` (with its heavy dependencies like tables and dialogs) into the main bundle, even for regular users visiting just for redirection.
**Action:** Implemented `React.lazy` and `Suspense` for the `AdminPage` in `App.tsx`. This separates the admin code into a separate chunk (`admin-*.js`), significantly reducing the initial download size for the primary redirection use case.
## 2024-05-24 - [N+1 Query Resolution]
**Learning:** In `server/storage.ts`, the `getTrackingEntriesPaginated` function was fetching all 5000+ rules from the database using an unconstrained `findAll()` on every paginated request, just to join the rule objects to the 50 fetched tracking entries. This caused a massive N+1 style bottleneck and high memory usage.
**Action:** Always verify how related entities are loaded in paginated endpoints. In Sequelize, extract unique related IDs (e.g., using `reduce` or `Set` over the current paginated page) and use `[Op.in]` to fetch only the required entities.
## 2026-05-14 - [better-sqlite3 Sequelize bindings]
**Learning:** `better-sqlite3` differs from Sequelize's native SQLite bindings in handling named parameters and boolean values. Sequelize passes named parameters with prefixes (e.g., `$1`, `$name`) and booleans directly, whereas `better-sqlite3` requires keys without prefixes and numeric equivalents (1/0) for booleans.
**Action:** When implementing custom database dialects, ensure parameter normalization accurately translates ORM-specific formats into the target driver's expected format. Also ensure that reading database attributes relies on Sequelize's `.get('attr')` to invoke custom model getters instead of bypassing them with `.getDataValue('attr')`.

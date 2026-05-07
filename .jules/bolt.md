# Bolt's Journal

## 2024-05-24 - Initial Setup
**Learning:** Initialized Bolt's journal.
**Action:** Always check this file for past learnings before starting.
## 2025-12-13 - [Route-based Code Splitting]
**Learning:** The application was bundling the large `AdminPage` (with its heavy dependencies like tables and dialogs) into the main bundle, even for regular users visiting just for redirection.
**Action:** Implemented `React.lazy` and `Suspense` for the `AdminPage` in `App.tsx`. This separates the admin code into a separate chunk (`admin-*.js`), significantly reducing the initial download size for the primary redirection use case.
## 2024-05-24 - [N+1 Query Issue in Tracking Data]
**Learning:** The `getTrackingEntriesPaginated` function in `server/storage.ts` was doing a full table scan `UrlRuleModel.findAll()` to enrich a tiny paginated subset of tracking entries. This was a classic N+1 adjacent problem causing unnecessary memory allocation and query overhead as the rules table grew.
**Action:** When enriching paginated datasets with related model data, avoid unconstrained `findAll()` calls. Always extract unique relationship IDs from the current paginated batch and fetch only those related records using a `WHERE id IN (...)` clause (or `[Op.in]`).

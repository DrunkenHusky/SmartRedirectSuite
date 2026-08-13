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
## 2025-02-18 - Database Aggregation Waterfall
**Learning:** Sequential `await` calls in dashboard aggregate functions (e.g., fetching metrics and counts) create significant performance bottlenecks by compounding roundtrip times (O(n) latency instead of O(1)).
**Action:** Always wrap independent dashboard or statistical database queries (such as independent `count` queries in `getTrackingStats`) in `Promise.all()` to allow Sequelize/databases to execute them concurrently, drastically reducing overall latency.

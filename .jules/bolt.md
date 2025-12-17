# Bolt's Journal

## 2024-05-24 - Initial Setup
**Learning:** Initialized Bolt's journal.
**Action:** Always check this file for past learnings before starting.
## 2025-12-13 - [Route-based Code Splitting]
**Learning:** The application was bundling the large `AdminPage` (with its heavy dependencies like tables and dialogs) into the main bundle, even for regular users visiting just for redirection.
**Action:** Implemented `React.lazy` and `Suspense` for the `AdminPage` in `App.tsx`. This separates the admin code into a separate chunk (`admin-*.js`), significantly reducing the initial download size for the primary redirection use case.

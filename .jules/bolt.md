## 2024-05-14 - String Searching and Sorting Bottlenecks
**Learning:** In V8/Node.js, using `localeCompare()` is significantly slower than standard string comparison operators (`<`, `>`), and using `toLowerCase().includes()` inside hot loops causes excessive object allocations compared to using a pre-compiled `RegExp` with the `i` flag.
**Action:** When filtering or sorting large datasets like URLs, always pre-compile a RegExp for searches and use standard `if (a < b) return -1;` comparisons (with an initial `.toLowerCase()` if needed) for performance-critical sorting instead of `localeCompare()`.

## 2024-05-14 - String Searching Bottlenecks
**Learning:** To optimize case-insensitive string searching within array filters (e.g., in `server/storage.ts` or frontend components like `OptimizedTable.tsx`), using `.toLowerCase().includes()` inside hot loops causes excessive object allocations.
**Action:** Pre-compile a regular expression (`new RegExp(pattern, 'i')`) outside the loop and use `.test()` inside to avoid repetitive and expensive `.toLowerCase().includes()` allocations.

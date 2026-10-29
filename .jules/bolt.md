## 2024-05-14 - String Searching and Sorting Bottlenecks
**Learning:** In V8/Node.js, using `localeCompare()` is significantly slower than standard string comparison operators (`<`, `>`), and using `toLowerCase().includes()` inside hot loops causes excessive object allocations compared to using a pre-compiled `RegExp` with the `i` flag.
**Action:** When filtering or sorting large datasets like URLs, always pre-compile a RegExp for searches and use standard `if (a < b) return -1;` comparisons (with an initial `.toLowerCase()` if needed) for performance-critical sorting instead of `localeCompare()`.

## 2024-05-15 - User Input String Searching Regex Compilation
**Learning:** When pre-compiling regular expressions from user input (e.g., for custom filters or searches in OptimizedTable), it's critical to manually implement an escape helper (e.g., `str.replace(/[.*+?^${}()|[\]\]/g, '\$&')`) because there is no global `escapeRegExp` utility available. Failing to do so can lead to invalid regex syntax or incorrect matching behavior.
**Action:** Always include or utilize an `escapeRegExp` helper when generating a `RegExp` instance dynamically from arbitrary user input in performance-critical filters.

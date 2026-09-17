## 2024-05-14 - String Searching and Sorting Bottlenecks
**Learning:** In V8/Node.js, using `localeCompare()` is significantly slower than standard string comparison operators (`<`, `>`), and using `toLowerCase().includes()` inside hot loops causes excessive object allocations compared to using a pre-compiled `RegExp` with the `i` flag.
**Action:** When filtering or sorting large datasets like URLs, always pre-compile a RegExp for searches and use standard `if (a < b) return -1;` comparisons (with an initial `.toLowerCase()` if needed) for performance-critical sorting instead of `localeCompare()`.

## 2024-05-15 - Exceptions for Control Flow in Parsing
**Learning:** Using `try...catch` blocks as a normal control flow mechanism (like catching a URL parsing error to retry with a prepended protocol) introduces severe performance penalties. The overhead of instantiating error objects and unwinding the stack in `catch` blocks makes the operation ~10-12x slower.
**Action:** Always pre-validate strings (e.g. using `startsWith` or regex) to determine the correct parsing strategy instead of relying on an exception to guide the logic.

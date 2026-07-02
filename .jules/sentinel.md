## 2024-05-24 - CSV Injection Vulnerability
**Vulnerability:** The `ImportExportService` generated CSV and Excel files without sanitizing fields (matcher, targetUrl, infoText). This allowed "Formula Injection" where a malicious user (or admin copying malicious input) could insert formulas (e.g., `=1+1`) that would execute when opened in Excel/Sheets.
**Learning:** Even internal admin-facing tools need sanitization, as admins might import/export data from untrusted sources or the application might be used in a way where "Info" fields are populated from user logs. CSV/Excel generation libraries often don't sanitize for formulas by default.
**Prevention:** Implemented a `sanitizeForCSV` helper that prepends a single quote `'` to any string starting with `=`, `+`, `-`, or `@`. Applied this to all text fields in CSV and Excel generation.

## 2025-04-24 - [Path Traversal in FileSessionStore]
**Vulnerability:** A path traversal vulnerability was discovered in `server/fileSessionStore.ts`. The session ID (`sid`) was used directly without any validation to construct the path of session files using `path.join()`. This could allow an attacker to traverse the file system by providing a `sid` containing `../`.
**Learning:** Even internal mechanisms like session storage require input validation when user-controlled data (like cookies) are used in file paths.
**Prevention:** Implemented path validation to reject traversal characters (`/`, `\`, `..`), sanitized the input by stripping non-alphanumeric characters, and added a defense-in-depth check using `path.resolve()` and `.startsWith()` to ensure the final path strictly resides inside the expected session directory.

## 2024-05-27 - [Predictable Randomness Vulnerability]
**Vulnerability:** The application used `Math.random()` combined with MD5 to generate seemingly unique filenames for uploaded files (e.g. imports) and to generate random strings for utility functions. Since `Math.random()` is not a Cryptographically Secure Pseudo-Random Number Generator (CSPRNG), an attacker might be able to predict the random values, potentially leading to filename collisions, enumeration attacks, or bypassing security controls relying on unpredictable strings.
**Learning:** Functions that provide general-purpose randomness like `Math.random()` shouldn't be used where uniqueness or unpredictability are security requirements, even if combined with hashing.
**Prevention:** Replaced the predictable `Math.random()` usages with standard cryptographically secure alternatives: `crypto.randomUUID()` in the backend for generating file identifiers, and `crypto.getRandomValues()` (via the Web Crypto API, with a Node.js fallback to `crypto.randomBytes()`) in shared/frontend utilities.

## 2024-05-24 - CSV Injection Vulnerability
**Vulnerability:** The `ImportExportService` generated CSV and Excel files without sanitizing fields (matcher, targetUrl, infoText). This allowed "Formula Injection" where a malicious user (or admin copying malicious input) could insert formulas (e.g., `=1+1`) that would execute when opened in Excel/Sheets.
**Learning:** Even internal admin-facing tools need sanitization, as admins might import/export data from untrusted sources or the application might be used in a way where "Info" fields are populated from user logs. CSV/Excel generation libraries often don't sanitize for formulas by default.
**Prevention:** Implemented a `sanitizeForCSV` helper that prepends a single quote `'` to any string starting with `=`, `+`, `-`, or `@`. Applied this to all text fields in CSV and Excel generation.

## 2025-04-24 - [Path Traversal in FileSessionStore]
**Vulnerability:** A path traversal vulnerability was discovered in `server/fileSessionStore.ts`. The session ID (`sid`) was used directly without any validation to construct the path of session files using `path.join()`. This could allow an attacker to traverse the file system by providing a `sid` containing `../`.
**Learning:** Even internal mechanisms like session storage require input validation when user-controlled data (like cookies) are used in file paths.
**Prevention:** Implemented path validation to reject traversal characters (`/`, `\`, `..`), sanitized the input by stripping non-alphanumeric characters, and added a defense-in-depth check using `path.resolve()` and `.startsWith()` to ensure the final path strictly resides inside the expected session directory.

## $(date +%Y-%m-%d) - Fix insecure random number generation

**Vulnerability:** Weak, predictable random number generation (`Math.random()`) used for sensitive operations like unique filename generation (in Multer configuration) and random token generation.
**Learning:** Default random methods are not cryptographically secure and can lead to predictability attacks and filename/token collisions.
**Prevention:** Always use Node.js `crypto` alternatives (like `crypto.randomUUID()` or `crypto.getRandomValues()`) for identifiers, filenames, and tokens requiring sufficient entropy.

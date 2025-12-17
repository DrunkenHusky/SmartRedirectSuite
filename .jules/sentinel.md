## 2024-05-22 - Session Secret Security & Future Tasks
**Vulnerability:** The application was using a hardcoded fallback string for `SESSION_SECRET` when the environment variable was missing. This makes session cookies predictable if the admin forgets to configure the secret.
**Learning:** Hardcoded fallbacks for cryptographic secrets are risky because they provide a false sense of functionality while compromising security. It's better to auto-generate a random secret (even if it causes inconvenience like session invalidation on restart) than to use a known weak secret.
**Prevention:** Always use `crypto.randomBytes()` for fallback secrets or fail startup if critical secrets are missing.
**Status:** Fixed by implementing random generation on startup.

### Deferred Tasks
1. **CSP Tightening:** The Content Security Policy allows `'unsafe-eval'` and `'unsafe-inline'`. This should be restricted to prevent XSS.
2. **Error Handling:** Verify `server/middleware/errorHandler.ts` to ensure stack traces are not leaked in production.

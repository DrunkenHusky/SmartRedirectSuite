## 2025-12-15 - [CSRF Protection]
**Vulnerability:** The application was missing CSRF protection on API endpoints, allowing potential state-changing attacks via authenticated sessions.
**Learning:** `Origin` and `Referer` headers can be used as a stateless defense against CSRF. However, parsing these headers must be robust. Specifically, `Origin: null` (sent by privacy modes or sandboxed iframes) or malformed URLs can cause server crashes (DoS) if not handled with try-catch blocks or safe parsing. Also, IPv6 addresses in `Origin` headers require careful handling when stripping ports (don't just split on colon).
**Prevention:**
1.  Use `new URL()` for robust parsing of `Origin` and `Referer`.
2.  Always wrap header parsing logic in `try-catch` to fail closed (deny access) on errors instead of crashing.
3.  Apply middleware explicitly to relevant route groups (e.g., `/api/admin`).
4.  Test edge cases like `Origin: null`, IPv6 addresses, and missing headers.

# SmartRedirect Suite - Admin-Dokumentation

This documentation is intended for administrators and DevOps teams. It bundles resources for installation, deployment and ongoing operations.

The admin area is accessible via the application's gear icon or by appending `?admin=true` to the base URL.

## Installation and deployment resources
- [INSTALLATION.md](./INSTALLATION.md): Quick start for local development.
- [ENTERPRISE_DEPLOYMENT.md](./ENTERPRISE_DEPLOYMENT.md): Guide for production environments.
- [OPENSHIFT_DEPLOYMENT.md](./OPENSHIFT_DEPLOYMENT.md): Example configuration for OpenShift.
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md): REST API for automation and monitoring.
- `Dockerfile.demo`: Demo container with automatic 24h reset for tests.

## User Interface
- **Table resizing**: Column widths can be adjusted individually in the "Rules" view and the "Import preview". To do this, move the mouse to the right edge of a column heading until the cursor changes and drag the column to the desired width.

## Maintenance
- Regular backups of `data/database.sqlite` or the external PostgreSQL/MariaDB/MySQL database, plus the `data/` directory for uploads.
- Admin sessions live in the same database, are cleared on every server start, and are also cleaned up automatically after expiry.
- Monitor logs and performance metrics according to deployment guides.
- **Rebuild cache**: The rule cache can be rebuilt manually in the admin area under "System & Data" > "Maintenance". This isn't usually necessary, but can help if you're having redirect issues after large imports or updates.

## Referrer Tracking & Analytics
- The system automatically records the HTTP referrer (source page) for each access.
- **Top 10 Referrers**: A dashboard widget displays the most common source domains.
- **Direct Access**: If there is no referrer (e.g. direct access or bookmark), this is displayed as "-" or "Direct".
- **Data export**: The CSV export of statistics now contains a "Referrer" column with the full URL.

## Login protection
- Failed logins are counted based on IP.
- After `LOGIN_MAX_ATTEMPTS` failed attempts (default: 5), the IP is blocked for `LOGIN_BLOCK_DURATION_MS` milliseconds (default: 24h).
- Values ​​can be adjusted via environment variables in the `.env`.
- **Unblock**: In the admin area under "System & Data" > "Danger Zone", all currently blocked IP addresses can be manually unblocked using the "Delete blocked IPs" button. This allows users immediate re-access.

## Rule prioritization & debugging
- Weights and normalization are in `shared/constants.ts` (`RULE_MATCHING_CONFIG`).
- Enable `DEBUG` in this configuration to log score, applied tie-breakers and the chosen rule per request.
- The case sensitivity of link detection can be controlled in the admin tab “Settings → Link detection” using the “Case sensitive” switch (default: off).

## Domain Rules
In addition to the classic path rules, domain rules are also supported.

### Matcher
The matcher can now be either a path (starting with `/`) or a domain (e.g. `www.google.ch`).
- **Path Matcher**: `/news` matches `http://anydomain.com/news`.
- **Domain Matcher**: `www.google.ch` matches `http://www.google.ch/any/path`.

### Redirect Type: Domain replacement
The “domain replacement” type (`domain`) allows flexible redirects:
1. **Path Preservation**: The original path and all query parameters are preserved. Only the domain is exchanged.
2. **Combination with path matchers**: If a path matcher (e.g. `/old-directory`) is used but the `domain` type is selected, the matcher in the path is ignored and the entire original path is appended to the new domain (analogous to a wildcard domain redirect for that specific path).
3. **Domain Matcher**: If the matcher is a domain (e.g. `old-site.com`), all requests to that domain will be redirected to the `Target URL`, preserving the path.

This enables complex migration scenarios where entire domains or subdomains are moved without having to create a separate rule for each path.

## Configuration validation
A tool for testing redirect rules without running them live.

### Features
- **Bulk Validation**: Test up to 1000 URLs at once by pasting (copy & paste) or file import (CSV, Excel).
- **Trace View**: Detailed tracking of each processing step (rule application, global search & replace, query parameter logic).
- **Change Tracking**: Visualize changes with color coding (Rules vs. Global Settings) and crossing out old values.
- **CSV export**: Export the results including all trace details for documentation or analysis.
- **Workflow**: Direct link to edit rules from the results list. After saving changes, the validation can be updated with one click.

Can be found in the “Rules” tab via the “Configuration Validation” button (only available for authenticated administrators).

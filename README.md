# SmartRedirect Suite

SmartRedirect Suite is a web application for centrally managing URL migrations between old and new domains. Typical use case: Migrating from SharePoint On-Premises to SharePoint Online when the domain and path structure change. The app notifies users of outdated links and can automatically redirect to new destinations.

**Demo instance:** [smartredirectsuite.render.com](https://smartredirectsuite.onrender.com/)
This version is always based on the latest dev build, resets every 24 hours and is suitable for trying out the app.

☕️ **Coffee for the code?** If you like the SmartRedirect Suite, buy me a coffee on [BuyMeACoffee](https://buymeacoffee.com/drunkenhusky) and keep the bits caffeinated!

## Table of Contents

- [Key Features](#key-features)
- [Documentation](#documentation)
- [Impressions](#impressions)
- [How it works](#how-it-works)
  - [Rule Modes](#rule-modes)
  - [Examples](#examples)
- [Use Cases](#use-cases)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [1. Clone Repository](#1-clone-repository)
  - [2. Install Dependencies](#2-install-dependencies)
  - [3. Create .env file](#3-create-env-file)
  - [4. Start Application](#4-start-application)
- [Administration](#administration)
  - [Import Rules](#import-rules)
  - [Customize Settings](#customize-settings)
  - [Matching Indicator](#matching-indicator)
  - [Statistics & Monitoring](#statistics--monitoring)
- [Release Process](#release-process)
- [Validation & Quality Assurance](#validation--quality-assurance)
- [Data Management](#data-management)
- [Security](#security)
- [Deployment](#deployment)
- [Development](#development)
- [Support & Contributions](#support--contributions)
- [Change History](#change-history)

## Key Features

- Central rule management with automatic URL detection
- Controlled migrations and traceable domain changes
- Productivity: Multi-select, import/export of rules
- Admin panel with secure session handling, customizable UI, and translation management
- Intelligent validation with overlap detection
- Extensive statistics and URL tracking
- Scalable architecture: Processing of over 100,000 rules and log entries without sacrificing performance
- Responsive design for desktop and mobile devices
- Multi-language UI with browser-language detection, cookie-based language preference, and built-in English, German, Italian, Spanish, and French translations


### Language support

SmartRedirect Suite uses English as the default and fallback language. The UI detects the browser language on first load, stores explicit language-switch choices in the `i18next` cookie for seven days, and serves translations from the backend. Administrators can open **Admin → Languages** to edit translations for English, German, Italian, Spanish, and French or add additional BCP 47 language codes such as `pt-br`.

## Documentation

- [User Manual](./docs/USER_MANUAL.md)
- [Admin Documentation](./docs/ADMIN_DOCUMENTATION.md)
- [Docker Deployment](./docs/DOCKER_DEPLOYMENT.md)
- [Architecture Overview](./docs/ARCHITECTURE_OVERVIEW.md)
- [Configuration Examples](./docs/CONFIGURATION_EXAMPLES.md)
- [Release Pipeline](./docs/release-pipeline.md)

## Impressions

Brief overview of central screens of the SmartRedirect Suite.

### Website visitors

1. **Initial message** - Notice that the link used is out of date and should be updated.
![Initial message – website visitor](Impressions/Initiale%20Meldung%20Website%20Besucher.png)

2. **New URL with notes** – Display of the automatically generated new URL including notes as well as the old, accessed URL.
![Display new URL with information - website visitors pop-up after confirmation](Impressions/Anzeige%20neuer%20URL%20mit%20Hinweisen%20Website%20Besucher%20nach%20Best%C3%A4tigung%20Pop%20up.png)

### Admin area

3. **General Settings** – Overview of global options and basic configuration.
![Admin Menu – General Settings](Impressions/Admin%20Menu%20Generelle%20Einstellungen.png)

4. **URL Transformation Rules** – Management of rules (type, auto-redirect, status, metadata).
![Admin Menu – Define URL transformation rules](Impressions/Admin%20Menu%20URL-Transformationsregeln%20definieren.png)

5. **Statistics & Tracking** – List of all tracking entries with timestamp, old/new URL and path.
![Admin Menu – Statistics](Impressions/Admin%20Menu%20Statistik.png)

6. **Import/Export** – Export of statistics (CSV/JSON) as well as import/export of URL rules.
![Admin Menu – Import Export](Impressions/Admin%20Menu%20Import%20Export.png)

## How it works

Each rule defines:

- a **URL path matcher**
- a **mode** (_partial_ or _complete_)
- Target values ​​(**Base URL** or **Target URL**)

The matcher attacks anywhere in the path - a rule like `/sites/team`
matches both `/sites/team/docs` and `/archive/sites/team/docs`.

**Fallback without rules:** If rules are missing, a domain replacement occurs according to the general settings; Path, parameters and anchors are retained.

### Rule Modes

| Mode            | Behavior                                                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Partial**   | Replaces path segments starting from the matcher. Base URL comes from general settings; additional segments, parameters and anchors are appended. |
| **Complete** | Completely redirects to a new destination URL. No parts of the old URL are retained.                                                      |

### Case sensitive

The “Case sensitive” option can be activated in the general settings.

- **Disabled (default):** `/Test` and `/test` are treated as the same. The system internally normalizes all paths to lowercase letters.
- **Enabled:** `/Test` and `/test` are considered different. A rule for `/Test` does not apply when `/test` is called.

**Best Practice:** Only enable this option if the original system (e.g. a Linux file system or a specific CMS) used case-sensitive URLs and you need to avoid collisions.

### Examples

**Source URL**

```
https://intranet.alt.com/sites/team/docs/handbuch.pdf?version=3#kapitel-2
```

**Partially**

```
Matcher: /sites/team
New path segment: /teams/finance
Result: https://neuesintranet.cloud.com/teams/finance/docs/handbuch.pdf?version=3#kapitel-2
```

**Complete**

```
Matcher: /sites/team
Target URL: https://andereseite.com/hub
Result: https://andereseite.com/hub
```

**Without rule (domain replacement)**

```
Result: https://neuesintranet.cloud.com/sites/team/docs/handbuch.pdf?version=3#kapitel-2
```

### Rule prioritization (specificity)

The most specific rule wins. The specificity score \(S\) is calculated as:

\[
S = P*{path} \cdot WEIGHT_PATH_SEGMENT + P*{param} \cdot WEIGHT_QUERY_PAIR + W*{wildcards} \cdot PENALTY_WILDCARD + E*{exact} \cdot BONUS_EXACT_MATCH
\]

- **P_path** – Number of exactly matching static path segments
- **P_param** – Number of matching query key=value pairs
- **W_wildcards** – Wildcards/wildcards (are weighted negatively)
- **E_exact** – Bonus for complete path and query match

Examples:

- Request `/subsite/xyz` → rule `/subsite/xyz` beats `/subsite`
- Request `/subsite?document.aspx=123` → Rule `/subsite?document.aspx=123` beats `/subsite`

Tie-breaker: more static segments → more query pairs → fewer wildcards → older `createdAt`/lower ID.

## Advanced rule options

### Smart Search Redirects
If the "Intelligent search redirection" option is activated as a fallback, the system tries to extract a search term from the old URL if no direct rule applies.

*   **Default:** The last segment of the path is used as the search term.
*   **Regex Rules:** You can define specific rules (e.g. `[?&]file=([^&]+)`) to extract IDs or document names from parameters.
*   **Order:** Rules are checked from top to bottom.
*   **URL Encoding:** You can specify globally or per rule whether the extracted search term should be URL encoded (e.g. `%20` instead of spaces).

### Find & Replace

You can define that certain parts of the target URL (including path and parameters) should be replaced. This happens **after** generating the base URL, but **before** appending static parameters.

*   **Find:** The text (string) to replace.
*   **Replace:** The new text. If empty, the search text is deleted.
*   **Case Sensitivity:** Determines whether to be case sensitive.

### Feedback Survey & Fallback

The feedback survey can optionally be expanded with a **Smart Search Fallback** function. If a user clicks "NOK" (thumbs down) and intelligent search redirection is active, they will be offered an alternative search link.

*   This creates a separate statistics entry.
*   The user can also provide feedback for this suggestion.
*   If the user clicks "NOK" again, he can (if activated) suggest the correct URL.

**Note about auto-redirect:**
If auto-redirect is enabled (globally or by rule), the feedback survey will be skipped. The system automatically logs this interaction as “auto-redirect” in the feedback statistics.

### Parameter-Handling

For "Partial" and "Full" (Wildcard) redirects, you can control how URL parameters are handled.

**For Partial & Domain Rules:**
1. **Discard parameters:** Check "Remove all link parameters" to delete all query parameters of the old URL by default. If disabled, all parameters are applied.
2. **Define Exceptions (Keep):** If Discard is enabled, you can define specific parameters that should still be retained.

**For Wildcard Rules:**
1. **Keep parameters (Forward):** Check "Keep all link parameters" to append all parameters 1:1 to the target URL.
2. **Specific Parameters:** When Forward is disabled, all parameters are removed by default. You can then define specific exceptions under "Keep/rename parameters".

**Generally:**
*   **Regex:** Key and Value can be defined via Regex.
*   **Rename:** You can specify a "Target Key". Example: `?file=document.pdf` becomes `?f=document.pdf`.
*   **Do Not Encode (Raw):** For static and persisted parameters, the Do Not Encode option can be enabled. This prevents the default URL encoding of the values ​​(useful if `%20` is needed instead of `+` or the value is already encoded).
*   **Static parameters:** You can define parameters that will **always** be appended (e.g. `?source=migration`).

**Order of parameters in the target URL:**
1. Static parameters (in the defined order)
2. Retained parameters (in the defined order)

**Example:**
*   Alte URL: `.../page?old=123&ignore=me`
*   Static: `new=A`
*   Keep: `old` -> `id`
*   Result: `.../target?new=A&id=123`

## Use Cases

- Migrationen (z. B. SharePoint On‑Premises → SharePoint Online)
- Domain rebrands and consolidations
- Restructuring of large link landscapes

## Quick Start

### Prerequisites

- Node.js >= 22
- npm >= 10.9.0

Check the installation:

```bash
node --version
npm --version
```

### 1. Clone repository

```bash
git clone <repository-url>
cd SmartRedirectSuite
```

### 2. Install dependencies

```bash
npm install
```

> Note: CI also runs `npm audit --audit-level=low` so installed dependencies are checked for known vulnerabilities before tests, build, and release.

### 3. Create .env file

Create a `.env` file in the root directory:

```bash
cat > .env <<'EOF'
# Admin panel authentication
ADMIN_PASSWORD=MySecurePassword123

# Session security
SESSION_SECRET=insert-a-super-secret-session-key-here-minimum-32-characters

# Brute-force protection (optional)
# Maximum failed attempts before an IP is blocked
LOGIN_MAX_ATTEMPTS=5
# Block duration in milliseconds (24h)
LOGIN_BLOCK_DURATION_MS=86400000

# Import preview limit (number of rules)
IMPORT_PREVIEW_LIMIT=1000

# Server configuration
PORT=5000
NODE_ENV=development

# File upload path (optional)
# LOCAL_UPLOAD_PATH=./data/uploads
EOF
```

### 4. Start the application

```bash
npm run dev        # Entwicklungsmodus
# oder
npm run build
npm start          # Produktion
```

The application then runs at `http://localhost:5000`.

## Public API

The SmartRedirect Suite provides a public API endpoint for automating URL transformations. This endpoint does not require authentication and applies the configured rate limiting.

### URL-Transformation Endpoint

`POST /api/public/transform`

This endpoint allows you to pass an old URL and receive the corresponding new URL back according to the configured redirect rules. The URL can be passed either as a JSON body or as a query parameter.

**Request Body (JSON)**

```json
{
  "url": "https://intranet.alt.com/sites/team/docs/handbuch.pdf"
}
```

**Request via Query-Parameter**

`POST /api/public/transform?url=https://intranet.alt.com/sites/team/docs/handbuch.pdf`

**Response (JSON)**

```json
{
  "oldUrl": "https://intranet.alt.com/sites/team/docs/handbuch.pdf",
  "newUrl": "https://neuesintranet.cloud.com/teams/finance/docs/handbuch.pdf",
  "hasMatch": true,
  "ruleId": "123e4567-e89b-12d3-a456-426614174000",
  "redirectStrategy": "rule"
}
```

- `oldUrl`: The original URL.
- `newUrl`: The generated target URL.
- `hasMatch`: `true` if a specific rule was applied, `false` otherwise.
- `ruleId`: The UUID of the applied rule (if any).
- `redirectStrategy`: The redirect mode applied (e.g. `rule`, `domain-fallback`, `smart-search`).

## Administration

The admin area can be opened via the gear symbol in the top right or directly via the URL parameter `?admin=true`.

### Import rules

Example of a JSON file:

```json
{
  "rules": [
    {
      "matcher": "/old-page/",
      "targetUrl": "/new-page/",
      "type": "redirect",
      "infoText": "This page has moved"
    }
  ]
}
```

Upload in the admin panel or view via `sample-rules-import.json`.

### Adjust settings

In the admin panel, texts, colors and UI elements can be customized, including:

- Header and icons
- Popup text
- Labels in URL comparison
- Visibility of the buttons (“Copy URL” and “Open in new tab”)
- Click behavior of the displayed URL (copy, open, or no action)
- Button labels
- Additional info areas

### Matching Indicator

The matching indicator (link quality tachometer) visualizes how well a visited URL matches a new URL. It will appear on the migration page.

**Quality levels:**

- **Green (100%):** Exact match or home page (root).
- **Yellow (60-90%):** URL recognized, but with slight deviations (e.g. additional parameters).
- **Red (< 60%):** Only partial match or no specific assignment possible.

The explanatory texts for these levels can be customized in the admin area under “General Settings”.

### Statistics & Monitoring

The admin panel shows:

- Access numbers (total, today, week)
- Top-URLs
- Time-based evaluations (24h, 7 days, all data)
- Export as CSV/JSON

### Performance & System Requirements

The system uses highly optimized in-memory processing for URL rules and tracking data.

*   **Tracking cache:** To avoid high I/O loads, tracking data can be kept in memory. This is enabled by default and massively speeds up dashboard access.
    *   **Recommendation:** For production systems with a lot of access, at least **512 MB to 1 GB RAM** should be planned, especially if the number of tracking entries exceeds 500,000.
    *   **Configuration:** The cache can be disabled in the admin settings under "System & Data" -> "System Settings" if RAM is low (results in slower statistics).

## Release process

This project uses an automated CI/CD pipeline with **GitHub Actions** and **Semantic Release**.

- Commits should follow the [Conventional Commits](https://www.conventionalcommits.org/) convention (e.g. `feat:`, `fix:`).
- When pushed to `main`, testing, versioning and publishing are carried out automatically.
- Docker images are automatically pushed to the GitHub Container Registry (ghcr.io).

Further details can be found in the [Release Documentation](./docs/release-pipeline.md).

## Validation & Quality Assurance

The application prevents:

- Duplicate URL matchers
- Overlapping rules (e.g. `/news/` and `/news/archive/`)
- Wildcard conflicts
- Invalid path segments

Errors are reported in detail in German; If there are validation errors, no changes are saved.

## Data management

By default, SmartRedirect Suite uses a SQLite database at `data/database.sqlite`. Existing JSON files from older versions (`data/rules.json`, `data/settings.json`, `data/tracking.json`) are migrated once at startup and then backed up as `.bak` files.

Admin sessions are stored in the database and deliberately cleared on each server startup; old `data/sessions/*.json` files are deleted and not imported. Production setups can switch the database with `DB_DIALECT` to `postgres`/`postgresql`, `mariadb`, or `mysql`. `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and optional `DB_SSL=true` configure external connections.

## Security

- Session authentication with a 7-day cookie lifetime within a server lifecycle
- Secure cookies and database-backed sessions
- Password protected admin area
- Brute force protection with IP blocking (configurable via `LOGIN_MAX_ATTEMPTS` and `LOGIN_BLOCK_DURATION_MS`)
- XSS protection through React
- Input validation with Zod
- Configuration via environment variables

## Deployment

The app uses SQLite as the database by default, but can also be operated with PostgreSQL or MariaDB/MySQL. For more information, see the [Docker Deployment Documentation](./docs/DOCKER_DEPLOYMENT.md) and the included docker-compose examples.


Local Production:

```bash
npm run build
npm start
```

Other platforms: Vercel, Heroku or Docker. For Docker installation details, see the [Docker Deployment Guide](./docs/DOCKER_DEPLOYMENT.md).

For demo purposes with daily data reset, the `Dockerfile.demo` can be used (resets sessions, uploads and settings daily).

### Automatic deployment on fly.io

The repository contains a CI/CD pipeline (`.github/workflows/deploy.yml`) for automatic deployment to fly.io.

*   **Trigger:** A push to the `NextRelease` branch triggers the deployment.
*   **Requirements:**
    *   The secret `FLY_API_TOKEN` must be stored in the GitHub Repository Settings.
    *   The configuration is done via the `fly.toml` and the `Dockerfile.demo`.
*   **Process:** The GitHub Action authenticates itself via token, builds the image remotely on fly.io and deploys the new version.

## Development

Technology-Stack:

- React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- Express.js and Zod in the backend
- TanStack Query, Wouter, React Hook Form

Guidelines:

1. Use TypeScript
2. Zod schemas for validation
3. Shared Types between Frontend and Backend
4. UI in German
5. Responsive, Mobile-First Design

Branding & Versioning:

- App name and version are derived centrally from the `package.json` via `shared/appMetadata.ts`.
- Changes to the name/version only have to be made there and are then available both in the client (document title, footer) and in the server (response header).

## Support & Contribution

In case of problems:

1. Check console logs
2. Control environmental variables
3. Install dependencies
4. Verify `ADMIN_PASSWORD`
5. Check upload path in case of logo errors

# SmartRedirect Suite - Konfigurationsbeispiele

## .env example
```bash
ADMIN_PASSWORD=MeinSicheresPasswort123
SESSION_SECRET=super-geheimer-session-schluessel-hier-einfuegen-mindestens-32-zeichen
LOGIN_MAX_ATTEMPTS=5
LOGIN_BLOCK_DURATION_MS=86400000
PORT=5000
NODE_ENV=development
```

## Example rules
The file [sample-rules-import.json](../sample-rules-import.json) shows the structure of a rules file:

```json
{
  "rules": [
    {
      "matcher": "/alte-seite/",
      "targetUrl": "/neue-seite/",
      "type": "redirect",
      "infoText": "Diese Seite wurde verschoben"
    }
  ]
}
```

## Keep Query Params with Regex

The "Keep parameters" function allows specific query parameters to be taken over from the old URL and optionally transformed.

### Example 1: Simple Preserve
Preserves the `ref` parameter.

- **Parameter Key (Regex):** `ref`
- **Value Matcher:** (leather)
- **New name:** (empty)

**Result:** `/old?ref=123` -> `/new?ref=123`

### Example 2: Rename
Renames the `utm_source` parameter to `source`.

- **Parameter Key (Regex):** `utm_source`
- **Value Matcher:** (leather)
- **New name:** `source`

**Result:** `/old?utm_source=google` -> `/new?source=google`

### Example 3: Extract value with regex (lookbehind)
Extracts a part of the value that comes after a backslash (e.g. Domain-User).

- **Parameter Key (Regex):** `accountname`
- **Value Matcher (Regex):** `(?<=\\).*`
- **New name:** `user`

**Result:** `/old?accountname=DOMAIN\User123` -> `/new?user=User123`

### Example 4: Extract value with Capture Group
Extracts the ID from a complex string.

- **Parameter Key (Regex):** `id`
- **Value Matcher (Regex):** `^prefix-(\d+)$`
- **New name:** `itemId`

**Ergebnis:** `/old?id=prefix-555` -> `/new?itemId=555`

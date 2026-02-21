# SmartRedirect Suite - Konfigurationsbeispiele

## .env Beispiel
```bash
ADMIN_PASSWORD=MeinSicheresPasswort123
SESSION_SECRET=super-geheimer-session-schluessel-hier-einfuegen-mindestens-32-zeichen
LOGIN_MAX_ATTEMPTS=5
LOGIN_BLOCK_DURATION_MS=86400000
PORT=5000
NODE_ENV=development
```

## Beispiel-Regeln
Die Datei [sample-rules-import.json](../sample-rules-import.json) zeigt den Aufbau einer Regeldatei:

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

## Parameter beibehalten (Keep Query Params) mit Regex

Die Funktion "Parameter beibehalten" erlaubt es, spezifische Query-Parameter aus der alten URL zu übernehmen und optional zu transformieren.

### Beispiel 1: Einfaches Beibehalten
Behält den Parameter `ref` bei.

- **Parameter Key (Regex):** `ref`
- **Value Matcher:** (leer)
- **Neuer Name:** (leer)

**Ergebnis:** `/old?ref=123` -> `/new?ref=123`

### Beispiel 2: Umbenennen
Benennt den Parameter `utm_source` in `source` um.

- **Parameter Key (Regex):** `utm_source`
- **Value Matcher:** (leer)
- **Neuer Name:** `source`

**Ergebnis:** `/old?utm_source=google` -> `/new?source=google`

### Beispiel 3: Wert extrahieren mit Regex (Lookbehind)
Extrahiert einen Teil des Wertes, der nach einem Backslash steht (z.B. Domain-User).

- **Parameter Key (Regex):** `accountname`
- **Value Matcher (Regex):** `(?<=\\).*`
- **Neuer Name:** `user`

**Ergebnis:** `/old?accountname=DOMAIN\User123` -> `/new?user=User123`

### Beispiel 4: Wert extrahieren mit Capture Group
Extrahiert die ID aus einem komplexen String.

- **Parameter Key (Regex):** `id`
- **Value Matcher (Regex):** `^prefix-(\d+)$`
- **Neuer Name:** `itemId`

**Ergebnis:** `/old?id=prefix-555` -> `/new?itemId=555`

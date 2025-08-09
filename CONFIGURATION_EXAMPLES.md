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
Die Datei [sample-rules-import.json](./sample-rules-import.json) zeigt den Aufbau einer Regeldatei:

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

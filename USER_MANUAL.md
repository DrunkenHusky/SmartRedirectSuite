# SmartRedirect Suite - Benutzerhandbuch

Dieses Handbuch beschreibt die tägliche Nutzung der SmartRedirect Suite. Die Anwendung verwaltet mehr als 100.000 URL-Transformationsregeln und unterstützt Migrationen zwischen Domains.

## Einstieg
- Anwendung starten: `npm run dev` für Entwicklung oder `npm start` nach dem Build.
- Admin-Login über die Hauptseite aufrufen (Standardpasswort in `.env` konfiguriert).

## Regeln verwalten
1. **Neue Regel** anlegen: URL-Matcher, Ziel-URL und Modus (*Teilweise* oder *Vollständig*) festlegen.
2. **Auto-Redirect** optional aktivieren.
3. **Info-Text** zur Erläuterung für Nutzer hinterlegen.

## Import und Export
- JSON-Dateien im Format von [sample-rules-import.json](./sample-rules-import.json) importieren.
- Regeln und Statistiken als CSV oder JSON exportieren.

## Monitoring
- Statistik-Tab zeigt Zugriffszahlen, Top-URLs und Zeitraumfilter.
- Einträge können exportiert oder zurückgesetzt werden.

Weiterführende Setup-Hinweise finden sich in [INSTALLATION.md](./INSTALLATION.md).

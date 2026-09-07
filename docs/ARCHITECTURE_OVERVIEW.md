# SmartRedirect Suite - Architektur-Übersicht

Die Anwendung ist modular aufgebaut und trennt klar zwischen Frontend, Backend und gemeinsam genutzten Typen.

## Komponenten
- **client/**: React 18 + TypeScript Frontend, gebündelt mit Vite.
- **server/**: Express-basiertes Backend mit Dateispeicher und Session-Handling.
- **shared/**: Gemeinsame TypeScript-Typen und Validierungsschemata.

## Ablauf
1. Anfragen erreichen das `server/`-Modul.
2. Der Server prüft Regeln gegen einen **In-Memory Cache**, der beim Start aus `data/rules.json` geladen wird, um I/O-Latenz zu vermeiden.
3. Validierte Daten werden an das `client/`-Frontend ausgeliefert.
4. `shared/` stellt Typdefinitionen und Zod-Schemas für beide Seiten bereit.

Die Architektur ermöglicht die hochperformante Verarbeitung von über 100.000 Regeln durch intelligentes Caching und optimierte Datenstrukturen.

## Self-Hosting und Persistenz

Der Node.js/Express-Prozess ist zustandslos. Regeln, Tracking, Einstellungen und Admin-Sitzungen liegen in PostgreSQL. Beim Start validiert Zod alle Umgebungsvariablen und die Anwendung führt idempotente `CREATE TABLE IF NOT EXISTS`-Migrationen aus. Dadurch können mehrere Container hinter einem Kubernetes Service betrieben werden. Passwort- oder externer OAuth-2.0/OIDC-Login erzeugen dieselbe serverseitige Sitzung. Der OAuth-Flow nutzt Discovery, State-Prüfung, Authorization Code Exchange und optional eine Admin-Gruppenfreigabe.

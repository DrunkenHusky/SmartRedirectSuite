# SmartRedirect Suite - Architektur-Übersicht

Die Anwendung ist modular aufgebaut und trennt klar zwischen Frontend, Backend und gemeinsam genutzten Typen.

## Komponenten
- **client/**: React 18 + TypeScript Frontend, gebündelt mit Vite.
- **server/**: Express-basiertes Backend mit Sequelize-Datenbankadapter (SQLite standardmäßig, PostgreSQL/MariaDB/MySQL optional), Regel-Cache und datenbankgestütztem Session-Handling.
- **shared/**: Gemeinsame TypeScript-Typen und Validierungsschemata.

## Ablauf
1. Anfragen erreichen das `server/`-Modul.
2. Der Server initialisiert den Datenbankadapter aus den `DB_*`-Umgebungsvariablen. Standard ist SQLite unter `data/database.sqlite`; `postgres`/`postgresql`, `mariadb` und `mysql` sind über dieselbe Storage-Schnittstelle nutzbar.
3. Bestehende JSON-Dateien (`rules.json`, `settings.json`, `tracking.json`) werden beim Start einmalig importiert und danach als `.bak` gesichert. Admin-Sessions werden in der Tabelle `AdminSessions` mit Ablaufindex gespeichert; aktive DB-Sessions und alte `data/sessions/*.json`-Dateien werden bei jedem Serverstart geleert bzw. gelöscht.
4. Der Server prüft Regeln gegen einen **In-Memory Cache**, der aus der Datenbank aufgebaut und nach Regel-Importen/-Änderungen invalidiert wird, um I/O-Latenz zu vermeiden.
5. Admin-Routen nutzen Express-Session mit dem `DatabaseSessionStore`; abgelaufene Sessions werden beim Zugriff und zusätzlich periodisch bereinigt, alle bestehenden Sessions zusätzlich beim Serverstart invalidiert.
6. Validierte Daten werden an das `client/`-Frontend ausgeliefert.
7. `shared/` stellt Typdefinitionen und Zod-Schemas für beide Seiten bereit.

Die Architektur ermöglicht die hochperformante Verarbeitung von über 100.000 Regeln durch intelligentes Caching und optimierte Datenstrukturen.

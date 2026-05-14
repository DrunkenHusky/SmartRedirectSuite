# SmartRedirect Suite - Architektur-Übersicht

Die Anwendung ist modular aufgebaut und trennt klar zwischen Frontend, Backend und gemeinsam genutzten Typen.

## Komponenten
- **client/**: React 18 + TypeScript Frontend, gebündelt mit Vite.
- **server/**: Express-basiertes Backend mit Sequelize-Datenbankadapter (SQLite standardmäßig, PostgreSQL/MariaDB/MySQL optional), Regel-Cache und dateibasiertem Session-Handling.
- **shared/**: Gemeinsame TypeScript-Typen und Validierungsschemata.

## Ablauf
1. Anfragen erreichen das `server/`-Modul.
2. Der Server initialisiert den Datenbankadapter aus den `DB_*`-Umgebungsvariablen. Standard ist SQLite unter `data/database.sqlite`; `postgres`/`postgresql`, `mariadb` und `mysql` sind über dieselbe Storage-Schnittstelle nutzbar.
3. Bestehende JSON-Dateien (`rules.json`, `settings.json`, `tracking.json`) werden beim Start einmalig importiert und danach als `.bak` gesichert.
4. Der Server prüft Regeln gegen einen **In-Memory Cache**, der aus der Datenbank aufgebaut und nach Regel-Importen/-Änderungen invalidiert wird, um I/O-Latenz zu vermeiden.
5. Validierte Daten werden an das `client/`-Frontend ausgeliefert.
6. `shared/` stellt Typdefinitionen und Zod-Schemas für beide Seiten bereit.

Die Architektur ermöglicht die hochperformante Verarbeitung von über 100.000 Regeln durch intelligentes Caching und optimierte Datenstrukturen.

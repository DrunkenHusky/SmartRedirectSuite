# SmartRedirect Suite - Architektur-Übersicht

Die Anwendung ist modular aufgebaut und trennt klar zwischen Frontend, Backend und gemeinsam genutzten Typen.

## Komponenten
- **client/**: React 18 + TypeScript Frontend, gebündelt mit Vite.
- **server/**: Express-basiertes Backend mit Sequelize-Datenbankadapter (SQLite standardmäßig über eine `better-sqlite3`-Kompatibilitätsschicht, PostgreSQL/MariaDB/MySQL optional), Regel-Cache, normalisierter Key/Value-Persistenz für allgemeine Einstellungen und datenbankgestütztem Session-Handling.
- **shared/**: Gemeinsame TypeScript-Typen und Validierungsschemata.

## Ablauf
1. Anfragen erreichen das `server/`-Modul.
2. Der Server initialisiert den Datenbankadapter aus den `DB_*`-Umgebungsvariablen. Standard ist SQLite unter `data/database.sqlite`; Sequelize nutzt dafür ein internes `better-sqlite3`-Dialect-Modul, während `postgres`/`postgresql`, `mariadb` und `mysql` über dieselbe Storage-Schnittstelle nutzbar bleiben.
3. Bestehende JSON-Dateien (`rules.json`, `settings.json`, `tracking.json`) werden beim Start einmalig importiert und danach als `.bak` gesichert. `settings.json` und ältere `GeneralSettings`-JSON-Zeilen werden in einzelne `GeneralSettingEntries` migriert, damit Änderungen pro Einstellung atomar gespeichert und fachlich kategorisiert werden können. Admin-Sessions werden in der Tabelle `AdminSessions` mit Ablaufindex gespeichert; aktive DB-Sessions und alte `data/sessions/*.json`-Dateien werden bei jedem Serverstart geleert bzw. gelöscht.
4. Der Server prüft Regeln gegen einen **In-Memory Cache**, der aus der Datenbank aufgebaut und nach Regel-Importen/-Änderungen invalidiert wird, um I/O-Latenz zu vermeiden.
5. Admin-Routen nutzen Express-Session mit dem `DatabaseSessionStore`; abgelaufene Sessions werden beim Zugriff und zusätzlich periodisch bereinigt, alle bestehenden Sessions zusätzlich beim Serverstart invalidiert.
6. Validierte Daten werden an das `client/`-Frontend ausgeliefert.
7. `shared/` stellt Typdefinitionen und Zod-Schemas für beide Seiten bereit.

Die Architektur ermöglicht die hochperformante Verarbeitung von über 100.000 Regeln durch intelligentes Caching und optimierte Datenstrukturen.

## Hinweise zur Dependency-Wartung

`npm audit --audit-level=low` ist Teil der CI, damit Advisories in Laufzeit- und Entwicklungsabhängigkeiten Pull Requests vor Tests, Build und Release stoppen. Lokale Installationen sollen den in `package.json` deklarierten npm-Versionsbereich verwenden; damit bleiben die Installationsanforderungen mit dem dokumentierten Node.js-22-Setup synchron.

Der aktuelle Dependency-Graph enthält weiterhin einen transitiven Deprecation-Hinweis, der nicht ohne größere ORM-Migration entfernt werden kann:

- `dottie` wird von Sequelize 6.x eingebunden. Sequelize 7 wird weiterhin über den `@sequelize/core`-Alpha-Kanal verteilt und trennt das Adapterverhalten für SQLite/PostgreSQL/MySQL/MariaDB stärker, daher ist ein Ersatz von Sequelize eine Architektur-Migration statt eines sicheren Patch-Updates.

Der frühere direkte `sqlite3`-Treiber wurde durch `better-sqlite3` ersetzt. Damit Sequelize 6.x weiter dieselbe Storage-Schnittstelle verwenden kann, stellt `server/betterSqlite3Dialect.ts` die von Sequelize erwarteten Callback-Methoden (`run`, `get`, `all`, `exec`, `serialize`, `close`) auf Basis des synchronen `better-sqlite3`-APIs bereit.

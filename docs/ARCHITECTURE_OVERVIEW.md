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

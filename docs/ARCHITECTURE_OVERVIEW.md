# SmartRedirect Suite - Architektur-Übersicht

Die Anwendung ist modular aufgebaut und trennt klar zwischen Frontend, Backend und gemeinsam genutzten Typen.

## Komponenten
- **client/**: React 18 + TypeScript Frontend, gebündelt mit Vite.
- **server/**: Express-basiertes Backend mit Dateispeicher und Session-Handling.
- **shared/**: Gemeinsame TypeScript-Typen und Validierungsschemata.

## Ablauf
1. Anfragen erreichen das `server/`-Modul und prüfen Regeln aus `data/`.
2. Validierte Daten werden an das `client/`-Frontend ausgeliefert.
3. `shared/` stellt Typdefinitionen und Zod-Schemas für beide Seiten bereit.

Die Architektur ermöglicht die Verarbeitung von über 100.000 Regeln und Log-Einträgen mit Fokus auf Performance und Nachvollziehbarkeit.

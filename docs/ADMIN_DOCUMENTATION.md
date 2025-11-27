# SmartRedirect Suite - Admin-Dokumentation

Diese Dokumentation richtet sich an Administratoren und DevOps-Teams. Sie bündelt Ressourcen für Installation, Deployment und den laufenden Betrieb.

Der Admin-Bereich ist über das Zahnrad-Symbol der Anwendung oder durch Anhängen von `?admin=true` an die Basis-URL erreichbar.

## Installations- und Deployment-Ressourcen
- [INSTALLATION.md](./INSTALLATION.md): Schnellstart für lokale Entwicklung.
- [ENTERPRISE_DEPLOYMENT.md](./ENTERPRISE_DEPLOYMENT.md): Leitfaden für Produktionsumgebungen.
- [OPENSHIFT_DEPLOYMENT.md](./OPENSHIFT_DEPLOYMENT.md): Beispielkonfiguration für OpenShift.
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md): REST-API für Automatisierung und Monitoring.
- `Dockerfile.demo`: Demo-Container mit automatischem 24h-Reset für Tests.

## Wartung
- Regelmäßige Backups der `data/`-Verzeichnisse.
- Abgelaufene Sessions unter `data/sessions/` bereinigen.
- Logs und Performance-Metriken gemäß Deployment-Guides überwachen.
- **Cache neu aufbauen**: Im Admin-Bereich unter "Import/Export" > "Wartung" kann der Regel-Cache manuell neu aufgebaut werden. Dies ist normalerweise nicht erforderlich, kann aber helfen, wenn nach umfangreichen Importen oder Updates Probleme mit Weiterleitungen auftreten.

## Login-Schutz
- Fehlgeschlagene Anmeldungen werden IP-basiert gezählt.
- Nach `LOGIN_MAX_ATTEMPTS` Fehlversuchen (Standard: 5) wird die IP für `LOGIN_BLOCK_DURATION_MS` Millisekunden (Standard: 24h) gesperrt.
- Werte können über Umgebungsvariablen in der `.env` angepasst werden.

## Regelpriorisierung & Debugging
- Gewichtungen und Normalisierung befinden sich in `shared/constants.ts` (`RULE_MATCHING_CONFIG`).
- Aktivieren Sie `DEBUG` in dieser Konfiguration, um pro Anfrage Score, angewandte Tie‑Breaker und die gewählte Regel zu protokollieren.
- Die Groß-/Kleinschreibung der Link-Erkennung lässt sich im Admin-Tab „Einstellungen → Link-Erkennung“ über den Schalter "Groß-/Kleinschreibung beachten" steuern (Standard: aus).

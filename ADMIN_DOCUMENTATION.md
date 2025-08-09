# SmartRedirect Suite - Admin-Dokumentation

Diese Dokumentation richtet sich an Administratoren und DevOps-Teams. Sie bündelt Ressourcen für Installation, Deployment und den laufenden Betrieb.

## Installations- und Deployment-Ressourcen
- [INSTALLATION.md](./INSTALLATION.md): Schnellstart für lokale Entwicklung.
- [ENTERPRISE_DEPLOYMENT.md](./ENTERPRISE_DEPLOYMENT.md): Leitfaden für Produktionsumgebungen.
- [OPENSHIFT_DEPLOYMENT.md](./OPENSHIFT_DEPLOYMENT.md): Beispielkonfiguration für OpenShift.
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md): REST-API für Automatisierung und Monitoring.

## Wartung
- Regelmäßige Backups der `data/`-Verzeichnisse.
- Abgelaufene Sessions unter `data/sessions/` bereinigen.
- Logs und Performance-Metriken gemäß Deployment-Guides überwachen.

## Regelpriorisierung & Debugging
- Gewichtungen und Normalisierung befinden sich in `shared/constants.ts` (`RULE_MATCHING_CONFIG`).
- Aktivieren Sie `DEBUG` in dieser Konfiguration, um pro Anfrage Score, angewandte Tie‑Breaker und die gewählte Regel zu protokollieren.

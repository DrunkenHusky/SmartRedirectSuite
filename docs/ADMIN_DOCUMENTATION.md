# SmartRedirect Suite - Admin-Dokumentation

Diese Dokumentation richtet sich an Administratoren und DevOps-Teams. Sie bündelt Ressourcen für Installation, Deployment und den laufenden Betrieb.

Der Admin-Bereich ist über das Zahnrad-Symbol der Anwendung oder durch Anhängen von `?admin=true` an die Basis-URL erreichbar.

## Fallback Strategie (Smart Search Redirect)
Die Anwendung unterstützt zwei Strategien für den Umgang mit URLs, für die **keine spezifische Regel** gefunden wurde:

1.  **Standard Domain-Ersatz (Mode A)**:
    - Das Legacy-Verhalten. Es wird lediglich die Domain ausgetauscht (z.B. `old.com` -> `new.com`), der Rest des Pfades bleibt erhalten.
    - Konfigurierbar über "Standard neue Domain".

2.  **Smart Search Redirect (Mode B)**:
    - Diese neue Strategie extrahiert das **letzte Pfadsegment** der angeforderten URL und nutzt es als Suchbegriff auf der neuen Plattform.
    - Beispiel: `old.com/products/shoes/red-sneakers` -> Suche nach `red-sneakers` auf der Zielseite.
    - Konfigurierbar unter "Allgemeine Einstellungen" > "Fallback Strategie".
    - Benötigt eine **Such-Basis-URL** (z.B. `https://shop.com/search?q=`).

### Priorisierung
1.  **Exakte Regel**: Eine definierte Regel passt genau auf den Pfad.
2.  **Partielle Regel**: Eine Regel passt auf einen Teil des Pfades (Prefix).
3.  **Fallback Strategie**: Wenn keine Regel passt, greift die konfigurierte Fallback-Strategie (A oder B).

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
- **Cache neu aufbauen**: Im Admin-Bereich unter "System & Daten" > "Wartung" kann der Regel-Cache manuell neu aufgebaut werden. Dies ist normalerweise nicht erforderlich, kann aber helfen, wenn nach umfangreichen Importen oder Updates Probleme mit Weiterleitungen auftreten.

## Login-Schutz
- Fehlgeschlagene Anmeldungen werden IP-basiert gezählt.
- Nach `LOGIN_MAX_ATTEMPTS` Fehlversuchen (Standard: 5) wird die IP für `LOGIN_BLOCK_DURATION_MS` Millisekunden (Standard: 24h) gesperrt.
- Werte können über Umgebungsvariablen in der `.env` angepasst werden.

## Regelpriorisierung & Debugging
- Gewichtungen und Normalisierung befinden sich in `shared/constants.ts` (`RULE_MATCHING_CONFIG`).
- Aktivieren Sie `DEBUG` in dieser Konfiguration, um pro Anfrage Score, angewandte Tie‑Breaker und die gewählte Regel zu protokollieren.
- Die Groß-/Kleinschreibung der Link-Erkennung lässt sich im Admin-Tab „Einstellungen → Link-Erkennung“ über den Schalter "Groß-/Kleinschreibung beachten" steuern (Standard: aus).

## Domain-Regeln
Neben den klassischen Pfad-Regeln werden auch Domain-Regeln unterstützt.

### Matcher
Der Matcher kann nun entweder ein Pfad (beginnend mit `/`) oder eine Domain sein (z.B. `www.google.ch`).
- **Pfad-Matcher**: `/news` matcht auf `http://anydomain.com/news`.
- **Domain-Matcher**: `www.google.ch` matcht auf `http://www.google.ch/any/path`.

### Redirect Typ: Domain-Ersatz
Der Typ "Domain-Ersatz" (`domain`) ermöglicht flexible Weiterleitungen:
1. **Pfad-Erhalt**: Der ursprüngliche Pfad und alle Query-Parameter bleiben erhalten. Es wird lediglich die Domain ausgetauscht.
2. **Kombination mit Pfad-Matchern**: Wenn ein Pfad-Matcher (z.B. `/altes-verzeichnis`) verwendet wird, aber der Typ `domain` gewählt ist, wird der Matcher im Pfad ignoriert und der gesamte ursprüngliche Pfad an die neue Domain angehängt (analog zu einer Wildcard-Domain-Weiterleitung für diesen speziellen Pfad).
3. **Domain-Matcher**: Wenn der Matcher eine Domain ist (z.B. `old-site.com`), werden alle Anfragen an diese Domain auf die `Target URL` umgeleitet, wobei der Pfad erhalten bleibt.

Dies ermöglicht komplexe Migrationsszenarien, bei denen ganze Domains oder Subdomains umgezogen werden, ohne für jeden Pfad eine eigene Regel erstellen zu müssen.

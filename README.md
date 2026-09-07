# SmartRedirect Suite

Self-hosted Webanwendung zur Planung, Prüfung und Auswertung von URL-Migrationen. Regeln, Einstellungen, Tracking-Daten und Sitzungen werden in PostgreSQL gespeichert. Die Anwendung kann als Container auf einem Docker-Host oder mit mehreren Replikaten in Kubernetes betrieben werden.

## Funktionen

- Wildcard-, Teilpfad- und Domain-Regeln mit Priorisierung
- Vorschau, Import und Export (JSON, CSV und XLSX)
- Weitergabe, Filterung und Transformation von Query-Parametern
- Admin-Oberfläche, Tracking, Feedback und Statistiken
- Passwort-Anmeldung und optional generisches OAuth 2.0/OpenID Connect
- Health-Endpunkt, Security Header, CSRF-Prüfung, Rate Limits und Brute-Force-Schutz

Weitere Bedienhinweise stehen im [Benutzerhandbuch](docs/USER_MANUAL.md), die API in der [API-Dokumentation](docs/API_DOCUMENTATION.md) und Komponenten im [Architekturüberblick](docs/ARCHITECTURE_OVERVIEW.md).

## Voraussetzungen

Für Docker: Docker Engine 24+ mit Compose v2. Für lokale Entwicklung: Node.js 20+, npm und PostgreSQL 15+. Für Kubernetes: ein Cluster ab Version 1.27, `kubectl`, eine externe PostgreSQL-Instanz sowie eine Registry für das Image.

## Schnellstart mit Docker Compose

1. Repository klonen und Arbeitsverzeichnis öffnen.
   ```bash
   git clone https://github.com/DrunkenHusky/SmartRedirectSuite.git
   cd SmartRedirectSuite
   ```
2. Beispielkonfiguration kopieren.
   ```bash
   cp .env.example .env
   ```
3. Sichere Werte erzeugen und in `.env` eintragen. `SESSION_SECRET` darf nach dem Start nicht spontan geändert werden, andernfalls werden alle Sitzungen ungültig.
   ```bash
   openssl rand -base64 48
   openssl rand -base64 24
   ```
   Setze außerdem `POSTGRES_PASSWORD` und verwende denselben Wert im Passwortteil von `DATABASE_URL`.
4. Container bauen und starten.
   ```bash
   docker compose up --build -d
   docker compose ps
   curl --fail http://localhost:5000/api/health
   ```
5. `http://localhost:5000` öffnen. Der Admin-Bereich ist unter `/admin` verfügbar.
6. Logs ansehen oder die Installation stoppen.
   ```bash
   docker compose logs -f application
   docker compose down
   ```
   `docker compose down` erhält die Daten. Nur `docker compose down -v` löscht auch das Datenbank-Volume.

Beim ersten Start legt die Anwendung ihre Tabellen idempotent an. Für Produktion sollte PostgreSQL unabhängig gesichert und nicht aus dem Beispiel-Compose öffentlich freigegeben werden.

## Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|---|---:|---|
| `DATABASE_URL` | ja | PostgreSQL-URL im Format `postgresql://user:password@host:5432/database` |
| `DATABASE_SSL` | nein | `true` aktiviert TLS mit Zertifikatsprüfung; Standard `false` |
| `SESSION_SECRET` | ja | Zufälliges Geheimnis mit mindestens 32 Zeichen |
| `ADMIN_PASSWORD` | bedingt | Mindestens 12 Zeichen; optional, wenn OAuth vollständig eingerichtet ist |
| `PORT` | nein | HTTP-Port, Standard `5000` |
| `NODE_ENV` | nein | `development`, `test` oder `production` |
| `COOKIE_SECURE` | nein | Sichere Cookies erzwingen; hinter HTTPS in Produktion `true` |
| `COOKIE_DOMAIN` | nein | Gemeinsame Cookie-Domain, normalerweise nicht setzen |
| `TRUST_PROXY` | nein | Zahl vertrauenswürdiger Reverse-Proxies, Standard `1` |
| `ALLOWED_ORIGINS` | nein | Kommaseparierte erlaubte Origins |
| `OAUTH_ISSUER_URL` | bedingt | Issuer-Basis-URL des externen IdP |
| `OAUTH_CLIENT_ID` / `OAUTH_CLIENT_SECRET` | bedingt | Client-Zugangsdaten des IdP |
| `OAUTH_REDIRECT_URI` | bedingt | Exakt registrierter Callback, z. B. `https://redirect.example/api/admin/oauth/callback` |
| `OAUTH_SCOPES` | nein | Standard `openid profile email` |
| `OAUTH_ADMIN_GROUP` | nein | Falls gesetzt, muss diese Gruppe im UserInfo-Claim vorhanden sein |
| `OAUTH_GROUPS_CLAIM` | nein | Name des Gruppen-Claims, Standard `groups` |

Alle vier OAuth-Pflichtwerte müssen gemeinsam gesetzt werden. Die Anwendung bricht bei fehlender oder ungültiger Konfiguration sofort mit einer verständlichen Fehlermeldung ab. Der IdP muss Discovery unter `/.well-known/openid-configuration`, Authorization Code Flow und einen UserInfo-Endpunkt unterstützen. Registriere genau die externe HTTPS-Callback-URL. Der Login beginnt über `/api/admin/oauth/login`.

## Kubernetes

PostgreSQL wird absichtlich nicht im Anwendungsmanifest bereitgestellt: Nutze einen verwalteten Dienst oder einen PostgreSQL-Operator mit Backups und Hochverfügbarkeit.

1. Image bauen und in die eigene Registry übertragen.
   ```bash
   docker build -t registry.example.com/team/smartredirectsuite:2.22.0 .
   docker push registry.example.com/team/smartredirectsuite:2.22.0
   ```
2. `deploy/kubernetes.yaml` kopieren. Image, Secret-Werte und `DATABASE_URL` ändern. Geheimnisse im Produktivbetrieb über External Secrets, Sealed Secrets oder den Secret Store des Cloud-Anbieters verwalten, nicht im Git-Repository.
3. Ressourcen anwenden und Rollout prüfen.
   ```bash
   kubectl apply -f deploy/kubernetes.yaml
   kubectl rollout status deployment/smartredirect
   kubectl get pods,service -l app=smartredirect
   kubectl port-forward service/smartredirect 5000:80
   curl --fail http://localhost:5000/api/health
   ```
4. Einen Ingress oder Gateway mit TLS vor dem Service konfigurieren. Danach `COOKIE_SECURE=true`, `OAUTH_REDIRECT_URI` und gegebenenfalls `TRUST_PROXY` anpassen.

Das Deployment nutzt zwei zustandslose Replikate. Gemeinsame PostgreSQL-Sitzungen erlauben Rolling Updates. Read-only Root-Filesystem, Non-root-Ausführung, Ressourcenlimits sowie Liveness/Readiness-Probes sind vorkonfiguriert. Logo-Uploads in das lokale Dateisystem sind für mehrere Replikate nicht dauerhaft; hierfür sollte künftig ein gemeinsam erreichbarer Objektspeicher verwendet werden.

## Lokale Entwicklung

```bash
cp .env.example .env
# DATABASE_URL auf die lokale PostgreSQL-Instanz ändern
npm ci
npm run dev
```

Qualitätsprüfungen:

```bash
npm run check
npm test
npm audit --audit-level=high
npm run build
```

Das Coverage-Ziel für neue bzw. geänderte Logik beträgt mindestens 85 %. Tests müssen Erfolg, Grenzwerte und Fehlerpfade abdecken. Commits folgen Conventional Commits; Releases und `CHANGELOG.md` werden durch semantic-release erzeugt.

## Betrieb und Sicherheit

- TLS am Ingress/Reverse-Proxy terminieren, Datenbank-TLS aktivieren und Secrets regelmäßig rotieren.
- Datenbank täglich sichern und Wiederherstellung regelmäßig testen (`pg_dump`/`pg_restore` oder Provider-Snapshots).
- `/api/health` für Probes verwenden und Anwendungs-/Ingress-Logs zentral sammeln.
- Container-Images und npm-Abhängigkeiten in CI scannen; kritische oder hohe Findings vor Release beheben.
- Niemals `.env`, Datenbank-Dumps oder OAuth-Client-Secrets committen.
- Vor einem Update Datenbank sichern, ein unveränderliches Image-Tag deployen, Health-Probes beobachten und bei Fehlern zum vorherigen Tag zurückrollen.

## Datenmigration von älteren Installationen

Ältere JSON-Dateien werden nicht automatisch importiert. Exportiere Regeln und Einstellungen über die bisherige Admin-Oberfläche, starte diese Version mit PostgreSQL und importiere sie wieder. Tracking-Historie sollte separat archiviert werden. Bewahre das alte Datenverzeichnis bis zur fachlichen Prüfung schreibgeschützt auf.

## Lizenz und Beiträge

Das Projekt steht unter der MIT-Lizenz. Änderungen benötigen Tests, aktualisierte nutzerrelevante Dokumentation und einen Conventional Commit.

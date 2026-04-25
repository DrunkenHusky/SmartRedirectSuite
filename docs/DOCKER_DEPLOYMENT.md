# Docker Deployment Guide - SmartRedirect Suite

Diese Anleitung erklärt, wie die SmartRedirect Suite mittels Docker bereitgestellt wird. Sie deckt das Beziehen des Images, das Bauen aus dem Quellcode, die Konfiguration, Datenpersistenz und die Verwendung von Docker Compose für Produktionsumgebungen ab.

## 🚀 Schnellstart (Image beziehen)

Das Docker Image kann direkt aus der GitHub Container Registry bezogen werden. Um die aktuellste Version zu erhalten:

```bash
docker pull ghcr.io/drunkenhusky/smartredirectsuite:latest
```

Starten Sie einen Container (Demo-Modus):

```bash
docker run -d \
  -p 5000:5000 \
  -e ADMIN_PASSWORD="ChangeMe123!" \
  -v $(pwd)/data:/app/data \
  --name smartredirect \
  ghcr.io/drunkenhusky/smartredirectsuite:latest
```

Die Anwendung ist anschließend unter `http://localhost:5000` erreichbar.

## 🏗️ Image bauen (Aus Quellcode)

Wenn Sie das Image selbst bauen möchten, müssen Sie zuerst das Repository klonen:

```bash
# Repository klonen
git clone https://github.com/drunkenhusky/smartredirectsuite.git
cd smartredirectsuite

# Docker Image bauen
docker build -t smartredirect-suite .
```

Anschließend können Sie das selbst gebaute Image starten:

```bash
docker run -d -p 5000:5000 smartredirect-suite
```

## ⚙️ Konfiguration

Die Anwendung wird über Umgebungsvariablen konfiguriert.

| Variable | Beschreibung | Standard | Erforderlich |
|----------|-------------|---------|----------|
| `PORT` | Der Port, auf dem die App im Container lauscht. | `5000` | Nein |
| `NODE_ENV` | Umgebungsmodus (`production` oder `development`). | `production` | Nein |
| `ADMIN_PASSWORD` | Passwort für das Admin-Panel. **Dringend empfohlen.** | `Password1` | **Ja (Prod)** |
| `SESSION_SECRET` | Schlüssel für Session-Cookies. Wenn nicht gesetzt, wird bei jedem Start ein zufälliger Schlüssel generiert (Sessions laufen ab). | (Zufällig) | Nein |
| `LOGIN_MAX_ATTEMPTS` | Max. Login-Versuche vor temporärer Sperre. | `5` | Nein |
| `LOGIN_BLOCK_DURATION_MS` | Sperrdauer in ms nach Fehlversuchen. | `86400000` (24h) | Nein |
| `IMPORT_PREVIEW_LIMIT` | Maximale Anzahl an Regeln für Import-Vorschau. | `1000` | Nein |


### Externe Datenbank konfigurieren

SmartRedirect Suite verwendet standardmäßig eine SQLite-Datenbank (`database.sqlite`), die im `/app/data` Volume abgelegt wird. Wenn Sie eine externe Datenbank wie MariaDB/MySQL oder PostgreSQL verwenden möchten, können Sie die entsprechenden Umgebungsvariablen setzen:

| Variable | Beschreibung | Standard |
|----------|-------------|---------|
| `DB_DIALECT` | Datenbanktyp: `sqlite`, `postgres`, `mysql` oder `mariadb` | `sqlite` |
| `DB_HOST` | Hostname der Datenbank. | `localhost` |
| `DB_PORT` | Port der Datenbank (z.B. 5432 für Postgres, 3306 für MariaDB). | `5432` / `3306` |
| `DB_NAME` | Name der Datenbank. | `smartredirect` |
| `DB_USER` | Benutzername für die Datenbank. | `root` |
| `DB_PASSWORD` | Passwort für die Datenbank. | |

Es stehen `docker-compose.mariadb.yml` und `docker-compose.postgresql.yml` im Repository als Vorlagen zur Verfügung.

## 💾 Datenpersistenz

Die SmartRedirect Suite nutzt dateibasierten Speicher für Regeln, Einstellungen und Sessions. Um Datenverlust beim Neustart des Containers zu vermeiden, **müssen** Volumes eingebunden werden.

| Pfad im Container | Beschreibung |
|-------------------|-------------|
| `/app/data` | Speichert `rules.json`, `settings.json` und Admin-Sessions. |

**Hinweis zu Berechtigungen:**
Stellen Sie sicher, dass die eingebundenen Verzeichnisse auf dem Host beschreibbar sind. Da das Dockerfile standardmäßig als `root` läuft, funktionieren Standardberechtigungen in der Regel problemlos.

## 🐳 Docker Compose (Empfohlen)

Für Produktionsumgebungen ist `docker-compose` die einfachste Art der Verwaltung.

Erstellen Sie eine `docker-compose.yml`:

```yaml
services:
  smartredirect:
    image: ghcr.io/drunkenhusky/smartredirectsuite:latest
    # Alternativ lokal bauen:
    # build: .
    container_name: smartredirect-suite
    restart: always
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - PORT=5000
      - ADMIN_PASSWORD=${ADMIN_PASSWORD:-SicheresPasswort123}
      - LOGIN_MAX_ATTEMPTS=5
      - LOGIN_BLOCK_DURATION_MS=3600000 # 1 Stunde
    volumes:
      - ./data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

Dienst starten:

```bash
docker-compose up -d
```

Logs einsehen:

```bash
docker-compose logs -f
```

## 🔒 Best Practices für die Produktion

1.  **Standard-Zugangsdaten ändern:** Setzen Sie immer ein starkes `ADMIN_PASSWORD`.
2.  **Session Secret:** Setzen Sie ein festes `SESSION_SECRET`, wenn Admin-Sitzungen auch nach einem Container-Neustart gültig bleiben sollen. Ohne diese Variable wird bei jedem Start ein neuer Sicherheitsschlüssel generiert, was alle bestehenden Logins ungültig macht.
3.  **Reverse Proxy verwenden:** Exponieren Sie Port 5000 nicht direkt ins Internet. Nutzen Sie Nginx, Traefik oder Caddy für SSL-Terminierung (HTTPS) und leiten Sie Anfragen an den Container weiter.
    *   Setzen Sie den `X-Forwarded-Proto` Header im Proxy, damit die App HTTPS erkennt.
3.  **Backups:** Sichern Sie regelmäßig das `./data` Verzeichnis auf dem Host-System.
4.  **Ressourcen-Limits:** Sie können CPU und RAM in der `docker-compose.yml` begrenzen:
    ```yaml
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
    ```

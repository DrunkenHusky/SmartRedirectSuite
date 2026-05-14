# Docker Deployment Guide - SmartRedirect Suite

This guide explains how to deploy the SmartRedirect Suite using Docker. It covers obtaining the image, building from source, configuration, data persistence, and using Docker Compose for production environments.

## 🚀 Quick start (get image)

The Docker image can be obtained directly from the GitHub Container Registry. To get the latest version:

```bash
docker pull ghcr.io/drunkenhusky/smartredirectsuite:latest
```

Start a container (demo mode):

```bash
docker run -d \
  -p 5000:5000 \
  -e ADMIN_PASSWORD="ChangeMe123!" \
  -v $(pwd)/data:/app/data \
  --name smartredirect \
  ghcr.io/drunkenhusky/smartredirectsuite:latest
```

The application can then be accessed at `http://localhost:5000`.

## 🏗️ Build Image (From Source Code)

If you want to build the image yourself, you must first clone the repository:

```bash
# Repository klonen
git clone https://github.com/drunkenhusky/smartredirectsuite.git
cd smartredirectsuite

# Docker Image bauen
docker build -t smartredirect-suite .
```

You can then start the self-built image:

```bash
docker run -d -p 5000:5000 smartredirect-suite
```

## ⚙️ Configuration

The application is configured via environment variables.

| Variable | Description | Standard | Necessary |
|----------|-------------|---------|----------|
| `PORT` | The port on which the app listens in the container. | `5000` | No |
| `NODE_ENV` | Environment mode (`production` or `development`). | `production` | No |
| `ADMIN_PASSWORD` | Admin panel password. **Strongly recommended.** | `Password1` | **Me (Prod)** |
| `SESSION_SECRET` | Key for session cookies. If not set, a random key will be generated at every start (sessions expire). | (Randomly) | No |
| `LOGIN_MAX_ATTEMPTS` | Max login attempts before temporary ban. | `5` | No |
| `LOGIN_BLOCK_DURATION_MS` | Blocking duration in ms after failed attempts. | `86400000` (24h) | No |
| `IMPORT_PREVIEW_LIMIT` | Maximum number of import preview rules. | `1000` | No |


### Configure external database

By default, SmartRedirect Suite uses an SQLite database (`database.sqlite`) located in the `/app/data` volume. If you want to use an external database such as MariaDB/MySQL or PostgreSQL, you can set the appropriate environment variables:

| Variable | Description | Standard |
|----------|-------------|---------|
| `DB_DIALECT` | Database type: `sqlite`, `postgres`/`postgresql`, `mysql` or `mariadb` | `sqlite` |
| `DB_HOST` | Database hostname. | `localhost` |
| `DB_PORT` | Port of the database (e.g. 5432 for Postgres, 3306 for MariaDB). | `5432` / `3306` |
| `DB_NAME` | Name of the database. | `smartredirect` |
| `DB_USER` | Username for the database. | `root` |
| `DB_PASSWORD` | Password for the database. | |
| `DB_STORAGE` | SQLite file path when `DB_DIALECT=sqlite` is set. | `/app/data/database.sqlite` |
| `DB_SSL` | Enables TLS for PostgreSQL/MariaDB/MySQL connections (`true`/`false`). | `false` |
| `DB_POOL_MAX` | Maximum number of concurrent DB connections in the Sequelize pool. | `5` |
| `DB_POOL_MIN` | Minimum number of open DB connections in the Sequelize pool. | `0` |

There are `docker-compose.mariadb.yml` and `docker-compose.postgresql.yml` available as templates in the repository.

## 💾 Data persistence

The SmartRedirect Suite uses SQLite by default for rules, settings, tracking, translations, and admin sessions. To avoid data loss when restarting the container, volumes **must** be mounted.

| Path in the container | Description |
|-------------------|-------------|
| `/app/data` | Stores `database.sqlite`, migrated JSON backups (`*.bak`) and uploads. Active admin sessions are stored in the database but cleared on every server start. |

**Note about permissions:**
Make sure the mounted directories on the host are writable. Since the Dockerfile runs as `root` by default, standard permissions usually work without any problems.

## 🐳 Docker Compose (Recommended)

For production environments, `docker-compose` is the easiest way to manage.

Create a `docker-compose.yml`:

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

Start service:

```bash
docker-compose up -d
```

View logs:

```bash
docker-compose logs -f
```

## 🔒 Production best practices

1. **Change default credentials:** Always set a strong `ADMIN_PASSWORD`.
2. **Session Secret:** Set a fixed `SESSION_SECRET` so session cookies remain stably signed during runtime. Admin sessions are deliberately cleared at server startup; without this variable, cookie signatures also change at every start.
3. **Use Reverse Proxy:** Do not expose port 5000 directly to the Internet. Use Nginx, Traefik or Caddy for SSL termination (HTTPS) and forward requests to the container.
    *   Set the `X-Forwarded-Proto` header in the proxy to make the app recognize HTTPS.
3. **Backups:** Regularly back up the `./data` directory on the host system.
4. **Resource Limits:** You can limit CPU and RAM in `docker-compose.yml`:
    ```yaml
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
    ```

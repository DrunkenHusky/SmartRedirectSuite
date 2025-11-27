# Docker Deployment Guide - SmartRedirect Suite

This guide explains how to deploy the SmartRedirect Suite using Docker. It covers building the image, configuration, data persistence, and using Docker Compose for production setups.

## 🚀 Quick Start

If you have a pre-built image or want to run the demo locally:

```bash
docker run -d \
  -p 5000:5000 \
  -e ADMIN_PASSWORD="ChangeMe123!" \
  -v $(pwd)/data:/app/data \
  --name smartredirect \
  ghcr.io/your-username/smartredirect-suite:latest
```

The application will be available at `http://localhost:5000`.

## 🏗️ Building the Image

To build the Docker image locally from the source code:

```bash
docker build -t smartredirect-suite .
```

To run the newly built image:

```bash
docker run -d -p 5000:5000 smartredirect-suite
```

## ⚙️ Configuration

The application is configured via environment variables.

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | The port the application listens on inside the container. | `5000` | No |
| `NODE_ENV` | Environment mode (`production` or `development`). | `production` | No |
| `ADMIN_PASSWORD` | Password for the Admin Panel. **Strongly recommended to set this.** | `Password1` | **Yes (Prod)** |
| `SESSION_SECRET` | Secret key for session signing. Must be random and long. | (Random string) | **Yes (Prod)** |
| `LOGIN_MAX_ATTEMPTS` | Max login attempts before temporary block. | `5` | No |
| `LOGIN_BLOCK_DURATION_MS` | Duration of block in ms after max attempts. | `86400000` (24h) | No |
| `LOCAL_UPLOAD_PATH` | Path for uploaded files (e.g., logos). | `./uploads` | No |
| `COOKIE_DOMAIN` | Domain for session cookies (useful for subdomains). | `undefined` | No |

## 💾 Data Persistence

The SmartRedirect Suite uses file-based storage for rules, settings, and sessions. To prevent data loss when the container is recreated, you **must** mount volumes.

| Path in Container | Description |
|-------------------|-------------|
| `/app/data` | Stores `rules.json`, `settings.json`, and admin sessions. |
| `/app/uploads` | Stores uploaded files (if `LOCAL_UPLOAD_PATH` is set to this or similar). |

**Note on Permissions:**
Ensure the mounted host directories are writable by the user running the process inside the container (default is often root or a specific node user depending on image configuration). The current Dockerfile runs as root by default, so standard permissions usually work.

## 🐳 Docker Compose (Recommended)

For production deployments, `docker-compose` is the easiest way to manage the configuration.

Create a `docker-compose.yml` file:

```yaml
services:
  smartredirect:
    image: smartredirect-suite:latest
    # Or build from source:
    # build: .
    container_name: smartredirect-suite
    restart: always
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - PORT=5000
      - ADMIN_PASSWORD=${ADMIN_PASSWORD:-SecurePassword123}
      - SESSION_SECRET=${SESSION_SECRET:-long-random-string-at-least-32-chars}
      - LOGIN_MAX_ATTEMPTS=5
      - LOGIN_BLOCK_DURATION_MS=3600000 # 1 hour
    volumes:
      - ./data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

```

Start the service:

```bash
docker-compose up -d
```

View logs:

```bash
docker-compose logs -f
```

## 🔒 Production Best Practices

1.  **Change Default Credentials:** Always set a strong `ADMIN_PASSWORD` and a unique `SESSION_SECRET`.
2.  **Use a Reverse Proxy:** In a real production environment, do not expose port 5000 directly to the internet. Use Nginx, Traefik, or Caddy to handle SSL termination (HTTPS) and proxy requests to the container.
    *   Set `X-Forwarded-Proto` header in your proxy so the app knows it's running behind HTTPS.
3.  **Backups:** regularly backup the `./data` directory on the host machine.
4.  **Resource Limits:** You can limit memory and CPU in `docker-compose.yml`:
    ```yaml
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
    ```

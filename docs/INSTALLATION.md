# 🚀 Quick Start Guide - SmartRedirect Suite

> **Note**: This quick start guide provides a simplified installation. For detailed information, see [README.md](../README.md). For enterprise deployments, see [ENTERPRISE_DEPLOYMENT.md](./ENTERPRISE_DEPLOYMENT.md).

## 📚 Related documentation
- **[README.md](../README.md)**: Complete documentation with all features
- **[DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md)**: Docker Deployment Guide
- **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)**: REST API reference for developers
- **[ENTERPRISE_DEPLOYMENT.md](./ENTERPRISE_DEPLOYMENT.md)**: Production-Deployment-Anleitung
- **Dockerfile.demo**: Docker setup for demo instances with daily data reset

## 1. Check requirements

```bash
# Check Node.js version (required: v22+)
node --version

# Check npm version (required: v10.9+)
npm --version
```

## 2. Installation

```bash
# Install dependencies
npm install

# Check installed dependencies for known vulnerabilities
npm audit --audit-level=low

# Optionale Umgebungsvariablen konfigurieren
cp .env.example .env
# Bearbeiten Sie .env mit Ihren Werten
```

## 3. Start application

```bash
# Entwicklungsmodus (mit Hot-Reload)
npm run dev

# Produktionsmodus
npm run build
npm start
```

## 4. Access

- **Main Application**: http://localhost:5000
- **Admin Panel**: http://localhost:5000 → Click the gear icon or append `?admin=true` to the URL
- **Default Admin Password**: `Password1` (change this in the .env file!)
- **Brute force protection**: After `LOGIN_MAX_ATTEMPTS` failed attempts, the IP is blocked for `LOGIN_BLOCK_DURATION_MS` ms (default: 5 attempts/24h, customizable in `.env`)

## 5. Getting started

1. **Log in as admin** with standard password
   - Automatic session persistence: Stay logged in after refresh
2. **Create new URL rule**:
   - URL matcher: `/old-page/`
   - Target URL: `/new-page/`
   - Typ: `redirect`
   - **Note**: Smart validation prevents real URL conflicts
3. **Customize settings**: Texts and colors as required
4. **Tab navigation**: Selected admin tabs are retained after updating
5. **Test**: Visit http://localhost:5000/alte-seite/

## 6. Problem solving

**Port already occupied?**
```bash
# Anderen Port verwenden
PORT=3000 npm run dev
```

**Forgot your admin password?**
```bash
# In .env-Datei ändern oder Standard verwenden
echo "ADMIN_PASSWORD=Password1" >> .env
```

**Reset data?**
```bash
# Lösche alle gespeicherten Daten
rm -rf data/
# Anwendung neu starten
npm run dev
```

## 7. Advanced features

### Multi-select functions (desktop)
- **Bulk Operations**: Edit multiple rules at the same time
- **Checkboxes**: Single selection or "Select all"
- **Mobile Notice**: Automatic notification for mobile users

### Automatic redirection
- **Global**: Automatically forward all URLs
- **Rule-specific**: Configurable per rule
- **Admin access**: `?admin=true` parameter when auto-forwarding is active

## 8. Next steps

- **[README.md](./README.md)**: Read detailed feature documentation
- **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)**: API-Integration planen
- **[ENTERPRISE_DEPLOYMENT.md](./ENTERPRISE_DEPLOYMENT.md)**: Prepare production deployment
- Configure your own URL rules and test multi-select
- Adapt settings to corporate design
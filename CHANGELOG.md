# Changelog

Alle wichtigen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/),
und dieses Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]
### Added
- Spezifitätsbasiertes Regel-Matching mit `selectMostSpecificRule` und konfigurierbarer Gewichtung.
- `Dockerfile.demo` mit täglichem Cron-Reset für Demo-Instanzen.

## [1.0.0] - 2025-08-08

### 🎉 Erste vollständige Version

Diese Version stellt die erste produktionsreife Version der SmartRedirect Suite dar. Alle Kernfunktionen sind implementiert und getestet.

### ✨ Hauptfunktionen

#### URL-Migration & Routing
- **Automatische URL-Erkennung** via `window.location` mit intelligenter Transformation
- **Regel-basierte URL-Transformationen** mit Admin-definierten Mustern
- **Dynamische Domain-Ersetzung** (z.B. `olddomain.com` → `newdomain.com`) wenn keine spezifische Regel existiert
- **Protokoll-Normalisierung** auf HTTPS
- **Pfad- und Parameter-Erhaltung** bei URL-Transformationen
- **Robuste URL-Validierung** mit Edge-Case-Behandlung

#### Admin-Panel & Verwaltung
- **Passwort-geschütztes Admin-Panel** mit persistenten 7-Tage-Sessions
- **State-Erhaltung** für Tab-Auswahl und Statistik-Ansichten zwischen Sessions
- **CRUD-Operationen** für URL-Regeln mit intelligenter Validierung
- **Bulk-Operationen** (Multi-Select) für effiziente Regel-Verwaltung (Desktop)
- **Import/Export-Funktionalität** für URL-Regeln und Einstellungen
- **Intelligente Überlappungserkennung** verhindert echte Prefix-Überlappungen
- **Per-Regel Auto-Redirect** mit granularer Kontrolle

#### Statistiken & Tracking
- **Umfassendes URL-Tracking** mit Zugriffszählung und Zeitstempeln
- **Multi-View-Dashboard** (Übersicht, Top 100, Alle Einträge)
- **Export-Funktionalität** für Tracking-Daten
- **Performance-Metriken** mit Statistik-Zusammenfassungen

#### Benutzeroberfläche & Design
- **Deutsche Benutzeroberfläche** mit vollständig anpassbaren Texten
- **Mobile-First-Design** mit responsivem Layout
- **Shadcn/UI-Komponenten** basierend auf Radix UI mit Tailwind CSS
- **Anpassbare visuelle Elemente** (Farben, Icons, Hintergründe)
- **Markdown-Unterstützung** für Informationsmeldungen
- **Optimierte Farbwähler** und Inline-Hilfe

### 🛠️ Technische Architektur

#### Frontend
- **React 18 SPA** mit TypeScript und Vite
- **TanStack Query** für Server-State-Management und Caching
- **Wouter** für leichtgewichtiges Client-Side-Routing
- **React Hook Form** mit Zod-Validierung
- **Performance-Optimierungen** für große Datenmengen (100.000+ Regeln)

#### Backend
- **Express.js** RESTful API mit TypeScript
- **Datei-basierte Speicherung** mit lokalen JSON-Dateien
- **Session-Management** mit persistenter Datei-Speicherung
- **Umfassende Middleware** (Logging, Fehlerbehandlung, Sicherheit, Validierung)

#### Sicherheit & Performance
- **Rate Limiting** und CORS-Schutz
- **Input-Sanitization** und XSS-Schutz
- **Security Headers** und sichere Session-Konfiguration
- **Optimierte Datenbank-Queries** für Enterprise-Skalierung
- **Memory-Management** für große Regel-Sets

### 🚀 Deployment & DevOps

#### Multi-Platform-Deployment
- **OpenShift-Deployment** mit Enterprise-Konfiguration
- **Docker-Container** mit Production-optimiertem Dockerfile
- **Persistente Storage-Konfiguration** für alle Plattformen

#### Monitoring & Health Checks
- **Health-Endpoint** (`/api/health`) mit umfassenden System-Checks
- **Filesystem-, Sessions- und Storage-Validierung**
- **JSON-Response** mit Status, Uptime, Memory-Usage und Response-Times
- **OpenShift-kompatible** HEALTHCHECK-Konfiguration

#### Umgebungsvariablen-Support
- **NODE_ENV** - Umgebung (development/production)
- **PORT** - Server-Port (Standard: 5000)
- **SESSION_SECRET** - Session-Verschlüsselung
- **LOCAL_UPLOAD_PATH** - Upload-Verzeichnis (Standard: ./data/uploads)
- **COOKIE_DOMAIN** - Cookie-Domain für Production

### 📚 Dokumentation

#### Umfassende Deployment-Guides
- **README.md** - Schritt-für-Schritt-Installation und Konfiguration
- **INSTALLATION.md** - Detaillierte Installationsanweisungen
- **OPENSHIFT_DEPLOYMENT.md** - Enterprise OpenShift-Deployment
- **ENTERPRISE_DEPLOYMENT.md** - Enterprise-spezifische Konfigurationen
- **API_DOCUMENTATION.md** - Vollständige API-Referenz

#### Technische Spezifikationen
- **Container-Konfiguration** mit Persistent Volume Claims
- **Security Context Constraints** für OpenShift
- **Network Policies** und Service-Konfigurationen
- **Backup- und Recovery-Strategien**

### 🏗️ Architektur-Details

#### Datenmodelle
- **URL-Regeln** (pattern, targetUrl, isActive, autoRedirect, infoText)
- **Tracking-Daten** (oldUrl, newUrl, timestamp, userAgent, ip)
- **Admin-Sessions** (sessionId, expiry, loginTime)
- **Allgemeine Einstellungen** (UI-Texte, Farben, Domain-Konfiguration)

#### URL-Transformations-Logic
- **Automatische Erkennung** alter URLs
- **Regel-basiertes Matching** mit Prioritäts-Sortierung
- **Dynamic Domain Replacement** als Fallback
- **Custom Target URLs** mit Admin-Override
- **Parameter- und Fragment-Erhaltung**
- **Intelligent Overlap Detection** für ähnliche Pfade

### 🔧 Development Features
- **TypeScript** mit vollständiger Type Safety
- **Hot Reload** mit Vite Development Server
- **Separate Build-Prozesse** für Frontend (Vite) und Backend (esbuild)
- **ESLint** und **Prettier** für Code-Qualität
- **Monorepo-Struktur** mit geteilten Types und Utilities

---

## Geplante Versionen

### [1.1.0] - Geplant
- **In Planung** - Eröffne Feature Requests für gewünschte Funktionen im Git Repo

---

## Format-Legende

- 🎉 **Große Features** - Neue Hauptfunktionen
- ✨ **Features** - Neue Funktionen
- 🛠️ **Verbesserungen** - Bestehende Funktionen verbessert
- 🐛 **Bugfixes** - Fehler behoben
- 🚀 **Performance** - Leistungsverbesserungen
- 📚 **Dokumentation** - Dokumentation hinzugefügt/verbessert
- 🔧 **Development** - Entwicklungs-Tools und -Prozesse
- ⚠️ **Breaking Changes** - Nicht rückwärtskompatible Änderungen
- 🔒 **Sicherheit** - Sicherheits-bezogene Änderungen
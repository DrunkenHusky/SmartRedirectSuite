# URL Migration Application

**Version 1.0.0** - Eine deutsche Web-Anwendung zur Verwaltung von URL-Migrationen zwischen alter und neuer Domain mit erweiterten Admin-Funktionen und intelligenter Regel-Verwaltung.

## 📋 Überblick

Diese Anwendung hilft Benutzern beim Übergang von veralteten Web-App-Links zu neuen URLs. Sie bietet:

- **Automatische URL-Erkennung** mit intelligenten Transformationsregeln
- **Admin-Panel** mit persistenter Session-Authentifizierung und Tab-State-Erhaltung
- **Multi-Select-Funktionen** für effiziente Bulk-Operationen (Desktop)
- **Deutsche Benutzeroberfläche** mit vollständig anpassbaren Texten und visuellen Elementen
- **Import/Export-Funktionen** für URL-Regeln und Einstellungen
- **Intelligente Validierung** mit präziser URL-Überlappungserkennung
- **Umfassende Statistiken** und URL-Zugriffs-Tracking
- **Mobile-optimiert** mit responsivem Design und gerätespezifischen Funktionen

## 🚀 Komplette Installation - Schritt für Schritt

### Voraussetzungen prüfen

Stellen Sie sicher, dass Node.js installiert ist:
```bash
node --version
npm --version
```
**Erforderlich:** Node.js Version 18 oder höher

### Schritt 1: Repository herunterladen
```bash
# Repository klonen (ersetzen Sie <repository-url> mit der tatsächlichen URL)
git clone <repository-url>
cd url-migration-app
```

### Schritt 2: Dependencies installieren
```bash
npm install
```

### Schritt 3: Umgebungsdatei erstellen (.env)

Erstellen Sie eine `.env` Datei im Hauptverzeichnis mit folgendem Inhalt:

```bash
# .env Datei erstellen
cat > .env << 'EOF'
# Admin Panel Authentifizierung
ADMIN_PASSWORD=MeinSicheresPasswort123

# Session-Sicherheit (generieren Sie einen starken, zufälligen String)
SESSION_SECRET=super-geheimer-session-schluessel-hier-einfuegen-mindestens-32-zeichen

# Server-Konfiguration
PORT=5000
NODE_ENV=production

# Object Storage (wird automatisch bei Deployment gesetzt)
# PRIVATE_OBJECT_DIR=/your-bucket-name/.private
# PUBLIC_OBJECT_SEARCH_PATHS=/your-bucket-name/public
EOF
```

**Alternativ:** Kopieren Sie die Beispiel-Datei und bearbeiten Sie sie:
```bash
cp .env.example .env
nano .env  # oder verwenden Sie einen anderen Editor
```

### Schritt 4: Anwendung starten

```bash
# Entwicklungsserver starten (mit Hot-Reload)
npm run dev
```

**Die Anwendung läuft jetzt unter:** `http://localhost:5000`

### Schritt 5: Admin-Zugang testen

1. Öffnen Sie `http://localhost:5000/admin` im Browser
2. Loggen Sie sich mit dem in `.env` definierten Passwort ein
3. Standardmäßig: **Password1** (falls nicht geändert)

### Produktionsstart (optional)

Für Produktionsumgebung:
```bash
# Anwendung für Produktion bauen und starten
npm install && npm run build
npm run start
```

**Hinweis:** Die `.env` Datei wird automatisch geladen. Die Anwendung verwendet standardmäßig lokale Dateispeicherung im `data/uploads` Ordner für Logo-Uploads.

### Umgebungsvariablen Erklärung

| Variable | Beschreibung | Standard | Erforderlich |
|----------|-------------|----------|--------------|
| `ADMIN_PASSWORD` | Admin-Panel Passwort | `Password1` | Empfohlen |
| `SESSION_SECRET` | Verschlüsselungsschlüssel für Sessions | Auto-generiert | Empfohlen |
| `LOCAL_UPLOAD_PATH` | Pfad für Datei-Uploads | `./data/uploads` | Optional |
| `PORT` | Server-Port | `5000` | Optional |
| `NODE_ENV` | Umgebung (development/production) | `development` | Optional |

### Troubleshooting Installation

**Problem: "npm install" schlägt fehl**
```bash
# Node.js Cache leeren
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**Problem: Port bereits belegt**
```bash
# Anderen Port verwenden
echo "PORT=3000" >> .env
npm run dev
```

**Problem: Admin-Login funktioniert nicht**
```bash
# Passwort in .env prüfen
cat .env | grep ADMIN_PASSWORD
```

## 🌐 Deployment und Object Storage

### Replit Deployment

**Wichtiger Hinweis für Deployment**: Die Logo-Upload-Funktion benötigt Object Storage-Konfiguration.

#### Schritte für erfolgreichen Deployment:

1. **Code deployieren**: Verwenden Sie den "Deploy" Button in Replit
2. **Object Storage konfigurieren** (erforderlich für Logo-Uploads):
   - Gehen Sie zu Ihrem deployed Repl
   - Öffnen Sie das **"Object Storage"** Tool in der linken Seitenleiste
   - **Erstellen Sie einen neuen Bucket**
   - Die erforderlichen Umgebungsvariablen werden automatisch gesetzt:
     - `PRIVATE_OBJECT_DIR=/your-bucket-name/.private`
     - `PUBLIC_OBJECT_SEARCH_PATHS=/your-bucket-name/public`
3. **Redeploy**: Nach der Bucket-Erstellung die Anwendung neu deployen

**Fehlerbehebung**: Falls Sie den Fehler `"PRIVATE_OBJECT_DIR not set"` erhalten, wurde Object Storage noch nicht konfiguriert. Führen Sie Schritt 2-3 aus.

### Andere Plattformen

- **Vercel**: Node.js-Unterstützung (Object Storage manuell konfigurieren)
- **Heroku**: Mit Procfile (Object Storage manuell konfigurieren)  
- **Docker**: Dockerfile erstellbar (Object Storage manuell konfigurieren)

## 📚 Dokumentation

Diese Anwendung verfügt über umfassende Dokumentation für verschiedene Anwendungsfälle:

| Dokument | Beschreibung | Zielgruppe |
|----------|-------------|-----------|
| **[README.md](./README.md)** | Vollständige Anleitung mit Installation, Konfiguration und Verwaltung | Alle Benutzer |
| **[CHANGELOG.md](./CHANGELOG.md)** | **Version 1.0.0** - Vollständige Versionshistorie und Feature-Übersicht | Alle Benutzer |
| **[INSTALLATION.md](./INSTALLATION.md)** | Schnellstart-Anleitung für sofortige Inbetriebnahme | Entwickler & Administratoren |
| **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** | Umfassende REST API-Dokumentation mit Beispielen | Entwickler & Integratoren |
| **[ENTERPRISE_DEPLOYMENT.md](./ENTERPRISE_DEPLOYMENT.md)** | Production-Deployment für Unternehmensumgebungen | DevOps & System-Administratoren |
| **[OPENSHIFT_DEPLOYMENT.md](./OPENSHIFT_DEPLOYMENT.md)** | OpenShift-spezifisches Deployment mit persistentem Storage | OpenShift-Administratoren |

### Weiterführende Dokumentation
- **replit.md**: Interne Projektarchitektur und Entwicklerrichtlinien
- **sample-rules-import.json**: Beispieldatei für Regel-Import
- **.env.example**: Beispiel-Umgebungskonfiguration

## 📁 Projektstruktur

```
url-migration-app/
├── client/                 # Frontend (React + TypeScript)
│   ├── src/
│   │   ├── components/     # UI-Komponenten
│   │   ├── pages/         # Hauptseiten (Admin, Migration)
│   │   ├── hooks/         # Custom React Hooks
│   │   └── lib/           # Utilities und Hilfsfunktionen
├── server/                # Backend (Express + TypeScript)
│   ├── index.ts           # Server-Einstiegspunkt
│   ├── routes.ts          # API-Endpunkte
│   ├── storage.ts         # Daten-Management
│   └── vite.ts            # Vite-Integration
├── shared/                # Geteilte Schemas und Typen
├── data/                  # JSON-Dateien für Datenspeicherung
│   ├── rules.json         # URL-Transformationsregeln
│   ├── tracking.json      # Zugriffs-Statistiken
│   └── settings.json      # Allgemeine Einstellungen
└── package.json
```

## 🔧 Verfügbare NPM-Befehle

| Befehl | Beschreibung |
|--------|-------------|
| `npm run dev` | Startet Entwicklungsserver mit Hot-Reload |
| `npm run build` | Erstellt Produktions-Build |
| `npm start` | Startet Produktionsserver |
| `npm run check` | TypeScript-Typprüfung |

## 📋 Version Information

**Aktuelle Version:** 1.0.0 (Erste produktionsreife Version)

Siehe [CHANGELOG.md](./CHANGELOG.md) für eine vollständige Übersicht aller Features und Änderungen in Version 1.0.0.

## 🛠️ Administration und Verwaltung

### Admin-Zugang

#### Normaler Zugang
1. Navigieren Sie zu `http://localhost:5000`
2. Klicken Sie auf den Admin-Login-Button
3. Geben Sie das Admin-Passwort ein (Standard: "Password1")
4. **Automatische Session-Persistenz**: Bleiben Sie nach Browser-Refresh eingeloggt
5. **Tab-State-Erhaltung**: Ausgewählte Admin-Tabs werden nach Aktualisierung beibehalten

#### Admin-Zugang bei aktivierter automatischer Weiterleitung

**⚠️ Wichtiger Hinweis:** Falls die automatische Weiterleitung aktiviert ist, erreichen Sie das Admin-Panel nur noch über URL-Parameter:

```
https://ihre-domain.com/?admin=true
```

**Beispiele:**
- Entwicklung: `http://localhost:5000/?admin=true`
- Produktion: `https://ihre-app.replit.app/?admin=true`

Dieser Parameter umgeht die automatische Weiterleitung und zeigt das normale Admin-Login an.

### URL-Regeln verwalten

#### Neue Regel erstellen
1. Im Admin-Panel auf "Neue Regel erstellen" klicken
2. **URL-Matcher** eingeben (z.B. `/news-beitrag/`)
3. **Ziel-URL** definieren (z.B. `/nachrichten/artikel/`)
4. **Regel-Typ** wählen:
   - `wildcard`: Vollständige Weiterleitung
   - `partial`: Teilweise Weiterleitung
5. **Automatische Weiterleitung** aktivieren/deaktivieren
6. Optional: **Info-Text** für spezielle Hinweise

#### Multi-Select-Funktionen (Desktop)
- **Einzelauswahl**: Checkboxes neben jeder Regel
- **Alle auswählen**: Master-Checkbox für gesamte Seitenauswahl
- **Bulk-Löschung**: Mehrere Regeln gleichzeitig löschen
- **Bestätigungsdialog**: Sicherheitsabfrage vor Bulk-Operationen
- **Mobile-Hinweis**: Informative Meldung für mobile Nutzer

### Automatische Weiterleitung konfigurieren

Die Anwendung unterstützt automatische Weiterleitung ohne Anzeige der Migrations-Seite auf zwei Ebenen:

#### Globale Automatische Weiterleitung
1. Im Admin-Panel zu den "Allgemeinen Einstellungen" navigieren
2. Zum "Footer"-Bereich scrollen
3. Die Option "Automatische Weiterleitung" aktivieren
4. Einstellungen speichern

#### Regel-spezifische Automatische Weiterleitung
1. Im Admin-Panel unter "URL-Transformationsregeln" eine Regel erstellen oder bearbeiten
2. Die Option "Automatische Weiterleitung für diese Regel" aktivieren
3. Regel speichern

#### Funktionsweise und Prioritäten
- **Regel-spezifisch aktiv**: URLs, die dieser Regel entsprechen, werden automatisch weitergeleitet
- **Nur global aktiv**: Alle URLs werden automatisch weitergeleitet (außer solche mit Regeln ohne Auto-Redirect)
- **Beide inaktiv**: Benutzer sehen die normale Migrations-Seite mit Schaltflächen

#### Wichtige Hinweise
- Regel-spezifische Einstellungen haben Vorrang vor der globalen Einstellung
- Bei aktivierter automatischer Weiterleitung ist der Admin-Zugang nur über `?admin=true` möglich
- URL-Regeln werden weiterhin angewendet und in Statistiken erfasst
- Die Weiterleitung erfolgt sofort beim Seitenladen ohne Benutzerinteraktion

#### Regeln importieren/exportieren

**Export:**
```bash
# Über Admin-Panel: "Daten exportieren" → "URL-Regeln" → JSON/CSV
```

**Import:**
- JSON-Datei mit folgendem Format vorbereiten:
```json
{
  "rules": [
    {
      "matcher": "/alte-seite/",
      "targetUrl": "/neue-seite/",
      "type": "redirect",
      "infoText": "Diese Seite wurde verschoben"
    }
  ]
}
```
- Über Admin-Panel hochladen

### Einstellungen anpassen

Im Admin-Panel können alle Texte und visuelle Elemente angepasst werden:

- **Header-Einstellungen**: Titel, Icons, Hintergrundfarben
- **Hauptinhalt**: Popup-Texte und Beschreibungen
- **URL-Vergleich**: Labels und Anzeigeoptionen
- **Button-Texte**: Alle Schaltflächen-Beschriftungen
- **Zusätzliche Informationen**: Anpassbare Info-Bereiche

### Statistiken und Monitoring

Das Admin-Panel bietet umfassende Statistiken:

- **Zugriffszahlen**: Gesamt, heute, diese Woche
- **Top-URLs**: Meist aufgerufene veraltete URLs
- **Zeitbasierte Auswertungen**: 24h, 7 Tage, alle Daten
- **Export-Funktionen**: CSV/JSON für weitere Analysen

## 🔍 Validierung und Qualitätssicherung

### URL-Regel-Validierung

Die Anwendung verhindert automatisch:
- **Doppelte URL-Matcher**: Gleiche URLs können nicht mehrfach definiert werden
- **Intelligente Überlappungserkennung**: Präzise Erkennung echter URL-Konflikte
  - ✅ Erlaubt: `/news/` und `/news-beitrag/` (verschiedene Pfade)
  - ❌ Verhindert: `/news/` und `/news/archive/` (echte Überlappung)
- **Wildcard-Konflikte**: Probleme mit Pattern-Matching
- **Pfad-Segment-Analyse**: Intelligente Unterscheidung zwischen ähnlichen URLs

### Fehlerbehandlung

- Detaillierte Fehlermeldungen in deutscher Sprache
- Transaktionsähnliches Verhalten: Bei Validierungsfehlern werden keine Änderungen gespeichert
- Konsistente Validierung über alle Schnittstellen (Web-Interface, Import, API)

## 🗃️ Datenverwaltung

### Dateibasierte Speicherung (Standard)

Die Anwendung verwendet JSON-Dateien im `data/` Verzeichnis:
- **URL-Regeln & Einstellungen**: `data/rules.json`, `data/settings.json`, `data/tracking.json`
- **Admin-Sessions**: `data/sessions/` Verzeichnis mit automatischer Bereinigung
- Einfache Konfiguration ohne Datenbank-Setup
- Automatische Backup-Fähigkeiten durch Datei-Kopien
- Portabel zwischen verschiedenen Umgebungen
- **Production-Ready**: Dateibasierte Sessions eliminieren Memory-Leaks und skalieren über mehrere Prozesse



## 🔒 Sicherheit

- **Persistente Session-Authentifizierung** mit 7-Tage-Gültigkeit und automatischer Verlängerung
- **Dateibasierte Session-Speicherung** mit sicheren Cookies
- **Passwort-geschützter Admin-Bereich** mit konfigurierbaren Credentials
- **XSS-Schutz** durch React's eingebaute Sicherheitsfeatures
- **Input-Validierung** mit Zod-Schemas
- **Umgebungsvariablen** für sensible Konfigurationsdaten
- **Automatische Session-Prüfung** zur Erkennung abgelaufener Anmeldungen

## 🌐 Deployment

### Lokale Produktion
```bash
npm run build
npm start
```

### Replit Deployment
Die Anwendung ist für Replit optimiert und kann direkt deployed werden.

### Weitere Plattformen
- **Vercel**: Unterstützt Node.js-Anwendungen
- **Heroku**: Mit Procfile für Express-Server
- **Docker**: Dockerfile kann bei Bedarf erstellt werden

## 🛠️ Entwicklung

### Technologie-Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Express.js, TypeScript, Zod-Validierung
- **State Management**: TanStack Query für Server-State
- **Routing**: Wouter für Client-seitige Navigation
- **Forms**: React Hook Form mit Zod-Resolvers

### Entwicklungsrichtlinien
1. TypeScript für alle Dateien verwenden
2. Zod-Schemas für Datenvalidierung
3. Shared types zwischen Frontend und Backend
4. Konsistente deutsche Sprache in der UI
5. Responsive Design mit Mobile-First-Ansatz

## 📞 Support und Beitrag

Bei Fragen oder Problemen:
1. Prüfen Sie die Konsolen-Logs auf Fehlermeldungen
2. Überprüfen Sie die Umgebungsvariablen
3. Stellen Sie sicher, dass alle Dependencies installiert sind
4. Bei Admin-Zugriffsproblemen das `ADMIN_PASSWORD` prüfen
5. **Logo-Upload-Fehler**: Stellen Sie sicher, dass Object Storage konfiguriert ist (siehe Deployment-Sektion)

## 📝 Änderungshistorie

**Aktuelle Version:** 1.0.0

Für eine vollständige Übersicht aller Features, Verbesserungen und Änderungen siehe [**CHANGELOG.md**](./CHANGELOG.md).

Das Changelog enthält detaillierte Informationen zu:
- Allen implementierten Features in Version 1.0.0
- Technische Architektur und Designentscheidungen  
- Deployment- und Sicherheitsverbesserungen
- Geplante Features für zukünftige Versionen
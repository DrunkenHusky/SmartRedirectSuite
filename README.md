# SmartRedirect Suite

SmartRedirect Suite ist eine Web-Anwendung zur zentralen Verwaltung von URL‑Migrationen zwischen alter und neuer Domain. Typischer Use Case: Migration von SharePoint On-Premises zu SharePoint Online, wenn sich Domain und Pfadstruktur ändern. Die App weist Nutzer auf veraltete Links hin und kann automatisch auf neue Ziele weiterleiten.

**Demo-Instanz:** <a href="https://smartredirectsuite.fly.dev/" target="_blank">smartredirectsuite.fly.dev</a>
Diese Version basiert stets auf dem neuesten Commit des `main`-Branches, wird alle 24 Stunden zurückgesetzt und eignet sich zum Ausprobieren der App.

☕️ **Kaffee für den Code?** Wenn dir die SmartRedirect Suite gefällt, spendier mir auf [BuyMeACoffee](https://buymeacoffee.com/drunkenhusky) einen Kaffee und halte die Bits am Koffein!

## Inhaltsverzeichnis
- [Key Features](#key-features)
- [Dokumentation](#dokumentation)
- [Impressions](#impressions)
- [Funktionsweise](#funktionsweise)
  - [Regelmodi](#regelmodi)
  - [Beispiele](#beispiele)
- [Einsatzszenarien](#einsatzszenarien)
- [Schnellstart](#schnellstart)
  - [Voraussetzungen](#voraussetzungen)
  - [1. Repository klonen](#1-repository-klonen)
  - [2. Dependencies installieren](#2-dependencies-installieren)
  - [3. .env-Datei erstellen](#3-env-datei-erstellen)
  - [4. Anwendung starten](#4-anwendung-starten)
- [Administration](#administration)
  - [Regeln importieren](#regeln-importieren)
  - [Einstellungen anpassen](#einstellungen-anpassen)
  - [Statistiken & Monitoring](#statistiken--monitoring)
- [Validierung & Qualitätssicherung](#validierung--qualitatssicherung)
- [Datenverwaltung](#datenverwaltung)
- [Sicherheit](#sicherheit)
- [Deployment](#deployment)
- [Entwicklung](#entwicklung)
- [Support & Beitrag](#support--beitrag)
- [Änderungshistorie](#anderungshistorie)

## Key Features
- Zentrale Regelverwaltung mit automatischer URL-Erkennung
- Kontrollierte Migrationen und nachvollziehbare Domainwechsel
- Produktivität: Multi-Select, Import/Export von Regeln
- Admin-Panel mit persistenter Session und anpassbarer UI
- Intelligente Validierung mit Überlappungserkennung
- Umfangreiche Statistiken und URL-Tracking
- Skalierbare Architektur: Verarbeitung von über 100'000 Regeln und Logeinträgen ohne Leistungseinbussen
- Responsives Design für Desktop und Mobilgeräte

## Dokumentation
- [Benutzerhandbuch](./USER_MANUAL.md)
- [Admin-Dokumentation](./ADMIN_DOCUMENTATION.md)
- [Architektur-Übersicht](./ARCHITECTURE_OVERVIEW.md)
- [Konfigurationsbeispiele](./CONFIGURATION_EXAMPLES.md)

## Impressions

Kurzer Überblick über zentrale Screens der SmartRedirect Suite.

### Website-Besucher
1. **Initiale Meldung** – Hinweis, dass der verwendete Link veraltet ist und aktualisiert werden soll.  
   ![Initiale Meldung – Website Besucher](Impressions/Initiale%20Meldung%20Website%20Besucher.png)

2. **Neue URL mit Hinweisen** – Anzeige der automatisch generierten neuen URL inkl. Hinweise sowie der alten, aufgerufenen URL.  
   ![Anzeige neuer URL mit Hinweisen – Website Besucher nach Bestätigung Pop-up](Impressions/Anzeige%20neuer%20URL%20mit%20Hinweisen%20Website%20Besucher%20nach%20Best%C3%A4tigung%20Pop%20up.png)

### Admin-Bereich
3. **Generelle Einstellungen** – Übersicht über globale Optionen und Grundkonfiguration.  
   ![Admin Menü – Generelle Einstellungen](Impressions/Admin%20Menu%20Generelle%20Einstellungen.png)

4. **URL-Transformationsregeln** – Verwaltung von Regeln (Typ, Auto-Redirect, Status, Metadaten).  
   ![Admin Menu – URL-Transformationsregeln definieren](Impressions/Admin%20Menu%20URL-Transformationsregeln%20definieren.png)

5. **Statistiken & Tracking** – Liste aller Tracking-Einträge mit Zeitstempel, alter/neuer URL und Pfad.  
   ![Admin Menu – Statistik](Impressions/Admin%20Menu%20Statistik.png)

6. **Import/Export** – Export von Statistiken (CSV/JSON) sowie Import/Export der URL-Regeln.  
   ![Admin Menu – Import Export](Impressions/Admin%20Menu%20Import%20Export.png)

## Funktionsweise
Jede Regel definiert:
- einen **URL-Pfad-Matcher**
- einen **Modus** (*Teilweise* oder *Vollständig*)
- Zielwerte (**Base-URL** oder **Ziel-URL**)

**Fallback ohne Regeln:** Bei fehlenden Regeln erfolgt ein Domainersatz gemäß den allgemeinen Einstellungen; Pfad, Parameter und Anker bleiben erhalten.

### Regelmodi
| Modus | Verhalten |
|-------|-----------|
| **Teilweise** | Ersetzt Pfadsegmente ab dem Matcher. Base‑URL stammt aus den allgemeinen Einstellungen; zusätzliche Segmente, Parameter und Anker werden angehängt. |
| **Vollständig** | Leitet komplett auf eine neue Ziel‑URL um. Keine Bestandteile der alten URL werden übernommen. |

### Beispiele
**Ausgangs‑URL**

```
https://intranet.alt.com/sites/team/docs/handbuch.pdf?version=3#kapitel-2
```

**Teilweise**

```
Matcher: /sites/team
Neuer Teilpfad: /teams/finance
Ergebnis: https://neuesintranet.cloud.com/teams/finance/docs/handbuch.pdf?version=3#kapitel-2
```

**Vollständig**

```
Matcher: /sites/team
Ziel-URL: https://andereseite.com/hub
Ergebnis: https://andereseite.com/hub
```

**Ohne Regel (Domainersatz)**

```
Ergebnis: https://neuesintranet.cloud.com/sites/team/docs/handbuch.pdf?version=3#kapitel-2
```

### Regelpriorisierung (Spezifität)
Die spezifischste Regel gewinnt. Der Spezifitäts‑Score \(S\) berechnet sich als:

\[
S = P_{path} \cdot WEIGHT\_PATH\_SEGMENT + P_{param} \cdot WEIGHT\_QUERY\_PAIR + W_{wildcards} \cdot PENALTY\_WILDCARD + E_{exact} \cdot BONUS\_EXACT\_MATCH
\]

- **P_path** – Anzahl exakt übereinstimmender statischer Pfadsegmente
- **P_param** – Anzahl übereinstimmender Query‑Key=Value‑Paare
- **W_wildcards** – Wildcards/Platzhalter (werden negativ gewichtet)
- **E_exact** – Bonus bei kompletter Pfad- und Query‑Übereinstimmung

Beispiele:

- Request `/subsite/xyz` → Regel `/subsite/xyz` schlägt `/subsite`
- Request `/subsite?document.aspx=123` → Regel `/subsite?document.aspx=123` schlägt `/subsite`

Tie‑Breaker: mehr statische Segmente → mehr Query‑Paare → weniger Wildcards → älteres `createdAt`/niedrigere ID.

## Einsatzszenarien
- Migrationen (z. B. SharePoint On‑Premises → SharePoint Online)
- Domain‑Rebrands und Konsolidierungen
- Umstrukturierungen großer Linklandschaften

## Schnellstart

### Voraussetzungen
- Node.js >= 22

Überprüfen Sie die Installation:

```bash
node --version
npm --version
```

### 1. Repository klonen

```bash
git clone <repository-url>
cd SmartRedirectSuite
```

### 2. Dependencies installieren

```bash
npm install
```

### 3. .env-Datei erstellen
Erstellen Sie eine `.env` Datei im Hauptverzeichnis:

```bash
cat > .env <<'EOF'
# Admin Panel Authentifizierung
ADMIN_PASSWORD=MeinSicheresPasswort123

# Session-Sicherheit
SESSION_SECRET=super-geheimer-session-schluessel-hier-einfuegen-mindestens-32-zeichen

# Brute-Force-Schutz (optional)
# Max. Fehlversuche bevor IP gesperrt wird
LOGIN_MAX_ATTEMPTS=5
# Sperrdauer in Millisekunden (24h)
LOGIN_BLOCK_DURATION_MS=86400000

# Server-Konfiguration
PORT=5000
NODE_ENV=development

# Datei-Upload Pfad (optional)
# LOCAL_UPLOAD_PATH=./data/uploads
EOF
```

### 4. Anwendung starten

```bash
npm run dev        # Entwicklungsmodus
# oder
npm run build
npm start          # Produktion
```

Die Anwendung läuft anschließend unter `http://localhost:5000`.

## Administration

Der Admin-Bereich lässt sich über das Zahnrad-Symbol oben rechts oder direkt über den URL-Parameter `?admin=true` öffnen.

### Regeln importieren
Beispiel einer JSON-Datei:

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

Im Admin-Panel hochladen oder über `sample-rules-import.json` einsehen.

### Einstellungen anpassen
Im Admin-Panel können Texte, Farben und UI-Elemente angepasst werden, einschließlich:
- Header und Icons
- Popup-Texte
- Labels im URL-Vergleich
- Button-Beschriftungen
- Zusätzliche Info-Bereiche

### Statistiken & Monitoring
Das Admin-Panel zeigt:
- Zugriffszahlen (gesamt, heute, Woche)
- Top-URLs
- Zeitbasierte Auswertungen (24h, 7 Tage, alle Daten)
- Export als CSV/JSON

## Validierung & Qualitätssicherung
Die Anwendung verhindert:
- Doppelte URL-Matcher
- Überlappende Regeln (z. B. `/news/` und `/news/archive/`)
- Wildcard-Konflikte
- Ungültige Pfadsegmente

Fehler werden detailliert auf Deutsch ausgegeben; bei Validierungsfehlern werden keine Änderungen gespeichert.

## Datenverwaltung
Standardmäßig werden JSON-Dateien im `data/` Verzeichnis genutzt:
- `data/rules.json`, `data/settings.json`, `data/tracking.json`
- `data/sessions/` für Admin-Sessions

## Sicherheit
- Persistente Session-Authentifizierung (7 Tage)
- Sichere Cookies und dateibasierte Sessions
- Passwortgeschützter Admin-Bereich
- Brute-Force-Schutz mit IP-Sperre (konfigurierbar über `LOGIN_MAX_ATTEMPTS` und `LOGIN_BLOCK_DURATION_MS`)
- XSS-Schutz durch React
- Input-Validierung mit Zod
- Konfiguration über Umgebungsvariablen

## Deployment
Lokale Produktion:

```bash
npm run build
npm start
```

Weitere Plattformen: Vercel, Heroku oder Docker (Persistenz über `LOCAL_UPLOAD_PATH` sicherstellen).
Für Demo-Zwecke mit täglichem Reset der Daten kann das `Dockerfile.demo` genutzt werden (setzt Sessions, Uploads und Einstellungen täglich zurück).

## Entwicklung
Technologie-Stack:
- React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- Express.js und Zod im Backend
- TanStack Query, Wouter, React Hook Form

Richtlinien:
1. TypeScript verwenden
2. Zod-Schemas zur Validierung
3. Shared Types zwischen Frontend und Backend
4. UI in deutscher Sprache
5. Responsive, Mobile-First Design

## Support & Beitrag
Bei Problemen:
1. Konsolen-Logs prüfen
2. Umgebungsvariablen kontrollieren
3. Dependencies installieren
4. `ADMIN_PASSWORD` verifizieren
5. Upload-Pfad bei Logo-Fehlern prüfen


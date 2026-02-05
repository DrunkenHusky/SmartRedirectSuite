# SmartRedirect Suite

SmartRedirect Suite ist eine Web-Anwendung zur zentralen Verwaltung von URL‑Migrationen zwischen alter und neuer Domain. Typischer Use Case: Migration von SharePoint On-Premises zu SharePoint Online, wenn sich Domain und Pfadstruktur ändern. Die App weist Nutzer auf veraltete Links hin und kann automatisch auf neue Ziele weiterleiten.

**Demo-Instanz:** [smartredirectsuite.render.com](https://smartredirectsuite.onrender.com/)
Diese Version basiert stets auf dem neuesten Dev-Build, wird alle 24 Stunden zurückgesetzt und eignet sich zum Ausprobieren der App.

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
  - [Matching Indicator](#matching-indicator)
  - [Statistiken & Monitoring](#statistiken--monitoring)
- [Release Prozess](#release-prozess)
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

- [Benutzerhandbuch](./docs/USER_MANUAL.md)
- [Admin-Dokumentation](./docs/ADMIN_DOCUMENTATION.md)
- [Docker Deployment](./docs/DOCKER_DEPLOYMENT.md)
- [Architektur-Übersicht](./docs/ARCHITECTURE_OVERVIEW.md)
- [Konfigurationsbeispiele](./docs/CONFIGURATION_EXAMPLES.md)
- [Release Pipeline](./docs/release-pipeline.md)

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
- einen **Modus** (_Teilweise_ oder _Vollständig_)
- Zielwerte (**Base-URL** oder **Ziel-URL**)

Der Matcher greift an beliebiger Stelle im Pfad – eine Regel wie `/sites/team`
matcht sowohl `/sites/team/docs` als auch `/archive/sites/team/docs`.

**Fallback ohne Regeln:** Bei fehlenden Regeln erfolgt ein Domainersatz gemäß den allgemeinen Einstellungen; Pfad, Parameter und Anker bleiben erhalten.

### Regelmodi

| Modus           | Verhalten                                                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Teilweise**   | Ersetzt Pfadsegmente ab dem Matcher. Base‑URL stammt aus den allgemeinen Einstellungen; zusätzliche Segmente, Parameter und Anker werden angehängt. |
| **Vollständig** | Leitet komplett auf eine neue Ziel‑URL um. Keine Bestandteile der alten URL werden übernommen.                                                      |

### Gross-/Kleinschreibung

In den allgemeinen Einstellungen kann die Option "Gross/Kleinschreibung beachten" aktiviert werden.

- **Deaktiviert (Standard):** `/Test` und `/test` werden als gleich behandelt. Das System normalisiert alle Pfade intern zu Kleinbuchstaben.
- **Aktiviert:** `/Test` und `/test` werden als unterschiedlich betrachtet. Eine Regel für `/Test` greift nicht bei einem Aufruf von `/test`.

**Best Practice:** Aktivieren Sie diese Option nur, wenn das ursprüngliche System (z. B. ein Linux-Dateisystem oder ein spezifisches CMS) case-sensitive URLs verwendet hat und Sie Kollisionen vermeiden müssen.

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
S = P*{path} \cdot WEIGHT_PATH_SEGMENT + P*{param} \cdot WEIGHT_QUERY_PAIR + W*{wildcards} \cdot PENALTY_WILDCARD + E*{exact} \cdot BONUS_EXACT_MATCH
\]

- **P_path** – Anzahl exakt übereinstimmender statischer Pfadsegmente
- **P_param** – Anzahl übereinstimmender Query‑Key=Value‑Paare
- **W_wildcards** – Wildcards/Platzhalter (werden negativ gewichtet)
- **E_exact** – Bonus bei kompletter Pfad- und Query‑Übereinstimmung

Beispiele:

- Request `/subsite/xyz` → Regel `/subsite/xyz` schlägt `/subsite`
- Request `/subsite?document.aspx=123` → Regel `/subsite?document.aspx=123` schlägt `/subsite`

Tie‑Breaker: mehr statische Segmente → mehr Query‑Paare → weniger Wildcards → älteres `createdAt`/niedrigere ID.

## Erweiterte Regel-Optionen

### Smart Search Redirects
Wenn die Option "Intelligente Such-Weiterleitung" als Fallback aktiviert ist, versucht das System, aus der alten URL einen Suchbegriff zu extrahieren, falls keine direkte Regel greift.

*   **Standard:** Das letzte Segment des Pfades wird als Suchbegriff verwendet.
*   **Regex-Regeln:** Sie können spezifische Regeln definieren (z.B. `[?&]file=([^&]+)`), um IDs oder Dokumentennamen aus Parametern zu extrahieren.
*   **Reihenfolge:** Die Regeln werden von oben nach unten geprüft.
*   **URL Encoding:** Sie können global oder pro Regel festlegen, ob der extrahierte Suchbegriff URL-kodiert (z.B. `%20` statt Leerzeichen) werden soll.

### Globale Transformationen

Zusätzlich zu den spezifischen Regeln können Sie in den "Generellen Einstellungen" globale Transformationen definieren, die auf alle Umleitungen angewendet werden.

1.  **Globale Suchen & Ersetzen:**
    *   Wird auf alle generierten URLs angewendet.
    *   **Priorität:** Wenn eine spezifische Regel denselben Suchbegriff ("Suchen") definiert wie die globale Einstellung, gewinnt die Definition in der Regel.

2.  **Globale Statische Parameter:**
    *   Werden an alle URLs angehängt.
    *   **Priorität:** Wenn eine spezifische Regel denselben Parameter-Key ("Key") definiert wie die globale Einstellung, gewinnt der Wert aus der Regel.

### Suchen & Ersetzen

Sie können definieren, dass bestimmte Teile der Ziel-URL (inkl. Pfad und Parameter) ersetzt werden sollen. Dies geschieht **nach** der Generierung der Basis-URL, aber **vor** dem Anhängen von statischen Parametern.

*   **Suchen:** Der zu ersetzende Text (String).
*   **Ersetzen:** Der neue Text. Wenn leer, wird der Suchtext gelöscht.
*   **Case Sensitivity:** Legt fest, ob Groß-/Kleinschreibung beachtet werden soll.

### Feedback Survey & Fallback

Die Feedback-Umfrage kann optional mit einer **Smart Search Fallback** Funktion erweitert werden. Wenn ein Nutzer "NOK" (Daumen runter) klickt und die intelligente Such-Weiterleitung aktiv ist, wird ihm ein alternativer Such-Link angeboten.

*   Dies erzeugt einen separaten Statistik-Eintrag.
*   Der Nutzer kann auch für diesen Vorschlag Feedback geben.
*   Klickt der Nutzer erneut "NOK", kann er (falls aktiviert) die korrekte URL vorschlagen.

**Hinweis zu Auto-Redirect:**
Wenn Auto-Redirect (global oder per Regel) aktiviert ist, wird die Feedback-Umfrage übersprungen. Das System loggt diese Interaktion automatisch als `auto-redirect` in der Feedback-Statistik.

### Parameter-Handling

Bei "Teilweise" (Partial) und "Vollständig" (Wildcard) Redirects können Sie steuern, wie mit URL-Parametern verfahren wird.

**Für Partial & Domain Regeln:**
1.  **Parameter verwerfen (Discard):** Aktivieren Sie "Alle Link-Parameter entfernen", um standardmäßig alle Query-Parameter der alten URL zu löschen. Wenn deaktiviert, werden alle Parameter übernommen.
2.  **Ausnahmen definieren (Keep):** Wenn Discard aktiviert ist, können Sie spezifische Parameter definieren, die trotzdem beibehalten werden sollen.

**Für Wildcard Regeln:**
1.  **Parameter behalten (Forward):** Aktivieren Sie "Alle Link-Parameter beibehalten", um alle Parameter 1:1 an die Ziel-URL anzuhängen.
2.  **Spezifische Parameter:** Wenn Forward deaktiviert ist, werden standardmäßig alle Parameter entfernt. Sie können dann unter "Parameter beibehalten / umbenennen" spezifische Ausnahmen definieren.

**Allgemein:**
*   **Regex:** Key und Value können per Regex definiert werden.
*   **Umbenennen:** Sie können einen "Ziel-Key" angeben. Beispiel: Aus `?file=dokument.pdf` wird `?f=dokument.pdf`.
*   **Nicht kodieren (Raw):** Für statische und beibehaltene Parameter kann die Option "Nicht kodieren" aktiviert werden. Dies verhindert die standardmäßige URL-Kodierung der Werte (nützlich, wenn `%20` statt `+` benötigt wird oder der Wert bereits kodiert vorliegt).
*   **Statische Parameter:** Sie können Parameter definieren, die **immer** angehängt werden (z.B. `?source=migration`).

**Reihenfolge der Parameter in der Ziel-URL:**
1.  Statische Parameter (in der definierten Reihenfolge)
2.  Behaltene Parameter (in der definierten Reihenfolge)

**Beispiel:**
*   Alte URL: `.../page?old=123&ignore=me`
*   Statisch: `new=A`
*   Keep: `old` -> `id`
*   Ergebnis: `.../ziel?new=A&id=123`

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

# Limit für Import-Vorschau (Anzahl Regeln)
IMPORT_PREVIEW_LIMIT=1000

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

### Matching Indicator

Der Matching Indicator (Link-Qualitätstacho) visualisiert, wie gut eine aufgerufene URL zu einer neuen URL passt. Er wird auf der Migrationsseite angezeigt.

**Qualitätsstufen:**

- **Grün (100%):** Exakte Übereinstimmung oder Startseite (Root).
- **Gelb (60-90%):** URL erkannt, aber mit leichten Abweichungen (z.B. zusätzliche Parameter).
- **Rot (< 60%):** Nur Teilübereinstimmung (Partial Match) oder keine spezifische Zuordnung möglich.

Die Erklärungstexte für diese Stufen können im Admin-Bereich unter "Allgemeine Einstellungen" individuell angepasst werden.

### Statistiken & Monitoring

Das Admin-Panel zeigt:

- Zugriffszahlen (gesamt, heute, Woche)
- Top-URLs
- Zeitbasierte Auswertungen (24h, 7 Tage, alle Daten)
- Export als CSV/JSON

### Performance & Systemanforderungen

Das System verwendet eine hochoptimierte In-Memory-Verarbeitung für URL-Regeln und Tracking-Daten.

*   **Tracking-Cache:** Um hohe I/O-Lasten zu vermeiden, können Tracking-Daten im Arbeitsspeicher gehalten werden. Dies ist standardmäßig aktiviert und beschleunigt Dashboard-Zugriffe massiv.
    *   **Empfehlung:** Für Produktionssysteme mit vielen Zugriffen sollten mindestens **512 MB bis 1 GB RAM** eingeplant werden, insbesondere wenn die Anzahl der Tracking-Einträge 500'000 übersteigt.
    *   **Konfiguration:** Der Cache kann in den Admin-Einstellungen unter "System & Daten" -> "Systemeinstellungen" deaktiviert werden, falls der Arbeitsspeicher knapp ist (führt zu langsameren Statistiken).

## Release Prozess

Dieses Projekt verwendet eine automatisierte CI/CD-Pipeline mit **GitHub Actions** und **Semantic Release**.

- Commits sollten der [Conventional Commits](https://www.conventionalcommits.org/) Konvention folgen (z.B. `feat:`, `fix:`).
- Bei einem Push auf `main` wird automatisch getestet, versioniert und veröffentlicht.
- Docker-Images werden automatisch in die GitHub Container Registry (ghcr.io) gepusht.

Weitere Details finden Sie in der [Release-Dokumentation](./docs/release-pipeline.md).

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

Weitere Plattformen: Vercel, Heroku oder Docker. Details zur Docker-Installation finden Sie im [Docker Deployment Guide](./docs/DOCKER_DEPLOYMENT.md).

Für Demo-Zwecke mit täglichem Reset der Daten kann das `Dockerfile.demo` genutzt werden (setzt Sessions, Uploads und Einstellungen täglich zurück).

### Automatisches Deployment auf fly.io

Das Repository enthält eine CI/CD-Pipeline (`.github/workflows/deploy.yml`) für das automatische Deployment auf fly.io.

*   **Trigger:** Ein Push auf den Branch `NextRelease` löst das Deployment aus.
*   **Voraussetzungen:**
    *   Das Secret `FLY_API_TOKEN` muss in den GitHub Repository Settings hinterlegt sein.
    *   Die Konfiguration erfolgt über die `fly.toml` und das `Dockerfile.demo`.
*   **Ablauf:** Die GitHub Action authentifiziert sich via Token, baut das Image remote auf fly.io und deployt die neue Version.

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

Branding & Versionierung:

- App-Name und Version werden zentral über `shared/appMetadata.ts` aus der `package.json` abgeleitet.
- Änderungen an Name/Version müssen nur dort erfolgen und stehen danach sowohl im Client (Dokumenttitel, Footer) als auch im Server (Response-Header) zur Verfügung.

## Support & Beitrag

Bei Problemen:

1. Konsolen-Logs prüfen
2. Umgebungsvariablen kontrollieren
3. Dependencies installieren
4. `ADMIN_PASSWORD` verifizieren
5. Upload-Pfad bei Logo-Fehlern prüfen

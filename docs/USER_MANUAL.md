# SmartRedirect Suite - Benutzerhandbuch

Dieses Handbuch beschreibt die tägliche Nutzung der SmartRedirect Suite. Die Anwendung verwaltet mehr als 100.000 URL-Transformationsregeln und unterstützt Migrationen zwischen Domains.

Den Admin-Bereich öffnen Sie über das Zahnrad-Symbol in der Kopfzeile oder indem Sie `?admin=true` an die URL anhängen.

## Allgemeine Einstellungen
Nach der Anmeldung im Administrator-Bereich steht ein Menü mit vier Reitern zur Verfügung: **Allgemein**, **Regeln**, **Statistik** und **Import/Export**. Über die Schaltflächen im Kopfbereich können Sie sich abmelden oder den Admin-Bereich schließen.

Im Reiter **Allgemein** lassen sich alle Texte, Farben und Icons der Migration-Anwendung anpassen:

- **Header**: Titel, Icon oder Logo sowie die Hintergrundfarbe des oberen Bereichs.
- **Hauptbereich und Hinweis**: Überschrift, Beschreibung, Warn-Icon und Farben für die Hinweismeldung.
- **URL-Vergleich**: Titel, Icon, Hintergrundfarbe und Bezeichnungen für alte und neue URL. Optional Standard-Domain und Button-Texte zum Kopieren oder Öffnen der neuen Adresse.
- **Spezielle Hinweise**: Überschrift, Icon und Standardtext für Hinweise ohne spezifische Regel.
- **Zusätzliche Informationen**: Titel, Icon und bis zu drei Stichpunkte.
- **Footer**: Copyright-Hinweis.
- **Automatische Weiterleitung**: Globale Aktivierung einer sofortigen Weiterleitung für alle Regeln.

## Regeln verwalten
1. **Neue Regel** anlegen: URL-Matcher, Ziel-URL, Redirect-Typ (*Teilweise*, *Vollständig* oder *Domain*), optionaler Info-Text und automatische Weiterleitung konfigurieren.
   - **Parameter-Behandlung**:
     - Bei *Teilweise/Domain*: Option "Alle Link-Parameter entfernen" (Standard: Aus/Parameter behalten).
     - Bei *Vollständig*: Option "Link-Parameter beibehalten" (Standard: Aus/Parameter entfernen).
2. **Regeln suchen, sortieren und paginieren**: Eingabe im Suchfeld, Sortierung nach Quelle, Ziel oder Erstellungsdatum.
3. **Regeln bearbeiten oder löschen**: Einzelne Einträge per Aktionen oder mehrere markierte Regeln gesammelt entfernen.
4. **Bulk-Löschung**: Mehrere Regeln auf der aktuellen Seite markieren und gemeinsam löschen.

## Statistik
- **Top 100**: Häufigste aufgerufene Pfade, filterbar nach Zeitraum (24h, 7 Tage, alle Zeit).
- **Alle Einträge**: Vollständige Liste der Tracking-Daten mit Such- und Sortierfunktion.
- **Pagination**: Anzeige der Gesamtanzahl und Navigation zwischen Seiten.

## Import und Export
Der Bereich "Import/Export" ist in drei Bereiche unterteilt, um verschiedene Anwendungsfälle abzudecken.

### 1. Standard Import / Export (Excel, CSV)
Dieser Bereich ist für die tägliche Pflege von Weiterleitungen optimiert.
- **Export**: Laden Sie alle Regeln als Excel- (.xlsx) oder CSV-Datei herunter.
- **Import**: Unterstützt Excel und CSV.
  - **Vorschau**: Vor dem eigentlichen Import wird eine Vorschau angezeigt, die neue, zu aktualisierende und ungültige Regeln auflistet.
  - **Spalten**: Die Import-Datei sollte folgende Spalten enthalten (Groß-/Kleinschreibung der Header ist egal, Deutsch/Englisch unterstützt):
    - `Matcher` / `Quelle` (Pflicht): Der Quell-Pfad oder die Domain.
    - `Target URL` / `Ziel` (Pflicht): Das Ziel der Weiterleitung.
    - `Type` / `Typ` (Optional): 'partial' (Teilweise), 'wildcard' (Vollständig) oder 'domain'. Standard ist 'partial'.
    - `Info` / `Beschreibung` (Optional): Interner Notiztext.
    - `Auto Redirect` (Optional): 'true'/'false' oder '1'/'0'.
    - `Discard Query Params` / `Parameter entfernen` (Optional): 'true'/'false'. Entfernt alle Parameter bei Partial/Domain-Regeln.
    - `Keep Query Params` / `Parameter behalten` (Optional): 'true'/'false'. Behält Parameter bei Wildcard-Regeln.
    - `ID` (Optional): Wird nur benötigt, um explizit bestehende Regeln zu aktualisieren.
  - **Option: URLs automatisch kodieren**: Wenn aktiviert (Standard), werden Sonderzeichen in URLs beim Import automatisch kodiert (z.B. Leerzeichen zu `%20`).
  - **Musterdateien**: Im UI können Vorlagen für Excel und CSV heruntergeladen werden.

### 2. Erweiterter Regel-Import/Export (JSON)
Für System-Backups und Experten.
- Arbeitet mit dem rohen JSON-Format der Datenbank.
- **Keine Vorschau**: Daten werden direkt importiert.
- **Warnung**: Regeln mit identischer ID werden sofort überschrieben.

### 3. System & Statistiken
- **System-Einstellungen**: Exportieren/Importieren Sie die gesamte Konfiguration (Texte, Farben, Icons) als JSON-Backup.
- **Statistiken**: Exportieren Sie die Tracking-Logs aller erfolgten Weiterleitungen als CSV zur externen Analyse.

### 4. Wartung
- **Cache neu aufbauen**: Erzwingt ein Neuladen aller Regeln in den Arbeitsspeicher. Nur bei Anzeigeproblemen notwendig.

Weiterführende Setup-Hinweise finden sich in [INSTALLATION.md](./INSTALLATION.md).

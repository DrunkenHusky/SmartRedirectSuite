# SmartRedirect Suite - Benutzerhandbuch

Dieses Handbuch beschreibt die tägliche Nutzung der SmartRedirect Suite. Die Anwendung verwaltet mehr als 100.000 URL-Transformationsregeln und unterstützt Migrationen zwischen Domains.

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
1. **Neue Regel** anlegen: URL-Matcher, Ziel-URL, Redirect-Typ (*Teilweise* oder *Vollständig*), optionaler Info-Text und automatische Weiterleitung konfigurieren.
2. **Regeln suchen, sortieren und paginieren**: Eingabe im Suchfeld, Sortierung nach Quelle, Ziel oder Erstellungsdatum.
3. **Regeln bearbeiten oder löschen**: Einzelne Einträge per Aktionen oder mehrere markierte Regeln gesammelt entfernen.
4. **Bulk-Löschung**: Mehrere Regeln auf der aktuellen Seite markieren und gemeinsam löschen.

## Statistik
- **Top 100**: Häufigste aufgerufene Pfade, filterbar nach Zeitraum (24h, 7 Tage, alle Zeit).
- **Alle Einträge**: Vollständige Liste der Tracking-Daten mit Such- und Sortierfunktion.
- **Pagination**: Anzeige der Gesamtanzahl und Navigation zwischen Seiten.

## Import und Export
- **Statistiken** als CSV oder JSON exportieren.
- **URL-Regeln** exportieren und über JSON-Dateien importieren. Beim Import:
  - Bestehende Regeln mit gleicher ID werden aktualisiert.
  - Ohne ID wird der Matcher geprüft und bei Übereinstimmung aktualisiert, andernfalls eine neue Regel erstellt.
  - Vorhandene Regeln bleiben erhalten.
- **Allgemeine Einstellungen** exportieren oder importieren. Beim Import werden alle bestehenden Texte, Farben und Icons ersetzt; vorherige Sicherung wird empfohlen.

Weiterführende Setup-Hinweise finden sich in [INSTALLATION.md](./INSTALLATION.md).

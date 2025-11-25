# 🚀 Schnellstart-Anleitung - SmartRedirect Suite

> **Hinweis**: Diese Schnellstart-Anleitung bietet eine vereinfachte Installation. Für detaillierte Informationen siehe [README.md](../README.md). Für Enterprise-Deployments konsultieren Sie [ENTERPRISE_DEPLOYMENT.md](./ENTERPRISE_DEPLOYMENT.md).

## 📚 Verwandte Dokumentation
- **[README.md](../README.md)**: Vollständige Dokumentation mit allen Features
- **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)**: REST API-Referenz für Entwickler
- **[ENTERPRISE_DEPLOYMENT.md](./ENTERPRISE_DEPLOYMENT.md)**: Production-Deployment-Anleitung
- **Dockerfile.demo**: Docker-Setup für Demo-Instanzen mit täglichem Daten-Reset

## 1. Voraussetzungen prüfen

```bash
# Node.js Version prüfen (benötigt: v18+)
node --version

# npm Version prüfen
npm --version
```

## 2. Installation

```bash
# Dependencies installieren
npm install

# Optionale Umgebungsvariablen konfigurieren
cp .env.example .env
# Bearbeiten Sie .env mit Ihren Werten
```

## 3. Anwendung starten

```bash
# Entwicklungsmodus (mit Hot-Reload)
npm run dev

# Produktionsmodus
npm run build
npm start
```

## 4. Zugriff

- **Hauptanwendung**: http://localhost:5000
- **Admin-Panel**: http://localhost:5000 → Zahnrad-Symbol klicken oder `?admin=true` an die URL anhängen
- **Standard Admin-Passwort**: `Password1` (ändern Sie dies in der .env-Datei!)
- **Brute-Force-Schutz**: Nach `LOGIN_MAX_ATTEMPTS` Fehlversuchen wird die IP für `LOGIN_BLOCK_DURATION_MS` ms gesperrt (Standard: 5 Versuche/24h, anpassbar in `.env`)

## 5. Erste Schritte

1. **Admin einloggen** mit Standard-Passwort
   - Automatische Session-Persistenz: Bleiben Sie nach Refresh eingeloggt
2. **Neue URL-Regel erstellen**:
   - URL-Matcher: `/alte-seite/`
   - Ziel-URL: `/neue-seite/`
   - Typ: `redirect`
   - **Hinweis**: Intelligente Validierung verhindert echte URL-Konflikte
3. **Einstellungen anpassen**: Texte und Farben nach Bedarf
4. **Tab-Navigation**: Gewählte Admin-Tabs bleiben nach Aktualisierung erhalten
5. **Testen**: Besuchen Sie http://localhost:5000/alte-seite/

## 6. Problemlösung

**Port bereits belegt?**
```bash
# Anderen Port verwenden
PORT=3000 npm run dev
```

**Admin-Passwort vergessen?**
```bash
# In .env-Datei ändern oder Standard verwenden
echo "ADMIN_PASSWORD=Password1" >> .env
```

**Daten zurücksetzen?**
```bash
# Lösche alle gespeicherten Daten
rm -rf data/
# Anwendung neu starten
npm run dev
```

## 7. Erweiterte Funktionen

### Multi-Select-Funktionen (Desktop)
- **Bulk-Operationen**: Mehrere Regeln gleichzeitig bearbeiten
- **Checkboxes**: Einzelauswahl oder "Alle auswählen"
- **Mobile-Hinweis**: Automatische Benachrichtigung für mobile Nutzer

### Automatische Weiterleitung
- **Global**: Alle URLs automatisch weiterleiten
- **Regel-spezifisch**: Pro Regel konfigurierbar
- **Admin-Zugang**: `?admin=true` Parameter bei aktiver Auto-Weiterleitung

## 8. Nächste Schritte

- **[README.md](./README.md)**: Detaillierte Feature-Dokumentation lesen
- **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)**: API-Integration planen
- **[ENTERPRISE_DEPLOYMENT.md](./ENTERPRISE_DEPLOYMENT.md)**: Production-Deployment vorbereiten
- Eigene URL-Regeln konfigurieren und Multi-Select testen
- Einstellungen an Corporate Design anpassen
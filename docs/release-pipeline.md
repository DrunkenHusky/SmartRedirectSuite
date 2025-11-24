# Release Pipeline Dokumentation

Diese Dokumentation beschreibt die Einrichtung und Funktionsweise der automatisierten Release-Pipeline für dieses Projekt.

## Überblick

Wir verwenden **GitHub Actions** für die CI/CD-Pipeline. Der Prozess ist vollständig automatisiert und umfasst:
1.  **Tests & Build:** Bei jedem Push und Pull Request.
2.  **Versionierung:** Automatische Erhöhung der Version in `package.json` basierend auf Commits (SemVer).
3.  **Release:** Erstellung von GitHub Releases und Git Tags.
4.  **Docker Registry:** Bauen und Pushen des Docker-Images in die GitHub Container Registry (GHCR).

## Komponenten

### 1. Workflow-Datei (`.github/workflows/ci-cd.yml`)

Dies ist die zentrale Steuerdatei. Sie definiert zwei Jobs:
*   `test`: Führt `npm test` und `npm run build` aus, um die Integrität des Codes sicherzustellen.
*   `release`: Führt den Release-Prozess aus. Dieser Job läuft nur auf dem `main`-Branch und nur, wenn die Tests erfolgreich waren.

### 2. Semantic Release Konfiguration (`.releaserc.json`)

Wir nutzen `semantic-release` zur Steuerung der Versionierung. Die Konfiguration beinhaltet folgende Plugins:
*   `@semantic-release/commit-analyzer`: Analysiert Commit-Messages, um die nächste Version zu bestimmen (Major, Minor, Patch).
*   `@semantic-release/release-notes-generator`: Generiert Release-Notes aus den Commits.
*   `@semantic-release/changelog`: Erstellt/Aktualisiert die `CHANGELOG.md`.
*   `@semantic-release/npm`: Aktualisiert die Version in `package.json` und `package-lock.json`.
*   `@semantic-release/git`: Committet die geänderten Dateien (`package.json`, `CHANGELOG.md`) zurück in das Repository.
*   `@semantic-release/github`: Erstellt das Release auf GitHub.

## Workflow-Ablauf

1.  Ein Entwickler pusht Code auf den `main`-Branch (oder merged einen Pull Request).
2.  Der **Test-Job** startet und verifiziert den Code.
3.  Bei Erfolg startet der **Release-Job**:
    *   `semantic-release` analysiert die Commits seit dem letzten Tag.
    *   Wird eine neue Version benötigt (z.B. durch einen `feat:` oder `fix:` Commit), wird:
        *   Die Version in `package.json` erhöht.
        *   `CHANGELOG.md` aktualisiert.
        *   Ein neuer Git Tag (z.B. `v1.3.0`) erstellt.
        *   Ein GitHub Release erstellt.
    *   Anschließend wird das **Docker Image** gebaut:
        *   Tag: `ghcr.io/<owner>/<repo>:v1.3.0`
        *   Tag: `ghcr.io/<owner>/<repo>:latest`
        *   Push in die GitHub Container Registry.
    *   Abschließend wird der Link zum Docker Image den Release-Notes auf GitHub hinzugefügt.

## Einrichtung & Voraussetzungen

### GitHub Repository Einstellungen

Damit der Workflow reibungslos funktioniert, müssen folgende Einstellungen im GitHub Repository geprüft werden:

1.  **Actions Permissions:**
    *   Gehe zu *Settings* -> *Actions* -> *General*.
    *   Unter **Workflow permissions**, wähle **Read and write permissions**.
    *   Aktiviere "Allow GitHub Actions to create and approve pull requests" (optional, aber hilfreich).

2.  **Container Registry:**
    *   Das Docker Image wird unter `ghcr.io` veröffentlicht. Die Berechtigung erfolgt automatisch über den `GITHUB_TOKEN` des Workflows.
    *   Nach dem ersten Push kann die Sichtbarkeit des Pakets (Package Settings) von "Private" auf "Public" gestellt werden, falls gewünscht.

3.  **Secrets:**
    *   Es sind **keine manuellen Secrets** erforderlich. Der Workflow nutzt das automatisch generierte `GITHUB_TOKEN`.

### Commit-Konvention

Damit die Versionierung funktioniert, **müssen** Commits der [Conventional Commits](https://www.conventionalcommits.org/) Konvention folgen:

*   `fix: ...` -> Patch Release (0.0.x)
*   `feat: ...` -> Minor Release (0.x.0)
*   `BREAKING CHANGE: ...` (im Body oder Footer) -> Major Release (x.0.0)
*   Andere Typen wie `chore:`, `docs:`, `refactor:` lösen standardmäßig kein Release aus.

Beispiel:
```bash
git commit -m "feat: add new user login"
```

## Lokale Entwicklung

Die Release-Tools sind als `devDependencies` installiert. Es ist jedoch nicht empfohlen, Releases lokal auszuführen. Der Prozess sollte ausschließlich über die CI/CD-Pipeline laufen.

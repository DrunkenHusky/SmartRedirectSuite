# Release pipeline documentation

This documentation describes how to set up and work the automated release pipeline for this project.

## Overview

We use **GitHub Actions** for the CI/CD pipeline. The process is fully automated and includes:
1. **Testing & Build:** On every push and pull request.
2. **Versioning:** Automatically increment version in `package.json` based on commits (SemVer).
3. **Release:** Creation of GitHub releases and Git tags.
4. **Docker Registry:** Build and push the Docker image to the GitHub Container Registry (GHCR).

## Components

### 1. Workflow-Datei (`.github/workflows/ci-cd.yml`)

This is the central control file. It defines two jobs:
*   `test`: Runs `npm test` and `npm run build` to ensure code integrity.
*   `release`: Runs the release process. This job only runs on the `main` branch and only if the tests were successful.

### 2. Semantic Release Konfiguration (`.releaserc.json`)

We use `semantic-release` to control versioning. The configuration includes the following plugins:
*   `@semantic-release/commit-analyzer`: Analyzes commit messages to determine the next release (major, minor, patch).
*   `@semantic-release/release-notes-generator`: Generates release notes from the commits.
*   `@semantic-release/changelog`: Creates/updates the `CHANGELOG.md`.
*   `@semantic-release/npm`: Updates the version in `package.json` and `package-lock.json`.
*   `@semantic-release/git`: Commits the changed files (`package.json`, `CHANGELOG.md`) back to the repository.
*   `@semantic-release/github`: Creates the release on GitHub.

## Workflow flow

1. A developer pushes code to the `main` branch (or merges a pull request).
2. The **Test job** starts and verifies the code.
3. If successful, the **release job** starts:
    *   `semantic-release` analyzes commits since the last day.
    *   If a new version is required (e.g. through a `feat:` or `fix:` commit), then:
        *   Increased the version in `package.json`.
        *   `CHANGELOG.md` updated.
        *   A new Git tag (e.g. `v1.3.0`) created.
        *   Created a GitHub release.
    *   The **Docker Image** is then built:
        *   Tag: `ghcr.io/<owner>/<repo>:v1.3.0`
        *   Tag: `ghcr.io/<owner>/<repo>:latest`
        *   Push in die GitHub Container Registry.
    *   Finally, the link to the Docker image is added to the release notes on GitHub.

## Setup & Requirements

### GitHub repository settings

In order for the workflow to work smoothly, the following settings must be checked in the GitHub repository:

1.  **Actions Permissions:**
    *   Go to *Settings* -> *Actions* -> *General*.
    *   Unter **Workflow permissions**, wähle **Read and write permissions**.
    *   Enable "Allow GitHub Actions to create and approve pull requests" (optional but helpful).

2.  **Container Registry:**
    *   The Docker image is published at `ghcr.io`. The authorization is done automatically via the `GITHUB_TOKEN` of the workflow.
    *   After the first push, the visibility of the package (Package Settings) can be changed from "Private" to "Public" if desired.

3.  **Secrets:**
    *   **No manual secrets** are required. The workflow uses the automatically generated `GITHUB_TOKEN`.

### Commit Convention

For versioning to work, commits **must** follow the [Conventional Commits](https://www.conventionalcommits.org/) convention:

*   `fix: ...` -> Patch Release (0.0.x)
*   `feat: ...` -> Minor Release (0.x.0)
*   `BREAKING CHANGE: ...` (im Body oder Footer) -> Major Release (x.0.0)
*   Other types like `chore:`, `docs:`, `refactor:` do not trigger a release by default.

Example:
```bash
git commit -m "feat: add new user login"
```

## Local development

The release tools are installed as `devDependencies`. However, it is not recommended to run releases locally. The process should run exclusively via the CI/CD pipeline.

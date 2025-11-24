# Release Pipeline

This repository uses **semantic-release** to automate versioning, tagging, GitHub Releases, and Docker image publication to GitHub Container Registry (GHCR).

## Workflow Overview

1. **Push to `main`** triggers the GitHub Actions workflow at `.github/workflows/release.yml`.
2. The **test job** installs dependencies, executes the full test suite, builds the application, and runs `npm audit --omit=dev --audit-level=high`.
3. The **release job** runs `semantic-release`:
   - Determines the next SemVer version from Conventional Commit history.
   - Updates `package.json`, `package-lock.json`, and `CHANGELOG.md` with the new version and notes.
   - Creates a git tag (`v<version>`) and GitHub Release with generated notes.
4. If a new release is published, the pipeline builds and pushes Docker images to GHCR with two tags:
   - `ghcr.io/<owner>/<repo>:<version>`
   - `ghcr.io/<owner>/<repo>:latest`
5. The release body is updated to include links to the published image tags.

## Files Added

- `.github/workflows/release.yml` – CI/CD workflow covering tests, audits, semantic-release, Docker build/push, and release note updates.
- `.releaserc.json` – semantic-release configuration (branches, tag format, plugins, changelog, git commits, GitHub Release).
- `CHANGELOG.md` – auto-maintained by semantic-release.
- `docs/release-pipeline.md` – this document.

## Required GitHub Secrets

| Secret | Purpose |
| --- | --- |
| `GHCR_TOKEN` | Personal Access Token with `write:packages` and `repo` scopes to push images to GHCR. |

The default `GITHUB_TOKEN` (with `packages: write` permission) is used for semantic-release and GitHub CLI operations.

## Registry and Image Naming

- Default registry: `ghcr.io`.
- Default image name: `ghcr.io/<repository_owner>/<repository_name>` (lowercased).
- Tags pushed per release: `<version>` and `latest`.

To target Docker Hub instead of GHCR, adjust the `Prepare image metadata` and `Log in` steps in `.github/workflows/release.yml`, change the `registry` value, and provide `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN` secrets.

## Release Process

1. Developers merge pull requests into `main` using **Conventional Commit** messages (e.g., `feat: add new rule importer`).
2. The workflow runs automatically:
   - Tests, build, and audit must pass.
   - `semantic-release` calculates the next version and updates versioned files.
   - A Git tag and GitHub Release are created with changelog entries.
   - Docker images are built and pushed.
   - Release notes are appended with image references.
3. Consumers can pull the image via `docker pull ghcr.io/<owner>/<repo>:<version>` or `:latest`.

## Local Usage

- Run the release logic locally via `npm run release` (requires `semantic-release` to be available through `npx`).
- Ensure your git working tree is clean and you have appropriate access tokens (`GITHUB_TOKEN` or `GHCR_TOKEN`) exported in your environment for publishing.

## Design Choices

- **semantic-release**: Automates SemVer, changelog, tagging, and release creation with Conventional Commits.
- **GHCR**: Uses the first-party GitHub registry to avoid external credentials beyond the repo PAT.
- **docker/build-push-action**: Provides reproducible, cache-friendly Docker builds within Actions.
- **Security**: `npm audit` is enforced in CI to surface known vulnerabilities early.

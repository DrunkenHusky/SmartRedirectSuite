# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - YYYY-MM-DD

### BREAKING CHANGE

- **Rule Structure Rework**: The URL rule schema has been fundamentally redesigned for clarity and explicitness. The previously ambiguous `redirectType` and `targetUrl` fields have been replaced by a new `mode` field, which clearly distinguishes between `PARTIAL` and `COMPLETE` redirects.
  - `mode: "PARTIAL"`: Replaces a segment of the URL path. Requires a `targetPath` property.
  - `mode: "COMPLETE"`: Redirects to an entirely new URL. Requires a `targetUrl` property.

- **Migration Required**: All existing URL rules must be migrated to the new schema. Data exported from previous versions is incompatible. Please refer to the migration guide in the `README.md`.

### Features

- Introduced a more robust and explicit Zod-based schema for URL rules.
- Aligned documentation and examples with the new, clearer rule structure.

### Fixes

- Removed legacy logic for handling ambiguous `redirectType` values like `wildcard`.

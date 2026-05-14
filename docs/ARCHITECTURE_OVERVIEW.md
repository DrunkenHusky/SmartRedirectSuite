# SmartRedirect Suite - Architecture Overview

The application has a modular structure and clearly separates frontend, backend and shared types.

## Components
- **client/**: React 19 + TypeScript frontend, bundled with Vite.
- **server/**: Express-based backend with file storage and session handling.
- **shared/**: Shared TypeScript types and validation schemes.

## Process
1. Requests reach the `server/` module.
2. The server checks rules against an **in-memory cache** loaded from `data/rules.json` at startup to avoid I/O latency.
3. Validated data is delivered to the `client/` frontend.
4. `shared/` provides type definitions and Zod schemas for both sides.

The architecture enables high-performance processing of over 100,000 rules through intelligent caching and optimized data structures.

## Internationalization

The frontend initializes i18next with English as the fallback language, browser-language detection, and cookie caching for explicit language-switch choices. Translation dictionaries are loaded from `/api/translations/{languageCode}` so administrators can update UI copy without rebuilding the application. The backend stores dictionaries in the `Translation` table, seeds the built-in languages (`en`, `de`, `it`, `es`, `fr`), validates custom language codes, and merges missing non-English keys with English fallback values.

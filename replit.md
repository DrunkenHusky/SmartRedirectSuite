## Overview

**Version 1.0.0** - SmartRedirect Suite is a production-ready Node.js web application designed for URL migration. It guides users from outdated links on an old domain to equivalent new URLs. The application presents a migration page with the new URL, offering options to copy or navigate. It includes an admin panel for managing URL transformation rules, tracking migration statistics, and customizing the user experience. The project provides a robust, enterprise-grade solution for seamless web migrations with comprehensive deployment documentation.

## User Preferences

Preferred communication style: Simple, everyday language.
Language: German (HTML lang attribute set to "de")

## System Architecture

### Frontend Architecture
- **React SPA**: Built with React 18, TypeScript, and Vite.
- **UI Framework**: `shadcn/ui` components based on Radix UI primitives with Tailwind CSS.
- **State Management**: TanStack Query for server state management and caching.
- **Routing**: Wouter for lightweight client-side routing.
- **Form Handling**: React Hook Form with Zod validation.
- **Responsive Design**: Mobile-first approach optimized for various screen sizes.

### Backend Architecture
- **Express Server**: RESTful API server developed with TypeScript.
- **File-based Storage**: Uses local JSON files for data persistence (`data/rules.json`, `data/tracking.json`, `data/sessions.json`).
- **Middleware**: Includes request logging, JSON parsing, error handling, security, and validation middleware.

### Data Storage
- **File-Based Storage**: Local JSON files for URL rules, tracking data, and settings.
- **Session Storage**: File-based session persistence in `data/sessions/` directory.
- **Data Models**: URL Rules (pattern matching), Tracking Data (access statistics), Admin Sessions (persistent login), and Admin Authentication.

### URL Transformation Logic
- **Automatic Detection**: Detects old URLs via `window.location`.
- **Rule-Based Matching**: Uses admin-defined URL rules for transformations.
- **Dynamic Generation**: Replaces host domains (e.g., `replit.com` → `thisisthenewurl.com`) when no specific rule exists.
- **Custom Target URLs**: Admin rules can override automatic generation with specific target URLs.
- **Protocol Normalization**: Ensures HTTPS.
- **Path Preservation**: Maintains original URL paths and query parameters.
- **URL Validation**: Robust handling of malformed URLs and edge cases.
- **Custom Info Text**: Displays rule-specific information.
- **Intelligent Overlap Detection**: Prevents true prefix overlaps while allowing similar paths (e.g., `/news/` vs. `/news-beitrag/`).
- **Per-Rule Auto-Redirect**: Granular control over auto-redirection at the rule level, overriding global settings.

### Admin Panel Features
- **Authentication**: Password protection, persistent 7-day sessions, and automatic authentication checks.
- **State Preservation**: Admin tab selection and statistics view persistence across sessions.
- **Rule Management**: CRUD operations for URL rules with intelligent validation.
- **Statistics Dashboard**: Multi-view tracking (Overview, Top 100, All Entries).
- **Export Functionality**: Data export capabilities.
- **Markdown Support**: Rich text editing for custom information messages.
- **Optimized UI**: Mobile-first design with logical section restructuring, enhanced color pickers, and inline help.

### Authentication & Security
- **Persistent Sessions**: File-based session storage (`data/sessions/`) with 7-day expiration.
- **Security Enhancements**: Rate limiting, CORS protection, input sanitization, and security headers.
- **Input Validation**: Zod schemas for request validation.
- **XSS Protection**: React's built-in XSS protection and sanitized outputs.

### Development Setup
- **TypeScript**: Full TypeScript support.
- **Hot Reload**: Vite development server with HMR.
- **Build Process**: Separate build steps for frontend (Vite) and backend (esbuild).

### Design Patterns
- **Monorepo Structure**: Client, server, and shared code in a single repository.
- **Component Composition**: Reusable UI components.
- **Responsive Design**: Mobile-first approach with Tailwind CSS.

## External Dependencies

### Core Framework Dependencies
- **express**: Web application framework for the backend API.

### UI and Styling
- **@radix-ui/***: Accessible UI primitives.
- **tailwindcss**: Utility-first CSS framework.
- **class-variance-authority**: Type-safe CSS class management.
- **lucide-react**: Icon library.

### Form and Data Management
- **react-hook-form**: Form library with validation.
- **@hookform/resolvers**: Validation resolvers for React Hook Form.
- **zod**: TypeScript-first schema validation.
- **@tanstack/react-query**: Server state management and caching.

### Development Tools
- **vite**: Fast development server and build tool.
- **tsx**: TypeScript execution environment for development.
- **esbuild**: Fast JavaScript bundler for production builds.

### Utility Libraries
- **date-fns**: Modern date utility library.
- **clsx**: Conditional CSS class utility.
- **nanoid**: URL-safe unique ID generator.
- **wouter**: Lightweight client-side router.

## Recent Changes

### January 2025 - Version 1.0.0 Release
- **Version 1.0.0 Released**: First production-ready version with comprehensive changelog
- **Complete Feature Set**: All core functionality implemented and tested for enterprise use
- **Multi-Platform Deployment**: Support for Replit, OpenShift, and Docker with full documentation
- **Health Endpoint**: Implemented `/api/health` for monitoring with filesystem, sessions, and storage checks
- **Documentation Consolidation**: Complete CHANGELOG.md with all features from initial development
- **OpenShift Deployment**: Corrected persistent storage configuration - single volume for /app/data
- **Enterprise Ready**: Production-optimized with security, performance, and monitoring features

### August 2025 - Session Management Improvements
- **Session Persistence Fixed**: Resolved intermittent authentication failures during page reloads
- **File Store Improvements**: Enhanced file-based session store with atomic writes and better error handling
- **Bulk Operations Security**: Fixed multi-select delete scoping to prevent accidental deletion of all rules
- **Enhanced Session Configuration**: Improved cookie handling and TTL management for consistent authentication
- **Production Stability**: Eliminated race conditions and session corruption issues through proper file access checks
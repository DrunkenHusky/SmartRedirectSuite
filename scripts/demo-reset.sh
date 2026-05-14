#!/bin/sh
set -e

# Remove legacy session files; active sessions are stored in database.sqlite
rm -rf /app/data/sessions/* || true

# Remove upload files
rm -rf /app/data/uploads/* || true

# Remove database, including rules, settings, tracking and active admin sessions
rm -f /app/data/database.sqlite /app/data/database.sqlite-shm /app/data/database.sqlite-wal || true

# Start up will regenerate it

# Ensure directories exist after cleanup
mkdir -p /app/data/sessions /app/data/uploads

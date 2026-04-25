#!/bin/sh
set -e

# Remove session files
rm -rf /app/data/sessions/* || true

# Remove upload files
rm -rf /app/data/uploads/* || true

# Remove database
rm -f /app/data/database.sqlite || true

# Start up will regenerate it

# Ensure directories exist after cleanup
mkdir -p /app/data/sessions /app/data/uploads

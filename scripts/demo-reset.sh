#!/bin/sh
set -e

# Remove session files
rm -rf /app/data/sessions/* || true

# Remove upload files
rm -rf /app/data/uploads/* || true

# Remove tracking data
rm -f /app/data/tracking.json || true

# Restore default configuration
cp /defaults/settings.json /app/data/settings.json
cp /defaults/rules.json /app/data/rules.json

# Ensure directories exist after cleanup
mkdir -p /app/data/sessions /app/data/uploads

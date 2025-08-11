# SmartRedirect Suite - Enterprise Production Deployment Guide

> **Zielgruppe**: DevOps-Engineers, System-Administratoren und Enterprise-Entwickler. Für Standard-Installation siehe [INSTALLATION.md](./INSTALLATION.md). Für API-Integration konsultieren Sie [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).

## 📚 Verwandte Dokumentation
- **[README.md](./README.md)**: Vollständige Feature-Übersicht und Entwicklungsrichtlinien
- **[INSTALLATION.md](./INSTALLATION.md)**: Lokale Entwicklungsumgebung einrichten
- **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)**: REST API-Referenz für Monitoring-Integration

## Overview

This document provides comprehensive deployment instructions for the enterprise-grade SmartRedirect Suite, designed for large-scale production environments with high availability, security, and performance requirements including bulk operations and mobile-responsive interfaces.

## Architecture Summary

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Data Storage**: File-based JSON storage
- **Session Management**: Express-session with file-based persistence
- **Object Storage**: Google Cloud Storage integration
- **Performance**: Virtual scrolling, memory monitoring, and comprehensive caching

### Key Features
- **Enterprise Security**: Rate limiting, CORS protection, input sanitization, brute-force login protection
- **Performance Monitoring**: Real-time metrics, memory usage tracking
- **Scalable Architecture**: Modular design with enterprise middleware
- **Comprehensive Validation**: Type-safe schemas with detailed error handling
- **Admin Interface**: Full CRUD operations with persistent sessions
- **Bulk Operations**: Multi-select functionality for efficient rule management
- **Mobile-Responsive**: Optimized UI for desktop and mobile devices
- **German Localization**: Complete German language support throughout

### Admin Menu Access
Open the administrator menu via the gear icon in the application or by appending `?admin=true` to the base URL.

## Pre-Deployment Checklist

### 1. Environment Requirements
- Node.js 18+ (LTS recommended)
- npm 8+
- Minimum 2GB RAM
- 10GB+ disk space for logs and data
- SSL certificate for HTTPS

### 2. Security Configuration
```bash
# Generate secure session secret
export SESSION_SECRET=$(openssl rand -hex 64)

# Set admin password (minimum 8 characters with letters and numbers)
export ADMIN_PASSWORD="YourSecurePassword123"

# Brute-force login protection (optional)
export LOGIN_MAX_ATTEMPTS=5
export LOGIN_BLOCK_DURATION_MS=86400000

# Configure allowed origins for CORS
export ALLOWED_ORIGINS="https://yourdomain.com,https://www.yourdomain.com"

# Set environment
export NODE_ENV=production
```

### 3. Object Storage Setup
```bash
# Google Cloud Storage credentials
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"

# Object storage configuration
export PUBLIC_OBJECT_SEARCH_PATHS="/objects/public"
export PRIVATE_OBJECT_DIR="/objects/.private"
```

## Deployment Steps

### 1. Production Build
```bash
# Install dependencies
npm ci --only=production

# Type checking
npm run type-check

# Build application
npm run build

# Verify build integrity
npm run validate
```

### 2. Server Configuration

#### Nginx Reverse Proxy
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/private.key;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Static file caching
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API routes
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Frontend application
    location / {
        try_files $uri $uri/ /index.html;
        root /path/to/dist/public;
    }
}
```

#### Process Management with PM2
```bash
# Install PM2 globally
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'smartredirect-suite',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '500M',
    node_args: '--max-old-space-size=512'
  }]
};
EOF

# Start application
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 3. Monitoring Setup

#### Health Check Endpoint
```bash
# Monitor application health
curl -f http://localhost:5000/api/health || exit 1
```

#### Log Monitoring
```bash
# Centralized logging with rsyslog
echo "*.* @@logserver:514" >> /etc/rsyslog.conf
systemctl restart rsyslog

# Log rotation
cat > /etc/logrotate.d/smartredirect << 'EOF'
/path/to/app/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 appuser appuser
    postrotate
        pm2 reload smartredirect-suite
    endscript
}
EOF
```

## Performance Optimization

### 1. Application-Level Optimizations
- **Virtual Scrolling**: Handles large datasets efficiently
- **Memory Monitoring**: Real-time memory usage tracking
- **Debounced Search**: Reduces API calls for better performance
- **Component Memoization**: Optimized React rendering

### 2. Server-Level Optimizations
```bash
# Increase file descriptor limits
echo "fs.file-max = 65536" >> /etc/sysctl.conf
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# Optimize TCP settings for high-traffic
echo "net.core.somaxconn = 1024" >> /etc/sysctl.conf
echo "net.ipv4.tcp_max_syn_backlog = 1024" >> /etc/sysctl.conf

# Apply changes
sysctl -p
```

### 3. CDN Configuration
```javascript
// Configure CDN for static assets
const CDN_URL = process.env.CDN_URL || '';

// Update asset URLs in production
if (process.env.NODE_ENV === 'production') {
  // Assets will be served from CDN
  app.use('/assets', express.static('dist/public/assets', {
    maxAge: '1y',
    etag: true,
    lastModified: true
  }));
}
```

## Security Hardening

### 1. Application Security
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Sanitization**: XSS protection and SQL injection prevention
- **CSRF Protection**: Enabled for state-changing operations
- **Session Security**: Secure cookies with HttpOnly flag

### 2. Infrastructure Security
```bash
# Firewall configuration
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Fail2ban for brute force protection
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[nginx-http-auth]
enabled = true
port = http,https
logpath = %(nginx_access_log)s

[nginx-limit-req]
enabled = true
port = http,https
logpath = %(nginx_error_log)s
maxretry = 10
EOF

systemctl enable fail2ban
systemctl start fail2ban
```

## Monitoring and Alerting

### 1. Application Metrics
```bash
# Install monitoring dependencies
npm install --save prom-client

# Basic Prometheus metrics
cat > monitoring/metrics.js << 'EOF'
const promClient = require('prom-client');

// Create custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status']
});

const activeConnections = new promClient.Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});

module.exports = { httpRequestDuration, activeConnections };
EOF
```

### 2. Health Checks
```typescript
// Health check endpoint with comprehensive checks
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {
      filesystem: await checkFileSystemAccess(),
      objectStorage: await checkObjectStorageConnection(),
      sessions: await checkSessionStore()
    }
  };

  const isHealthy = Object.values(health.checks).every(check => check.status === 'ok');
  res.status(isHealthy ? 200 : 503).json(health);
});
```

### 3. Alerting Rules
```yaml
# Prometheus alerting rules
groups:
  - name: smartredirect-suite
    rules:
      - alert: HighMemoryUsage
        expr: (process_memory_usage_bytes / process_memory_limit_bytes) > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage detected"

      - alert: SlowResponseTime
        expr: http_request_duration_seconds{quantile="0.95"} > 2
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Slow response time detected"

      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
```

## Backup and Recovery

### 1. Data Backup
```bash
#!/bin/bash
# Backup script for production data

BACKUP_DIR="/backup/smartredirect/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup application data
cp -r ./data "$BACKUP_DIR/data"

# Backup logs
cp -r ./logs "$BACKUP_DIR/logs"

# Backup configuration
cp .env "$BACKUP_DIR/.env.backup"

# Create archive
tar -czf "$BACKUP_DIR.tar.gz" -C "$(dirname "$BACKUP_DIR")" "$(basename "$BACKUP_DIR")"
rm -rf "$BACKUP_DIR"

# Upload to cloud storage (optional)
# gsutil cp "$BACKUP_DIR.tar.gz" gs://your-backup-bucket/
```

### 2. Disaster Recovery
```bash
#!/bin/bash
# Disaster recovery script

# Stop application
pm2 stop smartredirect-suite

# Restore from backup
BACKUP_FILE="/backup/smartredirect/20240806_170000.tar.gz"
tar -xzf "$BACKUP_FILE" -C /tmp/

# Restore data
cp -r /tmp/20240806_170000/data ./data
cp -r /tmp/20240806_170000/logs ./logs

# Restart application
pm2 start smartredirect-suite

# Verify health
sleep 10
curl -f http://localhost:5000/api/health
```

## Performance Benchmarks

### Expected Performance Metrics
- **Page Load Time**: < 2 seconds (first load)
- **API Response Time**: < 200ms (95th percentile)
- **Memory Usage**: < 512MB per process
- **Concurrent Users**: 1000+ (with proper load balancing)
- **Uptime**: 99.9% availability target

### Load Testing
```bash
# Install artillery for load testing
npm install -g artillery

# Create load test configuration
cat > load-test.yml << 'EOF'
config:
  target: 'http://localhost:5000'
  phases:
    - duration: 60
      arrivalRate: 10
  defaults:
    headers:
      'Content-Type': 'application/json'

scenarios:
  - name: "API Load Test"
    flow:
      - get:
          url: "/api/admin/status"
      - post:
          url: "/api/check-rules"
          json:
            url: "https://example.com/test"
      - get:
          url: "/api/admin/stats/all"
EOF

# Run load test
artillery run load-test.yml
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   ```bash
   # Check memory usage
   pm2 monit
   
   # Restart if necessary
   pm2 restart smartredirect-suite
   ```

2. **Slow Performance**
   ```bash
   # Check logs for slow queries
   grep "Slow" logs/combined.log
   
   # Monitor real-time performance
   tail -f logs/combined.log | grep "duration"
   ```

3. **Session Issues**
   ```bash
   # Check session storage
   ls -la data/sessions/
   
   # Clear expired sessions
   find data/sessions/ -name "*.json" -mtime +7 -delete
   ```

4. **Object Storage Issues**
   ```bash
   # Test object storage connectivity
   curl -X POST http://localhost:5000/api/admin/logo/upload \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```

## Support and Maintenance

### Regular Maintenance Tasks
- **Daily**: Monitor logs and performance metrics
- **Weekly**: Review security alerts and update dependencies
- **Monthly**: Backup verification and disaster recovery testing
- **Quarterly**: Performance optimization review and capacity planning

### Contact Information
- **Technical Support**: [Your contact information]
- **Security Issues**: [Security contact]
- **Emergency Escalation**: [Emergency contact]

## Changelog

### Version 2.0.0 (January 2025)
- Enterprise-grade optimizations implemented
- Enhanced security middleware
- Performance monitoring system
- Comprehensive validation layer
- Production deployment documentation

This deployment guide ensures enterprise-level reliability, security, and performance for the SmartRedirect Suite in production environments.

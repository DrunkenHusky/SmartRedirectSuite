# SmartRedirect Suite - Enterprise API Documentation

> **Übersicht**: Diese API-Dokumentation beschreibt alle verfügbaren REST-Endpunkte für die URL-Migration-Anwendung. Für Installation siehe [INSTALLATION.md](./INSTALLATION.md), für vollständige Feature-Informationen [README.md](./README.md).

## 📚 Verwandte Dokumentation

- **[README.md](./README.md)**: Vollständige Anwendungsdokumentation mit allen Features
- **[INSTALLATION.md](./INSTALLATION.md)**: Schnellstart-Anleitung für Entwicklung
- **[ENTERPRISE_DEPLOYMENT.md](./ENTERPRISE_DEPLOYMENT.md)**: Production-Deployment und Monitoring

## Overview

The SmartRedirect Suite provides a comprehensive REST API for managing URL transformation rules, tracking migration statistics, and administering the system. This documentation covers all available endpoints with enterprise-grade features including authentication, validation, performance monitoring, and bulk operations.

To open the web-based admin menu, use the gear icon in the application or append `?admin=true` to the base URL.

## Base URL

```
Production: https://yourdomain.com/api
Development: http://localhost:5000/api
```

## Authentication

The API uses session-based authentication for admin operations. All admin endpoints require a valid session.

### Login

```http
POST /api/admin/login
Content-Type: application/json

{
  "password": "your_admin_password"
}
```

**Response**

```json
{
  "success": true,
  "sessionId": "session_uuid",
  "loginTime": "2025-01-06T17:30:00.000Z"
}
```

### Check Authentication Status

```http
GET /api/admin/status
```

**Response**

```json
{
  "isAuthenticated": true,
  "loginTime": "2025-01-06T17:30:00.000Z",
  "sessionId": "session_uuid"
}
```

### Logout

```http
POST /api/admin/logout
```

**Response**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Public Endpoints

### Check URL Rules

Checks if a path matches any configured transformation rules.

```http
POST /api/check-rules
Content-Type: application/json

{
  "path": "/news/article-1"
}
```

**Response**

```json
{
  "hasMatch": true,
  "rule": {
    "id": "rule_uuid",
    "matcher": "/news/",
    "targetUrl": "https://newsite.com/articles/",
    "infoText": "This section has been moved to our new articles area.",
    "redirectType": "partial"
  }
}
```

### Track URL Access

Records URL access for analytics and migration tracking.

```http
POST /api/track
Content-Type: application/json

{
  "oldUrl": "https://oldsite.com/news/article-1",
  "newUrl": "https://newsite.com/articles/article-1",
  "path": "/news/article-1",
  "userAgent": "Mozilla/5.0...",
  "timestamp": "2025-01-06T17:30:00.000Z"
}
```

**Response**

```json
{
  "success": true,
  "trackingId": "tracking_uuid"
}
```

### Get General Settings

Retrieves public configuration settings for the migration interface.

```http
GET /api/admin/settings
```

**Response**

```json
{
  "id": "settings_uuid",
  "headerTitle": "SmartRedirect Suite",
  "headerIcon": "ArrowRightLeft",
  "headerLogoUrl": "/objects/uploads/logo.png",
  "mainTitle": "Outdated Link Detected",
  "mainDescription": "You are using an outdated link...",
  "alertIcon": "AlertTriangle",
  "alertBackgroundColor": "yellow",
  "defaultNewDomain": "https://newsite.com",
  "copyButtonText": "Copy URL",
  "openButtonText": "Open in New Tab"
}
```

## Admin Endpoints

All admin endpoints require authentication via session.

### URL Rules Management

#### Get All Rules

```http
GET /api/admin/rules
```

**Response**

```json
[
  {
    "id": "rule_uuid",
    "matcher": "/news/",
    "targetUrl": "https://newsite.com/articles/",
    "infoText": "News section has been relocated",
    "redirectType": "partial",
    "createdAt": "2025-01-06T17:30:00.000Z"
  }
]
```

#### Create Rule

```http
POST /api/admin/rules
Content-Type: application/json

{
  "matcher": "/products/",
  "targetUrl": "https://newsite.com/shop/",
  "infoText": "Product catalog has moved",
  "redirectType": "partial"
}
```

**Validation Requirements:**

- `matcher`: Must start with `/`, be unique, and matches at any position in the path
- `targetUrl`: Must be valid HTTP/HTTPS URL
- `redirectType`: Either "wildcard" or "partial"
- `infoText`: Optional, max 5000 characters

**Response**

```json
{
  "id": "new_rule_uuid",
  "matcher": "/products/",
  "targetUrl": "https://newsite.com/shop/",
  "infoText": "Product catalog has moved",
  "redirectType": "partial",
  "createdAt": "2025-01-06T17:30:00.000Z"
}
```

#### Update Rule

```http
PUT /api/admin/rules/:id
Content-Type: application/json

{
  "matcher": "/products/",
  "targetUrl": "https://newsite.com/store/",
  "infoText": "Updated product section location",
  "redirectType": "partial"
}
```

#### Delete Rule

```http
DELETE /api/admin/rules/:id
```

**Response**

```json
{
  "success": true,
  "message": "Rule deleted successfully"
}
```

#### Bulk Delete Rules

```http
DELETE /api/admin/bulk-delete-rules
Content-Type: application/json

{
  "ruleIds": ["rule_uuid_1", "rule_uuid_2", "rule_uuid_3"]
}
```

**Validation Requirements:**

- `ruleIds`: Array of valid rule UUIDs, minimum 1 item

**Response**

```json
{
  "success": true,
  "deletedCount": 2,
  "failedCount": 1,
  "totalRequested": 3
}
```

**Error Response**

```json
{
  "success": false,
  "error": "No rule IDs provided"
}
```

#### Import Rules

```http
POST /api/admin/rules/import
Content-Type: application/json

{
  "rules": [
    {
      "matcher": "/blog/",
      "targetUrl": "https://newsite.com/news/",
      "redirectType": "partial"
    },
    {
      "matcher": "/contact/",
      "targetUrl": "https://newsite.com/contact-us/",
      "redirectType": "wildcard"
    }
  ]
}
```

**Response**

```json
{
  "success": true,
  "imported": 2,
  "skipped": 0,
  "errors": []
}
```

### Statistics and Analytics

#### Get Overview Statistics

```http
GET /api/admin/stats/overview
```

**Response**

```json
{
  "stats": {
    "total": 1250,
    "today": 45,
    "week": 320,
    "month": 1100
  },
  "topUrls": [
    {
      "url": "/news/article-1",
      "count": 85,
      "percentage": 6.8
    },
    {
      "url": "/products/item-1",
      "count": 72,
      "percentage": 5.8
    }
  ]
}
```

#### Get Top 100 URLs

```http
GET /api/admin/stats/top100
```

**Query Parameters:**

- `timeRange`: "24h", "7d", "30d", or "all"

**Response**

```json
[
  {
    "oldUrl": "https://oldsite.com/news/article-1",
    "newUrl": "https://newsite.com/articles/article-1",
    "path": "/news/article-1",
    "count": 85,
    "percentage": 6.8,
    "lastAccessed": "2025-01-06T17:30:00.000Z"
  }
]
```

#### Get All Entries

```http
GET /api/admin/stats/entries
```

**Query Parameters:**

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `sort`: Sort field (default: "timestamp")
- `order`: "asc" or "desc" (default: "desc")
- `search`: Search term for filtering

**Response**

```json
{
  "data": [
    {
      "id": "tracking_uuid",
      "oldUrl": "https://oldsite.com/news/article-1",
      "newUrl": "https://newsite.com/articles/article-1",
      "path": "/news/article-1",
      "timestamp": "2025-01-06T17:30:00.000Z",
      "userAgent": "Mozilla/5.0..."
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 1250,
    "totalPages": 63,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

### Settings Management

#### Update Settings

```http
PUT /api/admin/settings
Content-Type: application/json

{
  "headerTitle": "Migration Center",
  "headerIcon": "ArrowRightLeft",
  "mainTitle": "URL Update Required",
  "mainDescription": "Please update your bookmarks...",
  "alertIcon": "AlertTriangle",
  "alertBackgroundColor": "orange",
  "defaultNewDomain": "https://newsite.com",
  "copyButtonText": "Copy New URL",
  "openButtonText": "Open New URL"
}
```

**Validation Requirements:**

- `headerTitle`: 1-100 characters
- `mainTitle`: 1-200 characters
- `mainDescription`: 1-1000 characters
- `defaultNewDomain`: Valid HTTP/HTTPS URL
- Button texts: 1-50 characters each

### Logo Management

#### Upload Logo

```http
POST /api/admin/logo/upload
Content-Type: application/json

{
  "filename": "company-logo.png",
  "contentType": "image/png"
}
```

**Response**

```json
{
  "uploadURL": "https://storage.googleapis.com/bucket/signed-upload-url",
  "fileId": "upload_uuid"
}
```

#### Set Logo

```http
PUT /api/admin/logo
Content-Type: application/json

{
  "logoUrl": "https://storage.googleapis.com/bucket/uploads/logo.png"
}
```

**Response**

```json
{
  "success": true,
  "logoPath": "/objects/uploads/logo.png"
}
```

#### Delete Logo

```http
DELETE /api/admin/logo
```

**Response**

```json
{
  "success": true,
  "message": "Logo deleted successfully"
}
```

### Data Export

#### Export Data

```http
POST /api/admin/export
Content-Type: application/json

{
  "type": "statistics",
  "format": "csv",
  "timeRange": "7d"
}
```

**Parameters:**

- `type`: "statistics", "rules", or "settings"
- `format`: "csv" or "json"
- `timeRange`: "24h", "7d", "30d", or "all" (for statistics only)

**Response (CSV)**

```
Content-Type: text/csv
Content-Disposition: attachment; filename="url-statistics-20250106.csv"

Alte URL,Neue URL,Pfad,Zeitstempel,User-Agent,Referrer
"https://oldsite.com/news/","https://newsite.com/articles/","/news/","2025-01-06T17:30:00.000Z","Mozilla/5.0...","https://google.com"
```

**Response (JSON)**

```json
[
  {
    "oldUrl": "https://oldsite.com/news/",
    "newUrl": "https://newsite.com/articles/",
    "path": "/news/",
    "timestamp": "2025-01-06T17:30:00.000Z",
    "userAgent": "Mozilla/5.0..."
  }
]
```

## Error Handling

All API endpoints return structured error responses:

```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "matcher",
      "message": "URL matcher cannot be empty",
      "code": "too_small"
    }
  ],
  "timestamp": "2025-01-06T17:30:00.000Z",
  "requestId": "request_uuid"
}
```

### Error Codes

| Code                      | Description                                 |
| ------------------------- | ------------------------------------------- |
| `VALIDATION_ERROR`        | Request validation failed                   |
| `AUTHENTICATION_REQUIRED` | Login required                              |
| `UNAUTHORIZED`            | Invalid credentials                         |
| `NOT_FOUND`               | Resource not found                          |
| `CONFLICT`                | Resource conflict (e.g., duplicate matcher) |
| `RATE_LIMIT_EXCEEDED`     | Too many requests                           |
| `INTERNAL_ERROR`          | Server error                                |

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Global Limit**: 100 requests per 15 minutes per IP
- **Auth Limit**: 5 authentication attempts per 15 minutes per IP

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2025-01-06T17:45:00.000Z
```

## Performance Monitoring

### Health Check

```http
GET /api/health
```

**Response**

```json
{
  "status": "healthy",
  "timestamp": "2025-01-06T17:30:00.000Z",
  "uptime": 86400,
  "memory": {
    "rss": 156155904,
    "heapTotal": 87715840,
    "heapUsed": 72651432,
    "external": 1825587
  },
  "checks": {
    "filesystem": { "status": "ok", "responseTime": 2 },
    "objectStorage": { "status": "ok", "responseTime": 45 },
    "sessions": { "status": "ok", "responseTime": 1 }
  }
}
```

### Performance Metrics

```http
GET /api/metrics
```

Returns Prometheus-compatible metrics for monitoring.

## WebSocket Events (Future Enhancement)

Real-time updates for admin interface:

```javascript
// Connect to WebSocket
const ws = new WebSocket("wss://yourdomain.com/ws");

// Listen for events
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case "url_accessed":
      // Real-time URL access tracking
      break;
    case "settings_updated":
      // Settings changed
      break;
  }
};
```

## SDK Examples

### JavaScript/Node.js

```javascript
class URLMigrationAPI {
  constructor(baseURL, credentials) {
    this.baseURL = baseURL;
    this.credentials = credentials;
  }

  async login() {
    const response = await fetch(`${this.baseURL}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: this.credentials.password }),
      credentials: "include",
    });
    return response.json();
  }

  async getRules() {
    const response = await fetch(`${this.baseURL}/admin/rules`, {
      credentials: "include",
    });
    return response.json();
  }

  async createRule(rule) {
    const response = await fetch(`${this.baseURL}/admin/rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rule),
      credentials: "include",
    });
    return response.json();
  }
}

// Usage
const api = new URLMigrationAPI("https://yourdomain.com/api", {
  password: "your_password",
});

await api.login();
const rules = await api.getRules();
```

### Python

```python
import requests

class URLMigrationAPI:
    def __init__(self, base_url, password):
        self.base_url = base_url
        self.password = password
        self.session = requests.Session()

    def login(self):
        response = self.session.post(
            f"{self.base_url}/admin/login",
            json={"password": self.password}
        )
        return response.json()

    def get_rules(self):
        response = self.session.get(f"{self.base_url}/admin/rules")
        return response.json()

    def create_rule(self, rule):
        response = self.session.post(
            f"{self.base_url}/admin/rules",
            json=rule
        )
        return response.json()

# Usage
api = URLMigrationAPI("https://yourdomain.com/api", "your_password")
api.login()
rules = api.get_rules()
```

## Testing

### API Testing with curl

```bash
# Login
curl -X POST http://localhost:5000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"Password1"}' \
  -c cookies.txt

# Get rules
curl -X GET http://localhost:5000/api/admin/rules \
  -b cookies.txt

# Create rule
curl -X POST http://localhost:5000/api/admin/rules \
  -H "Content-Type: application/json" \
  -d '{"matcher":"/test/","targetUrl":"https://example.com/"}' \
  -b cookies.txt
```

### Load Testing

```bash
# Install artillery
npm install -g artillery

# Run load test
artillery quick --count 100 --num 10 http://localhost:5000/api/health
```

This comprehensive API documentation provides all the information needed to integrate with and maintain the SmartRedirect Suite in enterprise environments.

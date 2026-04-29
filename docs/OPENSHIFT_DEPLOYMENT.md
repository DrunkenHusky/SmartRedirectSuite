# OpenShift Deployment Guide - SmartRedirect Suite

> **Audience**: OpenShift administrators and DevOps engineers. For standard installation see [INSTALLATION.md](./INSTALLATION.md). For enterprise features, see [ENTERPRISE_DEPLOYMENT.md](./ENTERPRISE_DEPLOYMENT.md).

## 📚 Related documentation
- **[README.md](../README.md)**: Complete feature overview and application documentation
- **[INSTALLATION.md](./INSTALLATION.md)**: Local development environment for testing
- **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)**: REST API reference for integration
- **[ENTERPRISE_DEPLOYMENT.md](./ENTERPRISE_DEPLOYMENT.md)**: General enterprise deployment strategies

## Overview

This guide describes how to deploy the URL Migration Tool application on OpenShift with persistent data storage and production-grade configuration.
The application stores all data exclusively in the file system; a database is not used.

## Requirements

### OpenShift environment
- OpenShift 4.10+ (recommended 4.12+)
- `oc` CLI installed and configured
- Cluster admin permission or sufficient project permissions
- Access to a container registry (e.g. quay.io, Docker Hub)

### Local development tools
- Docker or Podman for container build
- Node.js 18+ for local testing
- Git for source code management

> Note: A separate `Dockerfile.demo` is available for demo instances, which resets the application every 24 hours.

## 1. Project-Setup

### Create OpenShift project
```bash
# Neues Projekt erstellen
oc new-project smartredirect-suite

# Projekt als aktiv setzen
oc project smartredirect-suite

# Labels für bessere Organisation
oc label namespace smartredirect-suite app=smartredirect-suite
```

### Configure service account
```bash
# Service Account für die Anwendung erstellen
oc create serviceaccount smartredirect-sa

# Berechtigung für Persistent Volumes
oc adm policy add-scc-to-user anyuid -z smartredirect-sa
```

## 2. Configure persistent storage

The application stores configurations, sessions and uploads exclusively in the file system. A database is not required.

### Create persistent volume claims

**Important**: The application only requires **one** persistent volume for `/app/data`. By default, uploads are stored in `/app/data/uploads` and sessions in `/app/data/sessions`.

```yaml
# Erstelle pvc-data.yaml
# Nur ein PVC nötig, da Uploads standardmäßig in ./data/uploads gespeichert werden
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: smartredirect-data-pvc
  namespace: smartredirect-suite
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi  # Erhöht auf 10Gi da jetzt alles in einem Volume
  storageClassName: gp2  # Anpassen je nach Cluster-Konfiguration
```

```bash
# PVCs anwenden
oc apply -f pvc-data.yaml
```

### Check storage classes
```bash
# Verfügbare Storage-Klassen anzeigen
oc get storageclass

# Beispiel-Output:
# NAME                PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE
# gp2 (default)      kubernetes.io/aws-ebs   Delete          WaitForFirstConsumer
# gp3                kubernetes.io/aws-ebs   Delete          WaitForFirstConsumer
```

## 3. Secrets und ConfigMaps

### Create Application Secrets
```bash
# Admin-Passwort und Session-Secret erstellen
oc create secret generic smartredirect-secrets \
  --from-literal=ADMIN_PASSWORD='IhrSicheresPasswort123!' \
  --from-literal=SESSION_SECRET='super-geheimer-session-schluessel-mindestens-64-zeichen-lang-fuer-produktion'

# Optional: TLS-Zertifikate für HTTPS
oc create secret tls smartredirect-tls \
  --cert=path/to/tls.crt \
  --key=path/to/tls.key
```

### ConfigMap for application settings

**Important Note**: The application only supports specific environment variables. Here are the actual variables read by the application:

**Supported environment variables:**
- `NODE_ENV` - environment (development/production)
- `PORT` - Server-Port (Standard: 5000)
- `ADMIN_PASSWORD` - Password for the administration area
- `SESSION_SECRET` - Secret key for sessions
- `LOCAL_UPLOAD_PATH` - **only configurable path** for logo uploads (default: ./data/uploads – **within** the `data` directory!)
- `COOKIE_DOMAIN` - Domain for cookies (only in production)
- `LOGIN_MAX_ATTEMPTS` - maximum failed attempts before an IP is blocked (default: 5)
- `LOGIN_BLOCK_DURATION_MS` - Blocking duration in milliseconds after reaching the failed attempts (default: 86400000)

**Unsupported variables** (hard-coded in the application):
- `DATA_PATH` - Data is always stored in `./data`
- `SESSION_PATH` - Sessions are always stored in `./data/sessions`
- `LOG_LEVEL` - Logging is permanently configured
- `ALLOWED_ORIGINS` - CORS is controlled via other mechanisms

### How Environment Variables work

The application uses `dotenv/config` (see `server/index.ts` line 1), which means:

1. **Local development**: The application reads `.env` files automatically
2. **OpenShift Deployment**: Environment Variables from ConfigMaps and Secrets automatically overwrite all `.env` values
3. **Priority**: OpenShift Environment Variables > .env file > default values ​​in code

**Practical example:**
```javascript
// In der Anwendung:
process.env.SESSION_SECRET || 'default-value'

// Verhalten:
// - Lokal: Liest aus .env Datei
// - OpenShift: Verwendet ConfigMap/Secret-Werte
// - Fallback: 'default-value' wenn nichts gesetzt
```

The application **automatically** detects the environment and uses the correct values ​​without additional configuration.

```yaml
# Erstelle configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: smartredirect-config
  namespace: smartredirect-suite
data:
  NODE_ENV: "production"
  PORT: "5000"
  # Upload-Pfad (muss innerhalb von /app/data liegen)
  LOCAL_UPLOAD_PATH: "/app/data/uploads"
  # Brute-Force Schutz (optional)
  LOGIN_MAX_ATTEMPTS: "5"
  LOGIN_BLOCK_DURATION_MS: "86400000"
  # Cookie-Domain für Production (optional)
  COOKIE_DOMAIN: "smartredirect-suite-smartredirect-suite.apps.cluster.example.com"
```

```bash
# ConfigMap anwenden
oc apply -f configmap.yaml
```

## 4. Create container image

### Optimize Dockerfile for OpenShift
```dockerfile
# Erstelle Dockerfile
FROM registry.access.redhat.com/ubi8/nodejs-18:latest

# Arbeitsverzeichnis als non-root user
USER 1001
WORKDIR /app

# Package files kopieren
COPY --chown=1001:1001 package*.json ./

# Dependencies installieren
RUN npm ci --only=production && npm cache clean --force

# Anwendungscode kopieren
COPY --chown=1001:1001 . .

# Build erstellen
RUN npm run build

# Directories für persistente Volumes erstellen
# Nur /app/data nötig - Uploads werden standardmäßig in /app/data/uploads erstellt
RUN mkdir -p /app/data && \
    chmod 755 /app/data

# Port freigeben
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Anwendung starten
CMD ["npm", "start"]
```

### Create and push image
```bash
# Image lokal erstellen
docker build -t smartredirect-suite:latest .

# Demo-Image mit automatischem Reset
docker build -f Dockerfile.demo -t smartredirect-suite-demo:latest .

# Image taggen für Registry
docker tag smartredirect-suite:latest quay.io/yourorg/smartredirect-suite:v1.4

# Image zur Registry pushen
docker push quay.io/yourorg/smartredirect-suite:v1.4
```

## 5. Configure deployment

### Create DeploymentConfig
```yaml
# Erstelle deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: smartredirect-suite
  namespace: smartredirect-suite
  labels:
    app: smartredirect-suite
    version: v1.4
spec:
  replicas: 2
  selector:
    matchLabels:
      app: smartredirect-suite
  template:
    metadata:
      labels:
        app: smartredirect-suite
        version: v1.4
    spec:
      serviceAccountName: smartredirect-sa
      containers:
      - name: smartredirect-suite
        image: quay.io/yourorg/smartredirect-suite:v1.4
        ports:
        - containerPort: 5000
          protocol: TCP
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: smartredirect-config
              key: NODE_ENV
        - name: PORT
          valueFrom:
            configMapKeyRef:
              name: smartredirect-config
              key: PORT
        - name: ADMIN_PASSWORD
          valueFrom:
            secretKeyRef:
              name: smartredirect-secrets
              key: ADMIN_PASSWORD
        - name: SESSION_SECRET
          valueFrom:
            secretKeyRef:
              name: smartredirect-secrets
              key: SESSION_SECRET
        - name: LOCAL_UPLOAD_PATH
          valueFrom:
            configMapKeyRef:
              name: smartredirect-config
              key: LOCAL_UPLOAD_PATH
        - name: COOKIE_DOMAIN
          valueFrom:
            configMapKeyRef:
              name: smartredirect-config
              key: COOKIE_DOMAIN
        # Persistente Volume Mounts
        # Wichtig: Die Anwendung verwendet fest codierte Pfade relativ zum Arbeitsverzeichnis
        # /app/data - für JSON-Dateien (rules.json, tracking.json, settings.json), Sessions (/app/data/sessions)
        #           und standardmäßig auch Uploads (/app/data/uploads)
        # Nur ein Volume nötig, da Uploads standardmäßig in ./data/uploads gespeichert werden
        volumeMounts:
        - name: data-storage
          mountPath: /app/data
        # Resource Limits
        resources:
          limits:
            memory: "512Mi"
            cpu: "500m"
          requests:
            memory: "256Mi"
            cpu: "250m"
        # Health Checks
        livenessProbe:
          httpGet:
            path: /api/health
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 30
          timeoutSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 5000
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
        # Security Context
        securityContext:
          allowPrivilegeEscalation: false
          runAsNonRoot: true
          runAsUser: 1001
          readOnlyRootFilesystem: false
          capabilities:
            drop:
            - ALL
      # Persistente Volumes
      # Nur ein Volume nötig, da Uploads standardmäßig in ./data/uploads gespeichert werden
      volumes:
      - name: data-storage
        persistentVolumeClaim:
          claimName: smartredirect-data-pvc
      # Restart Policy
      restartPolicy: Always
```

```bash
# Deployment anwenden
oc apply -f deployment.yaml
```

## 6. Configure service and route

### Create service
```yaml
# Erstelle service.yaml
apiVersion: v1
kind: Service
metadata:
  name: smartredirect-suite-service
  namespace: smartredirect-suite
  labels:
    app: smartredirect-suite
spec:
  selector:
    app: smartredirect-suite
  ports:
  - name: http
    port: 80
    targetPort: 5000
    protocol: TCP
  type: ClusterIP
```

### Route for external access
```yaml
# Erstelle route.yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: smartredirect-suite-route
  namespace: smartredirect-suite
  labels:
    app: smartredirect-suite
spec:
  host: smartredirect-suite-smartredirect-suite.apps.cluster.example.com
  to:
    kind: Service
    name: smartredirect-suite-service
    weight: 100
  port:
    targetPort: http
  tls:
    termination: edge
    insecureEdgeTerminationPolicy: Redirect
  wildcardPolicy: None
```

```bash
# Service und Route anwenden
oc apply -f service.yaml
oc apply -f route.yaml
```

## 7. Monitoring und Logging

### Configure monitoring
```yaml
# Erstelle servicemonitor.yaml (falls Prometheus Operator verfügbar)
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: smartredirect-suite-monitor
  namespace: smartredirect-suite
  labels:
    app: smartredirect-suite
spec:
  selector:
    matchLabels:
      app: smartredirect-suite
  endpoints:
  - port: http
    path: /api/health
    interval: 30s
```

> The ServiceMonitor uses the health endpoint `/api/health` because the application does not provide a separate metrics endpoint.

### Logging-Konfiguration
```bash
# Log-Aggregation mit EFK Stack
oc label pod -l app=smartredirect-suite logging=enabled

# Logs anzeigen
oc logs -f deployment/smartredirect-suite
```

## 8. Backup Strategy

### Configure data backup
```bash
# Backup-Job für persistente Daten erstellen
cat > backup-job.yaml << 'EOF'
apiVersion: batch/v1
kind: CronJob
metadata:
  name: smartredirect-backup
  namespace: smartredirect-suite
spec:
  schedule: "0 2 * * *"  # Täglich um 2:00 Uhr
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: registry.access.redhat.com/ubi8/ubi:latest
            command:
            - /bin/bash
            - -c
            - |
              echo "Starting backup at $(date)"
              tar -czf /backup/smartredirect-$(date +%Y%m%d).tar.gz -C /app data
              echo "Backup completed at $(date)"
            volumeMounts:
            - name: data-storage
              mountPath: /app/data
              readOnly: true
            - name: backup-storage
              mountPath: /backup
          volumes:
          - name: data-storage
            persistentVolumeClaim:
              claimName: url-migration-data-pvc
          - name: upload-storage
            persistentVolumeClaim:
              claimName: smartredirect-uploads-pvc
          - name: backup-storage
            persistentVolumeClaim:
              claimName: backup-pvc  # Zusätzlich zu erstellen
          restartPolicy: OnFailure
  EOF

oc apply -f backup-job.yaml
```

## 9. Perform deployment

### Step-by-step deployment
```bash
# 1. Alle Konfigurationen anwenden
oc apply -f pvc-data.yaml
oc apply -f configmap.yaml
oc create secret generic smartredirect-secrets \
  --from-literal=ADMIN_PASSWORD='IhrSicheresPasswort123!' \
  --from-literal=SESSION_SECRET='super-geheimer-session-schluessel-mindestens-64-zeichen-lang'

# 2. Deployment starten
oc apply -f deployment.yaml
oc apply -f service.yaml
oc apply -f route.yaml

# 3. Deployment-Status prüfen
oc get pods -l app=smartredirect-suite
oc get pvc
oc get routes

# 4. Logs prüfen
oc logs -f deployment/smartredirect-suite
```

### Verification und Testing
```bash
# Route URL ermitteln
ROUTE_URL=$(oc get route smartredirect-suite-route -o jsonpath='{.spec.host}')
echo "Application URL: https://$ROUTE_URL"

# Health Check
curl -f https://$ROUTE_URL/api/health

# Admin-Zugang testen
curl -X POST https://$ROUTE_URL/api/admin/auth \
  -H "Content-Type: application/json" \
  -d '{"password":"IhrSicheresPasswort123!"}'
```
You can access the web interface of the admin menu via the gear symbol or under `https://$ROUTE_URL/?admin=true`.

## 10. Scaling und Performance

### Horizontal Pod Autoscaler
```yaml
# Erstelle hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: smartredirect-suite-hpa
  namespace: smartredirect-suite
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: smartredirect-suite
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Performance-Tuning
```bash
# Resource-Limits anpassen für High-Load
oc patch deployment smartredirect-suite -p='
{
  "spec": {
    "template": {
      "spec": {
        "containers": [
          {
            "name": "smartredirect-suite",
            "resources": {
              "limits": {
                "memory": "1Gi",
                "cpu": "1000m"
              },
              "requests": {
                "memory": "512Mi",
                "cpu": "500m"
              }
            }
          }
        ]
      }
    }
  }
}'
```

## 11. Troubleshooting

### Common Problems

**Pod won't start:**
```bash
# Events prüfen
oc describe pod -l app=smartredirect-suite

# Logs anzeigen
oc logs -l app=smartredirect-suite --previous

# Storage-Probleme prüfen
oc get pvc
oc describe pvc smartredirect-data-pvc
```

**Persistent data will be lost:**
```bash
# PVC-Status prüfen
oc get pvc -o wide

# Volume-Mounts verifizieren
oc describe pod -l app=smartredirect-suite | grep -A5 "Mounts:"

# Datei-Berechtigungen prüfen
oc exec -it deployment/smartredirect-suite -- ls -la /app/
```

**Performance-Probleme:**
```bash
# Resource-Verbrauch überwachen
oc top pods -l app=smartredirect-suite

# Gesundheitsstatus prüfen
curl https://$ROUTE_URL/api/health
```

## 12. Updates and Maintenance

### Rolling Updates
```bash
# Neues Image deployen
oc set image deployment/smartredirect-suite \
  smartredirect-suite=quay.io/yourorg/smartredirect-suite:v1.5

# Update-Status verfolgen
oc rollout status deployment/smartredirect-suite

# Rollback bei Problemen
oc rollout undo deployment/smartredirect-suite
```

### Maintenance window
```bash
# Wartungsmodus aktivieren (Replicas auf 0)
oc scale deployment smartredirect-suite --replicas=0

# Wartungsarbeiten durchführen...

# Service wieder aktivieren
oc scale deployment smartredirect-suite --replicas=2
```

## 13. Security

### Security Context Constraints
```yaml
# Erstelle scc.yaml (falls notwendig)
apiVersion: security.openshift.io/v1
kind: SecurityContextConstraints
metadata:
  name: smartredirect-scc
allowHostDirVolumePlugin: false
allowHostIPC: false
allowHostNetwork: false
allowHostPID: false
allowHostPorts: false
allowPrivilegedContainer: false
allowedCapabilities: null
defaultAddCapabilities: null
requiredDropCapabilities:
- ALL
runAsUser:
  type: MustRunAsRange
  uidRangeMin: 1001
  uidRangeMax: 1001
seLinuxContext:
  type: MustRunAs
users:
- system:serviceaccount:smartredirect-suite:smartredirect-sa
```

### Network Policies
```yaml
# Erstelle networkpolicy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: smartredirect-netpol
  namespace: smartredirect-suite
spec:
  podSelector:
    matchLabels:
      app: smartredirect-suite
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: openshift-ingress
    ports:
    - protocol: TCP
      port: 5000
  egress:
  - {}  # Erlaubt alle ausgehenden Verbindungen
```

## Support and further information

### Helpful OpenShift commands
```bash
# Projekt-Ressourcen anzeigen
oc get all -l app=smartredirect-suite

# Deployment-Details
oc describe deployment smartredirect-suite

# Pod-Logs live verfolgen
oc logs -f deployment/smartredirect-suite

# In Pod einloggen für Debugging
oc exec -it deployment/smartredirect-suite -- /bin/bash

# Port-Forwarding für lokale Tests
oc port-forward service/smartredirect-suite-service 8080:80
```

### Resource overview
After successful deployment you will have the following resources:
- **1 PersistentVolumeClaim** for data, sessions and uploads
- **1 deployment** with 2 replicas (scalable)
- **1 service** for internal communication
- **1 route** for external HTTPS access
- **1 ConfigMap** for application settings
- **1 Secret** for sensitive data
- **Optional**: HPA, ServiceMonitor, NetworkPolicy

### Contact and support
- **OpenShift specific questions**: Cluster Administrator
- **Application Support**: See [README.md](../README.md)
- **API integration**: See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

These instructions ensure a production-ready deployment of the SmartRedirect Suite application on OpenShift, with all necessary security and persistence features.

# OpenShift Deployment Guide - SmartRedirect Suite

> **Zielgruppe**: OpenShift-Administratoren und DevOps-Engineers. Für Standard-Installation siehe [INSTALLATION.md](./INSTALLATION.md). Für Enterprise-Features konsultieren Sie [ENTERPRISE_DEPLOYMENT.md](./ENTERPRISE_DEPLOYMENT.md).

## 📚 Verwandte Dokumentation
- **[README.md](./README.md)**: Vollständige Feature-Übersicht und Anwendungsdokumentation
- **[INSTALLATION.md](./INSTALLATION.md)**: Lokale Entwicklungsumgebung für Testing
- **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)**: REST API-Referenz für Integration
- **[ENTERPRISE_DEPLOYMENT.md](./ENTERPRISE_DEPLOYMENT.md)**: Allgemeine Enterprise-Deployment-Strategien

## Überblick

Diese Anleitung beschreibt die Bereitstellung der URL Migration Tool Anwendung auf OpenShift mit persistenter Datenspeicherung und produktionstauglicher Konfiguration.
Die Anwendung speichert alle Daten ausschließlich im Dateisystem; eine Datenbank wird nicht verwendet.

## Voraussetzungen

### OpenShift-Umgebung
- OpenShift 4.10+ (empfohlen 4.12+)
- `oc` CLI installiert und konfiguriert
- Cluster-Admin-Berechtigung oder ausreichende Projekt-Berechtigungen
- Zugriff auf eine Container Registry (z.B. quay.io, Docker Hub)

### Lokale Entwicklungstools
- Docker oder Podman für Container-Build
- Node.js 18+ für lokale Tests
- Git für Source Code Management

> Hinweis: Für Demo-Instanzen steht ein separates `Dockerfile.demo` bereit, das die Anwendung alle 24h zurücksetzt.

## 1. Projekt-Setup

### OpenShift-Projekt erstellen
```bash
# Neues Projekt erstellen
oc new-project smartredirect-suite

# Projekt als aktiv setzen
oc project smartredirect-suite

# Labels für bessere Organisation
oc label namespace smartredirect-suite app=smartredirect-suite
```

### Service Account konfigurieren
```bash
# Service Account für die Anwendung erstellen
oc create serviceaccount smartredirect-sa

# Berechtigung für Persistent Volumes
oc adm policy add-scc-to-user anyuid -z smartredirect-sa
```

## 2. Persistent Storage konfigurieren

Die Anwendung speichert Konfigurationen, Sitzungen und Uploads ausschließlich im Dateisystem. Eine Datenbank wird nicht benötigt.

### Persistent Volume Claims erstellen

**Wichtig**: Die Anwendung benötigt nur **ein** persistentes Volume für `/app/data`. Uploads werden standardmäßig in `/app/data/uploads` und Sessions in `/app/data/sessions` gespeichert.

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

### Storage-Klassen prüfen
```bash
# Verfügbare Storage-Klassen anzeigen
oc get storageclass

# Beispiel-Output:
# NAME                PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE
# gp2 (default)      kubernetes.io/aws-ebs   Delete          WaitForFirstConsumer
# gp3                kubernetes.io/aws-ebs   Delete          WaitForFirstConsumer
```

## 3. Secrets und ConfigMaps

### Application Secrets erstellen
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

### ConfigMap für Anwendungseinstellungen

**Wichtiger Hinweis**: Die Anwendung unterstützt nur spezifische Umgebungsvariablen. Hier sind die tatsächlich von der Anwendung gelesenen Variablen:

**Unterstützte Umgebungsvariablen:**
- `NODE_ENV` - Umgebung (development/production)
- `PORT` - Server-Port (Standard: 5000)
- `ADMIN_PASSWORD` - Passwort für den Administrationsbereich
- `SESSION_SECRET` - Geheimer Schlüssel für Sessions
- `LOCAL_UPLOAD_PATH` - **einziger konfigurierbarer Pfad** für Logo-Uploads (Standard: ./data/uploads – **innerhalb** des `data`-Verzeichnisses!)
- `COOKIE_DOMAIN` - Domain für Cookies (nur in Production)
- `LOGIN_MAX_ATTEMPTS` - maximale Fehlversuche bevor eine IP gesperrt wird (Standard: 5)
- `LOGIN_BLOCK_DURATION_MS` - Sperrdauer in Millisekunden nach Erreichen der Fehlversuche (Standard: 86400000)

**Nicht unterstützte Variablen** (fest codiert in der Anwendung):
- `DATA_PATH` - Daten werden immer in `./data` gespeichert
- `SESSION_PATH` - Sessions werden immer in `./data/sessions` gespeichert
- `LOG_LEVEL` - Logging ist fest konfiguriert
- `ALLOWED_ORIGINS` - CORS wird über andere Mechanismen gesteuert

### Wie Environment Variables funktionieren

Die Anwendung verwendet `dotenv/config` (siehe `server/index.ts` Zeile 1), was bedeutet:

1. **Lokale Entwicklung**: Die Anwendung liest `.env` Dateien automatisch
2. **OpenShift Deployment**: Environment Variables aus ConfigMaps und Secrets überschreiben automatisch alle `.env` Werte
3. **Priorität**: OpenShift Environment Variables > .env Datei > Default-Werte im Code

**Praktisches Beispiel:**
```javascript
// In der Anwendung:
process.env.SESSION_SECRET || 'default-value'

// Verhalten:
// - Lokal: Liest aus .env Datei
// - OpenShift: Verwendet ConfigMap/Secret-Werte
// - Fallback: 'default-value' wenn nichts gesetzt
```

Die Anwendung **erkennt automatisch** die Umgebung und verwendet die korrekten Werte ohne zusätzliche Konfiguration.

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

## 4. Container Image erstellen

### Dockerfile für OpenShift optimieren
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

### Image erstellen und pushen
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

## 5. Deployment konfigurieren

### DeploymentConfig erstellen
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

## 6. Service und Route konfigurieren

### Service erstellen
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

### Route für externen Zugriff
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

### Monitoring konfigurieren
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

> Der ServiceMonitor nutzt den Gesundheitsendpunkt `/api/health`, da die Anwendung keinen separaten Metrik-Endpunkt bereitstellt.

### Logging-Konfiguration
```bash
# Log-Aggregation mit EFK Stack
oc label pod -l app=smartredirect-suite logging=enabled

# Logs anzeigen
oc logs -f deployment/smartredirect-suite
```

## 8. Backup-Strategie

### Daten-Backup konfigurieren
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

## 9. Deployment durchführen

### Schritt-für-Schritt Deployment
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

### Häufige Probleme

**Pod startet nicht:**
```bash
# Events prüfen
oc describe pod -l app=smartredirect-suite

# Logs anzeigen
oc logs -l app=smartredirect-suite --previous

# Storage-Probleme prüfen
oc get pvc
oc describe pvc smartredirect-data-pvc
```

**Persistente Daten gehen verloren:**
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

## 12. Updates und Wartung

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

### Wartungs-Fenster
```bash
# Wartungsmodus aktivieren (Replicas auf 0)
oc scale deployment smartredirect-suite --replicas=0

# Wartungsarbeiten durchführen...

# Service wieder aktivieren
oc scale deployment smartredirect-suite --replicas=2
```

## 13. Sicherheit

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

## Support und Weiterführende Informationen

### Hilfreiche OpenShift-Kommandos
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

### Ressourcen-Übersicht
Nach erfolgreichem Deployment haben Sie folgende Ressourcen:
- **1 PersistentVolumeClaim** für Daten, Sessions und Uploads
- **1 Deployment** mit 2 Replicas (skalierbar)
- **1 Service** für interne Kommunikation
- **1 Route** für externen HTTPS-Zugriff
- **1 ConfigMap** für Anwendungseinstellungen
- **1 Secret** für sensible Daten
- **Optional**: HPA, ServiceMonitor, NetworkPolicy

### Kontakt und Support
- **OpenShift-spezifische Fragen**: Cluster-Administrator
- **Anwendungssupport**: Siehe [README.md](./README.md)
- **API-Integration**: Siehe [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

Diese Anleitung stellt eine produktionstaugliche Bereitstellung der SmartRedirect Suite Anwendung auf OpenShift sicher, mit allen notwendigen Sicherheits- und Persistierung-Features.

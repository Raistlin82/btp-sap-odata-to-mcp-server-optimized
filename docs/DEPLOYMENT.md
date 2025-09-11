# Deployment Guide

> **Reference to Original Project**  
> This deployment guide builds upon [@lemaiwo](https://github.com/lemaiwo)'s [btp-sap-odata-to-mcp-server](https://github.com/lemaiwo/btp-sap-odata-to-mcp-server) with enterprise deployment patterns and best practices.

## 🚀 Deployment Overview

The SAP OData MCP Server supports multiple deployment targets with optimized configurations for each environment:

1. **SAP BTP Cloud Foundry** (Recommended for Production)
2. **Local Development** (For testing and development)
3. **Docker Containers** (For hybrid cloud deployments)
4. **Kubernetes** (For enterprise container orchestration)

## ☁️ SAP BTP Cloud Foundry Deployment

### Prerequisites

#### Required SAP BTP Services

```bash
# 1. XSUAA Service (Authentication & Authorization)
cf create-service xsuaa application sap-mcp-xsuaa -c xs-security.json

# 2. Connectivity Service (SAP System Access)
cf create-service connectivity lite sap-mcp-connectivity

# 3. Destination Service (Connection Configuration)
cf create-service destination lite sap-mcp-destination  

# 4. Cloud Logging Service (Centralized Logging)
cf create-service cloud-logging dev sap-mcp-cloud-logging
```

#### Required BTP Entitlements

Ensure the following services are entitled in your BTP subaccount:

- **Connectivity Service** (lite or standard)
- **Destination Service** (lite or standard)  
- **Authorization & Trust Management Service** (application plan)
- **SAP Cloud Logging** (dev or standard)
- **Identity Authentication Service** (External IdP)

### Step-by-Step Deployment

#### 1. Prepare the Application

```bash
# Clone the repository
git clone <your-playground-repo>
cd btp-sap-odata-to-mcp-server-optimized

# Install dependencies
npm install

# Build the application
npm run build
```

#### 2. Configure Service Instances

**Create xs-security.json:**

```json
{
  "xsappname": "sap-mcp-server",
  "tenant-mode": "dedicated", 
  "description": "SAP OData MCP Server Security",
  "scopes": [
    {
      "name": "$XSAPPNAME.read",
      "description": "Read access to SAP data"
    },
    {
      "name": "$XSAPPNAME.write",
      "description": "Write access to SAP data"
    },
    {
      "name": "$XSAPPNAME.delete", 
      "description": "Delete access to SAP data"
    },
    {
      "name": "$XSAPPNAME.admin",
      "description": "Administrative access"
    }
  ],
  "role-templates": [
    {
      "name": "MCPUser",
      "description": "Standard MCP User",
      "scope-references": ["$XSAPPNAME.read", "$XSAPPNAME.write"]
    },
    {
      "name": "MCPAdmin", 
      "description": "MCP Administrator",
      "scope-references": [
        "$XSAPPNAME.read", "$XSAPPNAME.write", 
        "$XSAPPNAME.delete", "$XSAPPNAME.admin"
      ]
    }
  ],
  "role-collections": [
    {
      "name": "MCPAdministrator",
      "description": "MCP Administrator Collection",
      "role-template-references": ["$XSAPPNAME.MCPAdmin"]
    },
    {
      "name": "MCPUser",
      "description": "MCP User Collection", 
      "role-template-references": ["$XSAPPNAME.MCPUser"]
    }
  ]
}
```

**Create services:**

```bash
# Create XSUAA service with security configuration
cf create-service xsuaa application sap-mcp-xsuaa -c xs-security.json

# Create other required services
cf create-service connectivity lite sap-mcp-connectivity
cf create-service destination lite sap-mcp-destination
cf create-service cloud-logging dev sap-mcp-cloud-logging

# Verify service creation
cf services
```

#### 3. Configure Application Manifest

**Create manifest.yml:**

```yaml
---
applications:
- name: sap-mcp-server-prod
  path: .
  memory: 512M
  disk_quota: 1G
  instances: 1
  health-check-type: http
  health-check-http-endpoint: /health
  health-check-invocation-timeout: 60
  timeout: 180
  stack: cflinuxfs4
  buildpacks:
    - nodejs_buildpack
  env:
    NODE_ENV: production
    LOG_LEVEL: info
    ENABLE_HEALTH_CHECKS: true
    SESSION_TIMEOUT: 3600000
    CACHE_TTL: 1800000
  services:
    - sap-mcp-xsuaa
    - sap-mcp-connectivity
    - sap-mcp-destination
    - sap-mcp-cloud-logging
  routes:
    - route: your-app-name.cfapps.region.hana.ondemand.com
```

#### 4. Set Environment Variables

```bash
# Set SAP IAS configuration
cf set-env sap-mcp-server-prod SAP_IAS_URL "https://your-tenant.accounts.ondemand.com"
cf set-env sap-mcp-server-prod SAP_IAS_CLIENT_ID "your-client-id"
cf set-env sap-mcp-server-prod SAP_IAS_CLIENT_SECRET "your-client-secret"

# Set optional performance settings
cf set-env sap-mcp-server-prod CONNECTION_POOL_SIZE "10"
cf set-env sap-mcp-server-prod CACHE_TTL "1800000"
cf set-env sap-mcp-server-prod SESSION_TIMEOUT "3600000"
```

#### 5. Deploy Application

```bash
# Deploy to Cloud Foundry
cf push

# Verify deployment
cf apps
cf app sap-mcp-server-prod

# Check application health
curl https://your-app.cfapps.region.hana.ondemand.com/health
```

#### 6. Configure Role Collections

**In SAP BTP Cockpit:**

1. Navigate to **Security → Role Collections**
2. Create role collections:
   - **MCPAdministrator**: Full access
   - **MCPUser**: Standard user access  
   - **MCPReadOnly**: Read-only access

3. Assign role collections to users:
   - Go to **Security → Users**
   - Select user and assign appropriate role collection

#### 7. Configure Destinations

**Create destinations in BTP Cockpit:**

```json
{
  "Name": "S4HANA_SYSTEM",
  "Type": "HTTP", 
  "URL": "https://your-s4hana-system.com",
  "Authentication": "PrincipalPropagation",
  "ProxyType": "OnPremise",
  "Description": "SAP S/4HANA On-Premise System",
  "TrustAll": "false"
}
```

### Production Deployment Checklist

- [ ] All required services created and bound
- [ ] Environment variables configured
- [ ] Role collections created and assigned
- [ ] Destinations configured with proper authentication
- [ ] Health checks passing
- [ ] Logging service configured and receiving logs
- [ ] Security scan completed
- [ ] Performance testing completed
- [ ] Backup and recovery procedures documented

## 🏠 Local Development Setup

### Prerequisites

```bash
# Install Node.js 18+
node --version

# Install Cloud Foundry CLI
cf --version

# Install development tools
npm install -g nodemon tsx
```

### Development Environment Setup

#### 1. Clone and Install

```bash
git clone <your-playground-repo>
cd btp-sap-odata-to-mcp-server-optimized
npm install
```

#### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit configuration
nano .env
```

**Example .env for local development:**

```env
# Development Configuration
NODE_ENV=development
PORT=8080
LOG_LEVEL=debug

# SAP IAS Configuration (use development tenant)
SAP_IAS_URL=https://your-dev-tenant.accounts.ondemand.com
SAP_IAS_CLIENT_ID=dev-client-id
SAP_IAS_CLIENT_SECRET=dev-client-secret

# Development Features
ENABLE_DEBUG_ROUTES=true
ENABLE_CORS=true
HOT_RELOAD=true
MOCK_SAP_SERVICES=false

# Local Overrides
CORS_ORIGINS=http://localhost:*,https://claude.ai
TRUST_PROXY=false
```

#### 3. Local Service Setup

For local development without BTP services:

```bash
# Use local service mocks (optional)
export MOCK_AUTHENTICATION=false
export MOCK_SAP_SERVICES=false

# Or connect to BTP services via service keys
cf create-service-key sap-mcp-xsuaa dev-key
cf service-key sap-mcp-xsuaa dev-key
```

#### 4. Start Development Server

```bash
# Start with hot reload
npm run dev

# Start with debug logging  
npm run dev:debug

# Start with file watching
npm run dev:watch
```

#### 5. Verify Local Setup

```bash
# Check health endpoint
curl http://localhost:8080/health

# Check authentication status
curl http://localhost:8080/auth/status

# Access web interface
open http://localhost:8080/auth/
```

### Development Workflow

```bash
# 1. Make code changes
# 2. Tests run automatically (if configured)
# 3. Application reloads automatically
# 4. Test changes locally
# 5. Deploy to dev environment

# Push to development space
cf target -s dev
cf push sap-mcp-server-dev

# Test in development environment
curl https://sap-mcp-server-dev.cfapps.region.hana.ondemand.com/health
```

## 🐳 Docker Deployment

### Docker Configuration

**Dockerfile:**

```dockerfile
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start application
CMD ["node", "dist/index.js"]
```

**docker-compose.yml for local development:**

```yaml
version: '3.8'

services:
  sap-mcp-server:
    build: .
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
      - SAP_IAS_URL=${SAP_IAS_URL}
      - SAP_IAS_CLIENT_ID=${SAP_IAS_CLIENT_ID}
      - SAP_IAS_CLIENT_SECRET=${SAP_IAS_CLIENT_SECRET}
    volumes:
      - ./src:/app/src
      - ./public:/app/public
    depends_on:
      - redis
      - postgres

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: mcpserver
      POSTGRES_USER: mcpuser
      POSTGRES_PASSWORD: mcppass
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  redis_data:
  postgres_data:
```

### Build and Deploy Docker Image

```bash
# Build image
docker build -t sap-mcp-server:latest .

# Run locally
docker run -p 8080:8080 \
  -e SAP_IAS_URL="your-ias-url" \
  -e SAP_IAS_CLIENT_ID="your-client-id" \
  -e SAP_IAS_CLIENT_SECRET="your-client-secret" \
  sap-mcp-server:latest

# Run with docker-compose
docker-compose up -d

# Check health
curl http://localhost:8080/health
```

## ☸️ Kubernetes Deployment

### Kubernetes Configuration

**namespace.yaml:**

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: sap-mcp-server
```

**configmap.yaml:**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: sap-mcp-server-config
  namespace: sap-mcp-server
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  PORT: "8080"
  ENABLE_HEALTH_CHECKS: "true"
  SESSION_TIMEOUT: "3600000"
```

**secret.yaml:**

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: sap-mcp-server-secrets
  namespace: sap-mcp-server
type: Opaque
stringData:
  SAP_IAS_URL: "https://your-tenant.accounts.ondemand.com"
  SAP_IAS_CLIENT_ID: "your-client-id"
  SAP_IAS_CLIENT_SECRET: "your-client-secret"
```

**deployment.yaml:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sap-mcp-server
  namespace: sap-mcp-server
  labels:
    app: sap-mcp-server
spec:
  replicas: 2
  selector:
    matchLabels:
      app: sap-mcp-server
  template:
    metadata:
      labels:
        app: sap-mcp-server
    spec:
      containers:
      - name: sap-mcp-server
        image: sap-mcp-server:latest
        ports:
        - containerPort: 8080
        envFrom:
        - configMapRef:
            name: sap-mcp-server-config
        - secretRef:
            name: sap-mcp-server-secrets
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 15
          periodSeconds: 15
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

**service.yaml:**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: sap-mcp-server-service
  namespace: sap-mcp-server
spec:
  selector:
    app: sap-mcp-server
  ports:
  - port: 80
    targetPort: 8080
  type: ClusterIP
```

**ingress.yaml:**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: sap-mcp-server-ingress
  namespace: sap-mcp-server
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - sap-mcp-server.your-domain.com
    secretName: sap-mcp-server-tls
  rules:
  - host: sap-mcp-server.your-domain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: sap-mcp-server-service
            port:
              number: 80
```

### Deploy to Kubernetes

```bash
# Apply all configurations
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml

# Verify deployment
kubectl get pods -n sap-mcp-server
kubectl get services -n sap-mcp-server
kubectl get ingress -n sap-mcp-server

# Check application logs
kubectl logs -f deployment/sap-mcp-server -n sap-mcp-server

# Check health
kubectl port-forward service/sap-mcp-server-service 8080:80 -n sap-mcp-server
curl http://localhost:8080/health
```

## 📊 Monitoring & Observability

### Health Check Monitoring

```bash
# Cloud Foundry health checks
cf apps
cf app sap-mcp-server-prod --guid
cf curl /v2/apps/APP_GUID/stats

# Custom health monitoring script
#!/bin/bash
APP_URL="https://your-app.cfapps.region.hana.ondemand.com"

while true; do
  HEALTH=$(curl -s "$APP_URL/health" | jq -r '.status')
  if [ "$HEALTH" != "healthy" ]; then
    echo "ALERT: Application health check failed: $HEALTH"
    # Send notification
  fi
  sleep 60
done
```

### Log Analysis

```bash
# Cloud Foundry logs
cf logs sap-mcp-server-prod --recent
cf logs sap-mcp-server-prod

# SAP Cloud Logging dashboard
# Access via BTP Cockpit → Services → Cloud Logging → Open Dashboard
```

### Performance Monitoring

```bash
# Application metrics endpoint
curl https://your-app.cfapps.region.hana.ondemand.com/metrics

# Cloud Foundry app stats
cf app sap-mcp-server-prod
```

## 🔄 CI/CD Pipeline

### Example GitHub Actions Workflow

**.github/workflows/deploy.yml:**

```yaml
name: Deploy SAP MCP Server

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    - run: npm ci
    - run: npm test
    - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
    - uses: actions/checkout@v3
    - name: Setup Cloud Foundry CLI
      run: |
        wget -O cf.tgz "https://cli.run.pivotal.io/stable?release=linux64-binary"
        tar -xzf cf.tgz
        sudo mv cf /usr/local/bin
    - name: Deploy to SAP BTP
      run: |
        cf api ${{ secrets.CF_API_URL }}
        cf login -u ${{ secrets.CF_USERNAME }} -p ${{ secrets.CF_PASSWORD }} -o ${{ secrets.CF_ORG }} -s ${{ secrets.CF_SPACE }}
        npm run build
        cf push
      env:
        SAP_IAS_CLIENT_SECRET: ${{ secrets.SAP_IAS_CLIENT_SECRET }}
```

## 🛡️ Security Considerations

### Production Security Checklist

- [ ] **Environment Variables**: No secrets in code or logs
- [ ] **HTTPS Only**: All traffic encrypted in transit
- [ ] **Security Headers**: Helmet.js configured with strict policies
- [ ] **Authentication**: Multi-factor authentication enabled
- [ ] **Authorization**: Role-based access control implemented
- [ ] **Rate Limiting**: API rate limiting enabled
- [ ] **Audit Logging**: All access attempts logged
- [ ] **Vulnerability Scanning**: Regular security scans performed
- [ ] **Dependency Updates**: Automated security updates enabled

### Security Hardening

```bash
# Set security environment variables
cf set-env sap-mcp-server-prod HELMET_ENABLED "true"
cf set-env sap-mcp-server-prod HIDE_POWERED_BY "true"
cf set-env sap-mcp-server-prod TRUST_PROXY "1"
cf set-env sap-mcp-server-prod ENABLE_RATE_LIMITING "true"

# Disable debug routes in production
cf set-env sap-mcp-server-prod ENABLE_DEBUG_ROUTES "false"
cf set-env sap-mcp-server-prod ENABLE_ADMIN_INTERFACE "false"
```

## 🔧 Troubleshooting Deployment Issues

### Common Issues and Solutions

#### 1. Service Binding Issues

```bash
# Check service binding
cf env sap-mcp-server-prod | grep VCAP_SERVICES

# Recreate service binding
cf unbind-service sap-mcp-server-prod sap-mcp-xsuaa
cf bind-service sap-mcp-server-prod sap-mcp-xsuaa
cf restage sap-mcp-server-prod
```

#### 2. Memory/Resource Issues

```bash
# Check application stats
cf app sap-mcp-server-prod

# Increase memory allocation
cf scale sap-mcp-server-prod -m 1G

# Restart application
cf restart sap-mcp-server-prod
```

#### 3. Health Check Failures

```bash
# Check health endpoint manually
curl https://your-app.cfapps.region.hana.ondemand.com/health

# Check application logs
cf logs sap-mcp-server-prod --recent

# Adjust health check timeout
# In manifest.yml: health-check-invocation-timeout: 120
```

---

**📖 Related Documentation**:
- [Configuration Guide](CONFIGURATION.md)
- [Architecture Overview](ARCHITECTURE.md)
- [API Reference](API_REFERENCE.md)
- [Troubleshooting](TROUBLESHOOTING.md)
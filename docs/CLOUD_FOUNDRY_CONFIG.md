# 📘 Configurazione Cloud Foundry per OData Discovery

## 🚀 **Come Configurare le Variabili su Cloud Foundry**

### **1. Via CF CLI (Raccomandato)**

```bash
# Login a Cloud Foundry
cf login -a https://api.cf.eu30.hana.ondemand.com

# Seleziona org e space
cf target -o your-org -s your-space

# Imposta le variabili per il nuovo sistema
cf set-env btp-sap-odata-to-mcp-server ODATA_DISCOVERY_MODE pattern
cf set-env btp-sap-odata-to-mcp-server ODATA_INCLUDE_PATTERNS "*API*,Z*"
cf set-env btp-sap-odata-to-mcp-server ODATA_EXCLUDE_PATTERNS "*_TEST*,*_TEMP*,*_DEBUG*,*_INTERNAL*"
cf set-env btp-sap-odata-to-mcp-server ODATA_MAX_SERVICES 50
cf set-env btp-sap-odata-to-mcp-server ODATA_REFRESH_INTERVAL 1h

# Riavvia l'applicazione per applicare le modifiche
cf restage btp-sap-odata-to-mcp-server
```

### **2. Via manifest.yml (Per Deployment)**

```yaml
applications:
- name: btp-sap-odata-to-mcp-server
  memory: 512M
  buildpacks:
  - nodejs_buildpack
  env:
    # OData Discovery Configuration (Simplified)
    ODATA_DISCOVERY_MODE: pattern
    ODATA_INCLUDE_PATTERNS: "*API*,Z*"
    ODATA_EXCLUDE_PATTERNS: "*_TEST*,*_TEMP*,*_DEBUG*,*_INTERNAL*"
    ODATA_MAX_SERVICES: 50
    ODATA_REFRESH_INTERVAL: 1h

    # Authentication Configuration
    SAP_IAS_URL: https://afhdupfoc.accounts.ondemand.com
    SAP_IAS_CLIENT_ID: 955d133c-758b-42c7-b1a5-fa99cd5e6661
    # Note: Use user-provided service for secrets

    # CORS Configuration
    CORS_ORIGINS: https://windtre.it,https://wind-tre-s-p-a--burrata-noprod-8cs9fy8w-mcp-noprod-spac37b2ce9c.cfapps.eu30.hana.ondemand.com
```

### **3. Via User-Provided Service (Per Secrets)**

```bash
# Crea un user-provided service per i secrets
cf cups odata-discovery-config -p '{
  "ODATA_DISCOVERY_MODE": "pattern",
  "ODATA_INCLUDE_PATTERNS": "*API*,Z*",
  "ODATA_EXCLUDE_PATTERNS": "*_TEST*,*_TEMP*,*_DEBUG*,*_INTERNAL*",
  "ODATA_MAX_SERVICES": "50",
  "ODATA_REFRESH_INTERVAL": "1h",
  "SAP_IAS_CLIENT_SECRET": "y]cW]AMYnJlYc-ArV[9CJYABtBfBQK"
}'

# Bind del servizio all'applicazione
cf bind-service btp-sap-odata-to-mcp-server odata-discovery-config

# Riavvia per applicare
cf restage btp-sap-odata-to-mcp-server
```

## 📊 **Mapping: Configurazione Vecchia → Nuova**

| Configurazione Vecchia | Configurazione Nuova | Valore Cloud Foundry |
|------------------------|---------------------|---------------------|
| `ODATA_ALLOW_ALL=false` | Non più necessario | Rimuovere |
| `ODATA_DISCOVERY_MODE=whitelist` | `ODATA_DISCOVERY_MODE=pattern` | `"pattern"` |
| `ODATA_SERVICE_PATTERNS=*API*,Z*` | `ODATA_INCLUDE_PATTERNS=*API*,Z*` | `"*API*,Z*"` |
| `ODATA_EXCLUSION_PATTERNS=*_TEST*,*_TEMP*` | `ODATA_EXCLUDE_PATTERNS=*_TEST*,*_TEMP*,*_DEBUG*,*_INTERNAL*` | `"*_TEST*,*_TEMP*,*_DEBUG*,*_INTERNAL*"` |
| `ODATA_MAX_SERVICES=500` | `ODATA_MAX_SERVICES=50` | `"50"` |
| - | `ODATA_REFRESH_INTERVAL=1h` | `"1h"` (nuovo) |

## 🎯 **Configurazioni per Ambiente**

### **Development Space**
```bash
cf set-env btp-sap-odata-to-mcp-server ODATA_DISCOVERY_MODE environment
cf set-env btp-sap-odata-to-mcp-server NODE_ENV development
# Automaticamente include tutti i servizi (max 100)
```

### **Test/QA Space**
```bash
cf set-env btp-sap-odata-to-mcp-server ODATA_DISCOVERY_MODE pattern
cf set-env btp-sap-odata-to-mcp-server ODATA_INCLUDE_PATTERNS "*TEST*,*DEMO*,*QA*"
cf set-env btp-sap-odata-to-mcp-server ODATA_MAX_SERVICES 30
```

### **Production Space**
```bash
cf set-env btp-sap-odata-to-mcp-server ODATA_DISCOVERY_MODE environment
cf set-env btp-sap-odata-to-mcp-server NODE_ENV production
cf set-env btp-sap-odata-to-mcp-server ODATA_PRODUCTION_SERVICES "CustomerService,SalesOrderService,MaterialService"
# Solo servizi whitelisted
```

## 🔧 **Script di Migrazione per CF**

Crea un file `migrate-cf-config.sh`:

```bash
#!/bin/bash

# Configuration
APP_NAME="btp-sap-odata-to-mcp-server"
CF_API="https://api.cf.eu30.hana.ondemand.com"
ORG="your-org"
SPACE="your-space"

echo "🔄 Migrating Cloud Foundry Configuration..."

# Login
cf login -a $CF_API -o $ORG -s $SPACE

# Remove old environment variables
echo "🗑️ Removing old configuration..."
cf unset-env $APP_NAME ODATA_ALLOW_ALL

# Set new environment variables
echo "✅ Setting new configuration..."
cf set-env $APP_NAME ODATA_DISCOVERY_MODE pattern
cf set-env $APP_NAME ODATA_INCLUDE_PATTERNS "*API*,Z*"
cf set-env $APP_NAME ODATA_EXCLUDE_PATTERNS "*_TEST*,*_TEMP*,*_DEBUG*,*_INTERNAL*"
cf set-env $APP_NAME ODATA_MAX_SERVICES 50
cf set-env $APP_NAME ODATA_REFRESH_INTERVAL 1h

# Show current configuration
echo "📋 Current configuration:"
cf env $APP_NAME | grep ODATA_

# Restage application
echo "🚀 Restaging application..."
cf restage $APP_NAME

echo "✅ Migration complete!"
```

## 🛡️ **Best Practices per Cloud Foundry**

### **1. Usa User-Provided Services per Secrets**
```bash
# Non mettere secrets nel manifest.yml
cf cups secrets-service -p '{
  "SAP_IAS_CLIENT_SECRET": "your-secret",
  "OTHER_SENSITIVE_DATA": "value"
}'
```

### **2. Usa Config per Ambiente Diverso**
```yaml
# manifest-dev.yml
applications:
- name: btp-sap-odata-to-mcp-server-dev
  env:
    ODATA_DISCOVERY_MODE: environment
    NODE_ENV: development

# manifest-prod.yml
applications:
- name: btp-sap-odata-to-mcp-server
  env:
    ODATA_DISCOVERY_MODE: environment
    NODE_ENV: production
    ODATA_PRODUCTION_SERVICES: "CustomerService,SalesOrderService"
```

### **3. Verifica la Configurazione**
```bash
# Verifica le variabili impostate
cf env btp-sap-odata-to-mcp-server

# Controlla i log per vedere la discovery in azione
cf logs btp-sap-odata-to-mcp-server --recent | grep "Discovery"
```

## 📈 **Monitoraggio e Troubleshooting**

### **Verificare che la Discovery Funzioni**
```bash
# Tail dei log
cf logs btp-sap-odata-to-mcp-server

# Cerca questi messaggi:
# "Starting pattern discovery..."
# "Discovery completed: 25 services found"
# "Pattern filtering: 25/100 services matched"
```

### **Problemi Comuni**

**1. Nessun servizio trovato:**
```bash
# Controlla i pattern
cf env btp-sap-odata-to-mcp-server | grep ODATA_INCLUDE_PATTERNS
# Assicurati che i pattern corrispondano ai tuoi servizi
```

**2. Troppi servizi trovati:**
```bash
# Riduci il limite
cf set-env btp-sap-odata-to-mcp-server ODATA_MAX_SERVICES 20
cf restage btp-sap-odata-to-mcp-server
```

**3. Performance lente:**
```bash
# Aumenta l'intervallo di cache
cf set-env btp-sap-odata-to-mcp-server ODATA_REFRESH_INTERVAL 6h
```

## 🚀 **Quick Start per Cloud Foundry**

### **Opzione 1: Copia-Incolla Rapido**
```bash
# Esegui questi comandi uno per uno
cf set-env btp-sap-odata-to-mcp-server ODATA_DISCOVERY_MODE pattern
cf set-env btp-sap-odata-to-mcp-server ODATA_INCLUDE_PATTERNS "*API*,Z*"
cf set-env btp-sap-odata-to-mcp-server ODATA_EXCLUDE_PATTERNS "*_TEST*,*_TEMP*,*_DEBUG*,*_INTERNAL*"
cf set-env btp-sap-odata-to-mcp-server ODATA_MAX_SERVICES 50
cf restage btp-sap-odata-to-mcp-server
```

### **Opzione 2: Business Mode (Più Semplice)**
```bash
# Per utenti business
cf set-env btp-sap-odata-to-mcp-server ODATA_DISCOVERY_MODE business
cf set-env btp-sap-odata-to-mcp-server ODATA_BUSINESS_DOMAINS "sales,finance"
cf set-env btp-sap-odata-to-mcp-server ODATA_MAX_SERVICES 30
cf restage btp-sap-odata-to-mcp-server
```

## ✅ **Checklist di Migrazione**

- [ ] Backup della configurazione attuale: `cf env btp-sap-odata-to-mcp-server > backup-config.txt`
- [ ] Rimuovi variabili legacy: `cf unset-env btp-sap-odata-to-mcp-server ODATA_ALLOW_ALL`
- [ ] Imposta nuove variabili ODATA_DISCOVERY_MODE
- [ ] Imposta pattern di inclusione/esclusione
- [ ] Imposta limite servizi (ODATA_MAX_SERVICES)
- [ ] Restage applicazione
- [ ] Verifica logs per conferma discovery
- [ ] Test funzionalità con nuovo sistema

## 📝 **Note Importanti**

1. **Le variabili nel file .env locale hanno precedenza durante lo sviluppo locale**
2. **Le variabili CF hanno precedenza quando deployed su Cloud Foundry**
3. **Usa user-provided services per secrets sensibili**
4. **Testa sempre in development space prima di production**
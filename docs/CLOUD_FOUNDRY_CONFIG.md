# Cloud Foundry Configuration - Current Environment

> **🔗 Reference to Original Project**  
> This documents the actual Cloud Foundry configuration for [@lemaiwo](https://github.com/lemaiwo)'s enhanced [btp-sap-odata-to-mcp-server](https://github.com/lemaiwo/btp-sap-odata-to-mcp-server).

## 🌐 Current Environment Details

### Application Information
- **App Name**: `sap-mcp-server-mcp_noprod_space`
- **Space**: `mcp_noprod_space`
- **Organization**: `Wind Tre S.p.A._burrata-noprod-8cs9fy8w`
- **URL**: https://wind-tre-s-p-a--burrata-noprod-8cs9fy8w-mcp-noprod-spac37b2ce9c.cfapps.eu30.hana.ondemand.com

## 🔧 Environment Variables (Currently Set)

### Core Configuration
```bash
# Logging Configuration
LOG_LEVEL=debug

# Note: Most configuration comes from service bindings (VCAP_SERVICES)
# rather than explicit environment variables
```

### Service Bindings (VCAP_SERVICES)

#### 1. SAP IAS Configuration
```json
{
  "SAP_IAS_URL": "https://afhdupfoc.accounts.ondemand.com",
  "SAP_IAS_CLIENT_ID": "955d133c-758b-42c7-b1a5-fa99cd5e6661",
  "SAP_IAS_CLIENT_SECRET": "[CONFIGURED VIA VCAP_SERVICES]"
}
```

#### 2. XSUAA Service Binding
- **Service Name**: `sap-mcp-xsuaa`
- **Plan**: `application`
- **Configuration**: Based on `xs-security.json`

#### 3. Connectivity Service
- **Service Name**: `sap-mcp-connectivity` 
- **Plan**: `lite`
- **Purpose**: SAP system connectivity

#### 4. Destination Service
- **Service Name**: `sap-mcp-destination`
- **Plan**: `lite` 
- **Purpose**: Destination configuration management

#### 5. Cloud Logging Service
- **Service Name**: `sap-mcp-cloud-logging`
- **Plan**: `dev`
- **Status**: ✅ Healthy
- **Dashboard**: Available via service credentials

## 🔐 Role Collections (Actual Configuration)

Based on the current `xs-security.json`, these are the **actual** role collections:

### 1. MCPAdministrator
- **Description**: Full administrative access to SAP MCP OData Server
- **Includes**: All permissions (read, write, delete, admin, discover)
- **Role Template**: `MCPAdmin`

### 2. MCPUser  
- **Description**: Standard user access to SAP MCP OData Server
- **Includes**: Read, write, and discover permissions
- **Role Template**: `MCPEditor`

### 3. MCPManager
- **Description**: Manager access with delete permissions to SAP MCP OData Server  
- **Includes**: Read, write, delete, and discover permissions
- **Role Template**: `MCPManager`

### 4. MCPViewer
- **Description**: Read-only access to SAP MCP OData Server
- **Includes**: Read and discover permissions only
- **Role Template**: `MCPViewer`

### Role Hierarchy
```
MCPAdministrator > MCPManager > MCPUser > MCPViewer
     (admin)        (delete)      (write)    (read)
```

## 📊 Health Status (Current)

### System Health
```json
{
  "status": "healthy",
  "checks": {
    "connectivity": "healthy",
    "authentication": "healthy", 
    "services": "healthy",
    "memory": "healthy",
    "cloudLogging": "healthy"
  }
}
```

### Service Status
- **✅ XSUAA Service**: Bound and healthy
- **✅ Connectivity Service**: Bound and healthy  
- **✅ Destination Service**: Bound and healthy
- **✅ Cloud Logging Service**: Bound and healthy

## 🔄 Configuration Commands (For Reference)

### View Current Environment
```bash
# Check app status
cf app sap-mcp-server-mcp_noprod_space

# View environment variables
cf env sap-mcp-server-mcp_noprod_space

# Check service bindings
cf services
```

### Update Configuration
```bash
# Set environment variable
cf set-env sap-mcp-server-mcp_noprod_space LOG_LEVEL "info"

# Restart app to apply changes
cf restart sap-mcp-server-mcp_noprod_space
```

### Service Management
```bash
# Check service status
cf service sap-mcp-xsuaa
cf service sap-mcp-connectivity
cf service sap-mcp-destination  
cf service sap-mcp-cloud-logging

# Update service (if needed)
cf update-service sap-mcp-xsuaa -c xs-security.json
```

## 🏗️ Deployment Configuration

### Current manifest.yml (Equivalent)
```yaml
applications:
- name: sap-mcp-server-mcp_noprod_space
  memory: 512M
  disk_quota: 1G
  instances: 1
  health-check-type: http
  health-check-http-endpoint: /health
  env:
    LOG_LEVEL: debug
  services:
    - sap-mcp-xsuaa
    - sap-mcp-connectivity
    - sap-mcp-destination
    - sap-mcp-cloud-logging
```

## 🚀 Access Information

### Application URLs
- **Main App**: https://wind-tre-s-p-a--burrata-noprod-8cs9fy8w-mcp-noprod-spac37b2ce9c.cfapps.eu30.hana.ondemand.com
- **Authentication**: https://wind-tre-s-p-a--burrata-noprod-8cs9fy8w-mcp-noprod-spac37b2ce9c.cfapps.eu30.hana.ondemand.com/auth/
- **Health Check**: https://wind-tre-s-p-a--burrata-noprod-8cs9fy8w-mcp-noprod-spac37b2ce9c.cfapps.eu30.hana.ondemand.com/health

### Authentication URLs  
- **SAP IAS**: https://afhdupfoc.accounts.ondemand.com
- **Client ID**: 955d133c-758b-42c7-b1a5-fa99cd5e6661

## 🔍 Monitoring

### Log Access
```bash
# View recent logs
cf logs sap-mcp-server-mcp_noprod_space --recent

# Follow live logs  
cf logs sap-mcp-server-mcp_noprod_space
```

### SAP Cloud Logging Dashboard
- **Access**: Via BTP Cockpit → Services → Cloud Logging → Open Dashboard
- **Credentials**: Available in service binding
- **Status**: ✅ Active and receiving structured logs

## ⚠️ Important Notes

### Configuration Differences from Documentation
1. **Environment Variables**: Most configuration comes from service bindings, not explicit env vars
2. **Role Collections**: Use the exact names defined in `xs-security.json`
3. **URL Format**: BTP generates specific URL patterns for the space/org

### Best Practices Applied
1. **Service Binding**: Configuration via VCAP_SERVICES (more secure)
2. **Role Collections**: Granular permissions with clear hierarchy  
3. **Health Checks**: HTTP endpoint for platform monitoring
4. **Logging**: Structured JSON logging to SAP Cloud Logging

---

**📖 Related Documentation**:
- [Main Configuration Guide](CONFIGURATION.md)
- [Deployment Guide](DEPLOYMENT.md)
- [API Reference](API_REFERENCE.md)
- [Troubleshooting](TROUBLESHOOTING.md)
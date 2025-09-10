# 🔐 Principal Propagation Setup Guide

This guide explains how to configure Principal Propagation for the dual destination architecture in SAP BTP.

## 🎯 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    SAP BTP MCP Server                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐              ┌─────────────────────────────┐ │
│  │ Design-Time     │              │ Runtime Destination         │ │
│  │ Destination     │              │ (Principal Propagation)     │ │
│  │                 │              │                             │ │
│  │ • Discovery     │              │ • CRUD Operations           │ │
│  │ • Metadata      │              │ • User Context Forwarded   │ │
│  │ • Technical     │              │ • Data Access Control      │ │
│  │   User Auth     │              │ • Audit Trail              │ │
│  └─────────────────┘              └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
           │                                      │
           ▼                                      ▼
    ┌─────────────┐                        ┌─────────────┐
    │ SAP System  │                        │ SAP System  │
    │ (Technical) │                        │ (End User)  │
    └─────────────┘                        └─────────────┘
```

## 🔧 BTP Destination Configuration

### **Design-Time Destination: SAP_SYSTEM**
```json
{
  "Name": "SAP_SYSTEM",
  "Type": "HTTP",
  "URL": "https://your-sap-system.com",
  "Authentication": "BasicAuthentication",
  "User": "TECHNICAL_USER",
  "Password": "TECHNICAL_PASSWORD",
  "ProxyType": "Internet",
  "Description": "Technical user for service discovery and metadata"
}
```

### **Runtime Destination: SAP_SYSTEM_RT** 
```json
{
  "Name": "SAP_SYSTEM_RT", 
  "Type": "HTTP",
  "URL": "https://your-sap-system.com",
  "Authentication": "PrincipalPropagation",
  "ProxyType": "Internet",
  "Description": "Principal propagation for runtime operations"
}
```

## 🏗️ Application Configuration

### **Environment Variables**
```bash
# Dual destination setup
SAP_DESTINATION_NAME="SAP_SYSTEM"
SAP_DESTINATION_NAME_RT="SAP_SYSTEM_RT"
SAP_USE_SINGLE_DESTINATION="false"

# Security settings
ENABLE_PRINCIPAL_PROPAGATION="true"
JWT_VALIDATION="strict"
```

### **User-Provided Service Configuration**
```bash
cf create-user-provided-service mcp-odata-config -p '{
  "SAP_DESTINATION_NAME": "SAP_SYSTEM",
  "SAP_DESTINATION_NAME_RT": "SAP_SYSTEM_RT",
  "SAP_USE_SINGLE_DESTINATION": "false",
  "ENABLE_PRINCIPAL_PROPAGATION": "true"
}'
```

## 🔒 SAP System Setup

### **1. Technical User (Design-Time)**
- Create dedicated technical user: `MCP_DISCOVERY_USER`
- Assign minimal permissions for:
  - Service discovery
  - Metadata reading
  - Schema access

### **2. Principal Propagation (Runtime)**
- Configure SAML Identity Provider
- Set up user mapping
- Configure authorization objects:
  ```
  S_SERVICE   - Service access
  S_DEVELOP   - Development object access
  V_ACTIVITY  - Activity authorization
  ```

## 🚀 Authentication Flow

### **Design-Time Operations** (Service Discovery, Metadata)
1. Use technical user credentials
2. Access system-level information
3. No user context needed

### **Runtime Operations** (CRUD)
1. Extract JWT token from authenticated user
2. Forward token to SAP system via Principal Propagation
3. SAP system validates user identity
4. Apply user-specific authorizations
5. Audit trail with real user information

## 📋 Testing Principal Propagation

### **1. Check Destination Status**
```bash
# Access admin dashboard
https://your-app-url/auth/

# Navigate to "🔗 Destination Status" section
# Verify both destinations show ✅ Available
```

### **2. Test CRUD Operations**
```javascript
// CRUD operations will automatically use Principal Propagation
const result = await mcpClient.callTool({
  name: "sap-execute-entity-operation",
  arguments: {
    serviceId: "YOUR_SERVICE",
    entityName: "YourEntity", 
    operation: "read"
    // JWT token automatically forwarded
  }
});
```

### **3. Verify User Context**
Check SAP system logs to confirm operations are executed under the correct user identity.

## ⚠️ Security Considerations

### **JWT Token Handling**
- ✅ Tokens are temporarily set during runtime operations
- ✅ Automatic cleanup after each request
- ✅ No persistent storage of user tokens
- ✅ Context-aware token selection

### **Fallback Behavior**
- If no JWT available for runtime operations, logs warning
- System attempts graceful degradation to technical user
- Clear error messages for troubleshooting

### **Best Practices**
1. **Separate destinations** for design-time and runtime
2. **Minimal permissions** for technical user
3. **Proper user mapping** in SAP system
4. **Regular token validation** and refresh
5. **Comprehensive audit logging**

## 🔍 Troubleshooting

### **Common Issues**

#### **"Principal Propagation may fail" Warning**
```log
WARN: No JWT token available for runtime destination 'SAP_SYSTEM_RT' - Principal Propagation may fail
```
**Solution:** Ensure user is authenticated and JWT token is available in request context.

#### **Authentication Failed**
**Check:**
- Destination configuration in BTP Cockpit
- User mapping in SAP system
- JWT token validity
- SAML IdP configuration

#### **Authorization Errors**
**Check:**
- User authorizations in SAP system
- Role assignments
- Authorization objects configuration

### **Debug Logging**
Enable debug logging to trace Principal Propagation:
```bash
LOG_LEVEL="debug"
```

## 📊 Monitoring

The admin dashboard provides real-time monitoring:
- ✅ **Design-time destination status**
- ✅ **Runtime destination status** 
- ✅ **Authentication method detection**
- ✅ **Principal Propagation validation**

## 🔄 Migration from Single Destination

### **Phase 1: Add Runtime Destination**
1. Create `SAP_SYSTEM_RT` with Principal Propagation
2. Set `SAP_USE_SINGLE_DESTINATION="false"`
3. Test both destinations work

### **Phase 2: Validate Operations**  
1. Verify design-time operations use technical user
2. Verify runtime operations use Principal Propagation
3. Check audit trails in SAP system

### **Phase 3: Full Migration**
1. Update all environments
2. Monitor for authentication issues  
3. Optimize user authorizations

This setup provides enterprise-grade security with proper user context propagation while maintaining technical user access for system-level operations.
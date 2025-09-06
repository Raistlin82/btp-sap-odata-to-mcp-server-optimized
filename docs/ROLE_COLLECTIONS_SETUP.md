# 🔐 Role Collections Setup Guide

## SAP BTP MCP Server - Security Role Configuration

This document provides step-by-step instructions for setting up Role Collections in SAP BTP for the MCP Server application.

---

## 📋 **Overview**

The SAP MCP Server implements a **4-tier role-based access control (RBAC)** system:

1. **MCPViewer** - Read-only access
2. **MCPEditor** - Read and write access  
3. **MCPManager** - Full operational access including delete
4. **MCPAdmin** - Complete administrative access

---

## 🎯 **Defined Scopes and Roles**

### **OAuth 2.0 Scopes**

| Scope | Description | Usage |
|-------|-------------|-------|
| `btp-sap-odata-to-mcp-server.read` | Read access to SAP OData services via MCP | Query operations, data retrieval |
| `btp-sap-odata-to-mcp-server.write` | Write access to SAP OData entities | Create and Update operations |
| `btp-sap-odata-to-mcp-server.delete` | Delete access to SAP OData entities | Delete operations |
| `btp-sap-odata-to-mcp-server.admin` | Administrative access to MCP server | Server configuration, health monitoring |
| `btp-sap-odata-to-mcp-server.discover` | Service discovery and metadata access | Browse available services and entities |

### **Role Templates**

| Role Template | Description | Included Scopes |
|---------------|-------------|-----------------|
| **MCPViewer** | Read-only access to MCP services and discovery | `read`, `discover` |
| **MCPEditor** | Read and write access to MCP services | `read`, `write`, `discover` |
| **MCPManager** | Full access including delete operations | `read`, `write`, `delete`, `discover` |
| **MCPAdmin** | Full administrative access to MCP server | `read`, `write`, `delete`, `admin`, `discover` |

---

## 🔧 **BTP Cockpit Configuration Steps**

### **Step 1: Access Role Collections**

1. Open **SAP BTP Cockpit**
2. Navigate to your **Subaccount**
3. Go to **Security** → **Role Collections**

### **Step 2: Create Role Collections**

Create the following 4 Role Collections:

#### **📖 MCP-Viewers**
- **Name**: `MCP-Viewers`
- **Description**: `Read-only access to SAP MCP Server - can browse and query data`
- **Assigned Role**: `MCPViewer`
- **Use Case**: Business users who need to query SAP data through MCP

#### **✏️ MCP-Editors**
- **Name**: `MCP-Editors` 
- **Description**: `Read and write access to SAP MCP Server - can create and update data`
- **Assigned Role**: `MCPEditor`
- **Use Case**: Power users who need to modify SAP data through MCP

#### **🗑️ MCP-Managers**
- **Name**: `MCP-Managers`
- **Description**: `Full operational access including delete - can perform all data operations`
- **Assigned Role**: `MCPManager`
- **Use Case**: Team leads and data managers who need full operational control

#### **👑 MCP-Administrators**
- **Name**: `MCP-Administrators`
- **Description**: `Complete administrative access - can configure server and monitor health`
- **Assigned Role**: `MCPAdmin`
- **Use Case**: System administrators and DevOps team members

### **Step 3: Assign Roles to Role Collections**

For each Role Collection created above:

1. Click on the **Role Collection name**
2. Click **Edit**
3. In the **Roles** section, click **Add**
4. Select the corresponding role template:
   - MCP-Viewers → `MCPViewer`
   - MCP-Editors → `MCPEditor`  
   - MCP-Managers → `MCPManager`
   - MCP-Administrators → `MCPAdmin`
5. Click **Save**

### **Step 4: Assign Users to Role Collections**

1. Click on a **Role Collection**
2. Click **Edit**
3. In the **Users** section, click **Add**
4. Enter the **User ID** (email address)
5. Select **Identity Provider** (usually `Default identity provider`)
6. Click **Save**
7. Repeat for other role collections as needed

---

## 👥 **Recommended User Assignments**

### **For Initial Setup/Testing**
- Assign your administrator account to **MCP-Administrators**
- This gives you full access to test all functionality

### **For Production Environment**

| User Type | Recommended Role Collection | Example Users |
|-----------|----------------------------|---------------|
| **System Administrators** | MCP-Administrators | `admin@company.com`, `devops@company.com` |
| **Data Managers** | MCP-Managers | `data.manager@company.com`, `team.lead@company.com` |
| **Power Users** | MCP-Editors | `analyst@company.com`, `consultant@company.com` |
| **Business Users** | MCP-Viewers | `user1@company.com`, `readonly@company.com` |

---

## 🔒 **API Endpoint Access Control**

| Endpoint | Required Role | Access Level |
|----------|---------------|--------------|
| `GET /health` | 🟢 **Public** | No authentication required |
| `GET /docs` | 🟢 **Public** | No authentication required |
| `GET /mcp` (info) | 🟡 **Optional Auth** | Enhanced info when authenticated |
| `POST /mcp` (operations) | 🟡 **Optional Auth** | Role-based feature access |
| `GET /config/services` | 🔴 **Admin Only** | MCP-Administrators required |
| `POST /config/services/*` | 🔴 **Admin Only** | MCP-Administrators required |

### **MCP Operation Access Matrix**

| Operation Type | MCPViewer | MCPEditor | MCPManager | MCPAdmin |
|----------------|-----------|-----------|------------|----------|
| **List Services** | ✅ | ✅ | ✅ | ✅ |
| **Browse Entities** | ✅ | ✅ | ✅ | ✅ |
| **Read Data** | ✅ | ✅ | ✅ | ✅ |
| **Create Records** | ❌ | ✅ | ✅ | ✅ |
| **Update Records** | ❌ | ✅ | ✅ | ✅ |
| **Delete Records** | ❌ | ❌ | ✅ | ✅ |
| **Server Config** | ❌ | ❌ | ❌ | ✅ |
| **Health Monitoring** | ❌ | ❌ | ❌ | ✅ |

---

## 🧪 **Testing Role-Based Access**

### **Step 1: Get JWT Token**
```bash
# Using CF CLI
cf oauth-token

# Using BTP CLI  
btp auth login
```

### **Step 2: Test Different Access Levels**

#### **Test Viewer Access (Read-Only)**
```bash
# Should work - reading data
curl -H "Authorization: Bearer <jwt-token>" \
     -H "Content-Type: application/json" \
     https://your-app.cfapps.eu30.hana.ondemand.com/mcp \
     -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# Should fail - creating data (if user only has Viewer role)
curl -H "Authorization: Bearer <jwt-token>" \
     -H "Content-Type: application/json" \
     https://your-app.cfapps.eu30.hana.ondemand.com/mcp \
     -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"create_customer","arguments":{"name":"Test"}},"id":2}'
```

#### **Test Admin Access**
```bash
# Should work - admin endpoint
curl -H "Authorization: Bearer <jwt-token>" \
     https://your-app.cfapps.eu30.hana.ondemand.com/config/services
```

#### **Test Without Authentication**
```bash
# Should fail for admin endpoints
curl https://your-app.cfapps.eu30.hana.ondemand.com/config/services

# Should work for public endpoints
curl https://your-app.cfapps.eu30.hana.ondemand.com/health
```

---

## 🔍 **Troubleshooting**

### **Common Issues and Solutions**

#### **Issue**: User gets "Insufficient permissions" error
**Solution**: 
1. Verify user is assigned to correct Role Collection
2. Check if Role Collection has the right role template assigned
3. Ensure application is deployed with updated `xs-security.json`

#### **Issue**: "Invalid JWT token" error
**Solution**:
1. Get a fresh JWT token: `cf oauth-token`
2. Ensure token is not expired
3. Check if user exists in the BTP subaccount

#### **Issue**: Role Collection not visible
**Solution**:
1. Redeploy application: `cf deploy ./mta_archives/*.mtar`
2. Wait 2-3 minutes for XSUAA service update
3. Refresh BTP Cockpit

### **Verification Commands**

```bash
# Check if XSUAA service is updated
cf service sap-mcp-xsuaa

# View application logs for auth errors
cf logs sap-mcp-server-mcp_noprod_space --recent | grep -i auth

# Check application environment for XSUAA credentials
cf env sap-mcp-server-mcp_noprod_space | grep -A10 xsuaa
```

---

## 📚 **Additional Resources**

- [SAP BTP Security Guide](https://help.sap.com/docs/btp/sap-business-technology-platform/security)
- [XSUAA Service Documentation](https://help.sap.com/docs/btp/sap-business-technology-platform/authorization-and-trust-management-service)
- [Role Collections Best Practices](https://help.sap.com/docs/btp/sap-business-technology-platform/role-collections)

---

## 📞 **Support**

For issues with role configuration:
1. Check application logs: `cf logs sap-mcp-server-mcp_noprod_space`
2. Verify BTP Cockpit role assignments
3. Test with different users and role combinations
4. Contact your BTP administrator if issues persist

---

*Last Updated: September 2025*
*Version: 1.0.0*
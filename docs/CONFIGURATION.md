# Configuration Guide

This guide provides a comprehensive overview of all the necessary configurations for the server, from the local development environment to a production deployment on SAP BTP.

## 1. Configuration via Environment Variables

Environment variables are the primary method for configuring the application. They can be defined in an `.env` file for local development or as "User-Provided Variables" in the BTP Cockpit.

### Fundamental Variables (Required)

| Variable | Description | Example |
| :--- | :--- | :--- |
| `SAP_IAS_URL` | URL of the SAP Identity Authentication Service tenant. | `https://your-tenant.accounts.ondemand.com` |
| `SAP_IAS_CLIENT_ID` | Client ID for the OAuth application in IAS. | `abc-def-123` |
| `SAP_IAS_CLIENT_SECRET`| Client Secret for the OAuth application in IAS. | `your-secret` |
| `PORT` | The port on which the Express server will listen. | `8080` |
| `NODE_ENV` | The application's operating environment. | `production` or `development` |

### Destination Configuration

| Variable | Description | Example |
| :--- | :--- | :--- |
| `SAP_DESTINATION_NAME` | Name of the BTP destination used for service discovery. | `SAP_S4HANA_Design` |
| `SAP_DESTINATION_NAME_RT`| Name of the BTP destination used at runtime (for data calls). | `SAP_S4HANA_Runtime` |
| `SAP_USE_SINGLE_DESTINATION`| If `true`, uses `SAP_DESTINATION_NAME` for everything. | `false` |
| `destinations` | For local development, a JSON array that simulates the Destination service. | `[{"name":"MyDest","url":"..."}]` |

### Advanced Configuration (Optional)

| Variable | Description | Example |
| :--- | :--- | :--- |
| `LOG_LEVEL` | The level of detail for logs. | `info`, `debug`, `warn`, `error` |
| `SESSION_TIMEOUT` | Duration of a user session in milliseconds. | `3600000` (1 hour) |
| `CORS_ORIGINS` | Comma-separated list of allowed origins for CORS. | `https://claude.ai,http://localhost:3000` |

## 2. Security Configuration (xs-security.json)

This file is crucial for defining the application's security model in SAP BTP. It is used by the XSUAA service to create and validate JWTs.

**Path**: `xs-security.json`

### Scopes

Scopes define granular permissions. Each protected tool will require one or more of these scopes.

```json
"scopes": [
  { "name": "$XSAPPNAME.read", "description": "Read access" },
  { "name": "$XSAPPNAME.write", "description": "Write access" },
  { "name": "$XSAPPNAME.admin", "description": "Administrative access" }
]
```

### Role Templates

Role templates aggregate multiple scopes into a logical role that can be assigned to users.

```json
"role-templates": [
  {
    "name": "MCPEditor",
    "description": "Read and write access",
    "scope-references": ["$XSAPPNAME.read", "$XSAPPNAME.write"]
  },
  {
    "name": "MCPAdmin",
    "description": "Full administrative access",
    "scope-references": ["$XSAPPNAME.admin"]
  }
]
```

### Role Collections

In the **BTP Cockpit**, you create "Role Collections" based on these templates and assign them to users or user groups. This is the final step that actually grants permissions.

**Example in BTP Cockpit**:
1.  Go to **Security > Role Collections**.
2.  Create a new collection, e.g., `App_Power_Users`.
3.  Add the roles defined in the templates, e.g., `MCPEditor`.
4.  Assign the `App_Power_Users` collection to the desired users.

## 3. Deployment Configuration (mta.yaml)

This file defines the structure of the multi-target application and the BTP services it needs to function.

**Path**: `mta.yaml`

### Application Module

Defines the characteristics of the Node.js application, such as memory, start command, and the services it needs to bind to.

```yaml
modules:
  - name: sap-mcp-server
    type: nodejs
    path: ./
    parameters:
      memory: 512M
      command: npm run start
    requires:
      - name: sap-mcp-destination
      - name: sap-mcp-connectivity
      - name: sap-mcp-xsuaa
```

### Resources (BTP Services)

Lists the services that BTP must provide to the application at deployment time. It is essential that these services are available and configured in your BTP subaccount.

```yaml
resources:
  - name: sap-mcp-destination
    type: org.cloudfoundry.managed-service
    parameters:
      service: destination
      service-plan: lite

  - name: sap-mcp-xsuaa
    type: org.cloudfoundry.managed-service
    parameters:
      service: xsuaa
      service-plan: application
      path: ./xs-security.json
```

---

**Next Steps**: [Deployment Guide](./DEPLOYMENT.md) | [User Guide](./USER_GUIDE.md)
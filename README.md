# SAP OData to AI-Powered MCP Server (Optimized)

This repository is an enterprise-ready MCP (Model Context Protocol) server that bridges SAP OData services with AI capabilities. Based on the original project **[btp-sap-odata-to-mcp-server](https://github.com/lemaiwo/btp-sap-odata-to-mcp-server)** by @lemaiwo, this optimized version features enhanced security, simplified configuration, modular authentication, and comprehensive Cloud Foundry integration.

## ✨ Key Features

### 🔐 Enhanced Security Architecture
- **Modular Authentication System**: Factory pattern supporting IAS, OAuth2, JWT, Basic Auth, and API Keys
- **Secure Session Management**: Thread-safe session bridging with proper locking mechanisms
- **Role-Based Access Control**: Granular permissions with XSUAA integration
- **Principal Propagation**: Maintains user context throughout the request lifecycle
- **Security Best Practices**: No sensitive data logging, secure error handling, JWT validation

### 🎯 Simplified OData Discovery
- **Pattern-Based Filtering**: Simple include/exclude patterns for service discovery
- **Business Domain Mode**: Pre-configured domains (sales, finance, HR, etc.)
- **Whitelist Mode**: Explicit service control for production environments
- **Smart Defaults**: Automatic exclusion of test/debug services

### 🧠 AI-Powered Capabilities
- **Smart Query Router**: Natural language to OData conversion
- **Hierarchical Tool Architecture**: 17+ tools organized in logical layers
- **Intelligent Workflow Orchestration**: Automatic tool chaining and optimization
- **Real-time Analytics**: KPI monitoring and trend analysis

### 🎨 Interactive UI Tools Suite
- **`ui-form-generator`**: Dynamic SAP Fiori forms with validation
- **`ui-data-grid`**: Interactive tables with sorting and filtering
- **`ui-dashboard-composer`**: Real-time KPI dashboards
- **`ui-workflow-builder`**: Visual workflow creation
- **`ui-report-builder`**: Analytical reports with drill-down

### ☁️ Cloud-Native Features
- **Cloud Foundry Optimized**: Native integration with CF services
- **Structured Logging**: SAP Cloud Logging with fallback support
- **Health Monitoring**: Comprehensive health check endpoints
- **Performance Metrics**: Built-in performance tracking
- **Graceful Shutdown**: Proper resource cleanup

## 🚀 Quick Start

### Prerequisites

-   Access to an SAP BTP, Cloud Foundry environment.
-   Required BTP services: XSUAA, Identity, Connectivity, Destination.
-   Node.js >= 18.

### 1. Installation

```bash
git clone <this-repo>
cd btp-sap-odata-to-mcp-server-optimized
npm install
```

### 2. Configuration

Configure the application using environment variables. See the [Configuration Guide](./docs/CONFIGURATION.md) for detailed documentation.

```bash
cp .env.example .env
# Edit .env with your configuration
```

#### Quick Configuration Example

```bash
# Authentication
SAP_IAS_URL=https://your-tenant.accounts.ondemand.com
SAP_IAS_CLIENT_ID=your-client-id
SAP_IAS_CLIENT_SECRET=your-secret

# OData Discovery (Simplified)
ODATA_DISCOVERY_MODE=pattern
ODATA_INCLUDE_PATTERNS=*API*,Z*
ODATA_EXCLUDE_PATTERNS=*_TEST*,*_TEMP*
ODATA_MAX_SERVICES=50

# Destinations
SAP_DESTINATION_NAME=SAP_S4HANA
```

### 3. Build and Deploy

```bash
# Build the TypeScript source code for BTP
npm run build:btp

# Deploy to SAP BTP, Cloud Foundry
npm run deploy:btp
```

## 📚 Documentation

For a detailed understanding of the project, please refer to the complete documentation.

-   **[Getting Started](./docs/README.md)**: The main hub for all documentation.
-   **[Architecture Overview](./docs/ARCHITECTURE.md)**: A deep dive into the system's architecture, including the hierarchical tool model and the smart router.
-   **[Tool Reference](./docs/TOOL_REFERENCE.md)**: Detailed documentation for all available tools, with parameters and examples.
-   **[User Guide](./docs/USER_GUIDE.md)**: A step-by-step guide on how to authenticate and use the tools.
-   **[Deployment Guide](./docs/DEPLOYMENT.md)**: Instructions for deploying the application to SAP BTP and for local development.
-   **[Configuration Guide](./docs/CONFIGURATION.md)**: A comprehensive guide to all environment variables and security configurations.
-   **[Testing Guide](./docs/guides/TESTING.md)**: Information on how to run and extend the test suite.

# SAP OData to AI-Powered MCP Server (Optimized Playground)

This repository is an experimental and optimized environment based on the original project **[btp-sap-odata-to-mcp-server](https://github.com/lemaiwo/btp-sap-odata-to-mcp-server)** by @lemaiwo. It has been enhanced with AI capabilities, a hierarchical tool architecture, and a robust authentication system for enterprise scenarios.

## ✨ Key Features

-   **🧠 Hierarchical Tools & Smart Router**: Instead of hundreds of tools, the interface is simplified to a few intelligent tools. The `sap-smart-query` tool acts as a universal router that interprets requests (in natural language or OData) and orchestrates the optimal workflow.
-   **🎨 Interactive UI Tools Suite**: 5 integrated UI tools for creating interactive experiences:
    - **ui-form-generator** - Dynamic SAP Fiori forms with validation
    - **ui-data-grid** - Interactive tables with sorting, filtering & export
    - **ui-dashboard-composer** - KPI dashboards with real-time charts
    - **ui-workflow-builder** - Visual workflow processes with approvals
    - **ui-report-builder** - Analytical reports with drill-down capabilities
-   **🔄 End-to-End Workflow Integration**: UI tools are automatically suggested in context after SAP operations, creating seamless data-to-UI workflows.
-   **🔐 Enterprise Authentication**: Native integration with SAP BTP via XSUAA, with a session-based authentication flow and role management.
-   **🤖 AI and Real-time Capabilities**: Includes tools for natural language to OData conversion, data analysis, query optimization, and real-time analytics.
-   **☁️ Cloud-Native Optimized**: Designed for deployment on SAP BTP, Cloud Foundry, with structured logging, health checks, and lifecycle management.

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

Copy the `.env.example` file to `.env` and populate the required variables for your SAP IAS tenant.

```bash
cp .env.example .env
```

### 3. Build and Deploy

```bash
# Build the TypeScript source code for BTP
npm run build:btp

# Deploy to SAP BTP, Cloud Foundry
npm run deploy:btp
```

## 📚 Full Documentation

For a detailed guide on architecture, configuration, tool usage, and advanced topics, please see our **[Documentation Hub](./docs/README.md)**.

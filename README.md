# SAP OData to AI-Powered MCP Server (Optimized Playground)

This repository is an experimental and optimized environment based on the original project **[btp-sap-odata-to-mcp-server](https://github.com/lemaiwo/btp-sap-odata-to-mcp-server)** by @lemaiwo. It has been enhanced with AI capabilities, a hierarchical tool architecture, a powerful interactive UI suite, and a robust authentication system for enterprise scenarios.

## ✨ Key Features

-   **🧠 Hierarchical Tools & Smart Router**: The `sap-smart-query` tool acts as a universal entry point. It interprets requests (in natural language or OData) and orchestrates the optimal workflow, simplifying the user experience by abstracting the complexity of over 17 underlying tools.

-   **🎨 Interactive UI Tools Suite**: A suite of 5 integrated tools for creating rich, interactive SAP Fiori-based user experiences directly from data:
    -   **`ui-form-generator`**: Dynamically generates SAP Fiori forms with built-in validation for creating and editing data.
    -   **`ui-data-grid`**: Creates interactive tables with sorting, filtering, pagination, and data export capabilities.
    -   **`ui-dashboard-composer`**: Builds KPI dashboards with real-time charts and graphs for data visualization.
    -   **`ui-workflow-builder`**: Allows for the creation of visual workflow processes with approval steps and custom logic.
    -   **`ui-report-builder`**: Generates analytical reports with drill-down capabilities for in-depth data exploration.

-   **🔄 End-to-End Workflow Integration**: UI tools are automatically and intelligently suggested in context after SAP data operations, creating seamless data-to-UI workflows without manual intervention.

-   **🔐 Enterprise-Grade Authentication**: Features native integration with SAP BTP's security services (XSUAA and IAS). It supports a session-based authentication flow, role-based access control (RBAC), and principal propagation for a secure, enterprise-ready setup.

-   **🤖 AI and Real-time Capabilities**: Includes a suite of advanced tools for:
    -   Natural language to OData query conversion.
    -   AI-driven data analysis and trend identification.
    -   Query performance optimization.
    -   Real-time data streaming and KPI monitoring.

-   **☁️ Cloud-Native and Optimized**: Designed for efficient deployment on SAP BTP, Cloud Foundry. It includes structured logging, health check endpoints, and graceful shutdown for robust lifecycle management in a cloud environment.

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

Copy the `.env.example` file to `.env` and populate the required variables for your SAP IAS tenant and other configurations.

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

## 📚 Documentation

For a detailed understanding of the project, please refer to the complete documentation.

-   **[Getting Started](./docs/README.md)**: The main hub for all documentation.
-   **[Architecture Overview](./docs/ARCHITECTURE.md)**: A deep dive into the system's architecture, including the hierarchical tool model and the smart router.
-   **[Tool Reference](./docs/TOOL_REFERENCE.md)**: Detailed documentation for all available tools, with parameters and examples.
-   **[User Guide](./docs/USER_GUIDE.md)**: A step-by-step guide on how to authenticate and use the tools.
-   **[Deployment Guide](./docs/DEPLOYMENT.md)**: Instructions for deploying the application to SAP BTP and for local development.
-   **[Configuration Guide](./docs/CONFIGURATION.md)**: A comprehensive guide to all environment variables and security configurations.
-   **[Testing Guide](./docs/guides/TESTING.md)**: Information on how to run and extend the test suite.

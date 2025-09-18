# Documentation Hub

Welcome to the complete documentation for the **SAP OData to AI-Powered MCP Server with UI Tools Integration**.

This documentation is structured to guide you through the key concepts, usage, administration, and development of this enhanced application that now includes interactive UI generation capabilities.

## 1. Key Concepts

To fully grasp the power of this server, it is essential to understand two main architectural concepts.

-   **[The Hierarchical Tool Model](./ARCHITECTURE.md#the-hierarchical-tool-model)**: Discover why we use a small set of intelligent tools instead of hundreds of specific tools for each CRUD operation.
-   **[The `sap-smart-query` Universal Router](./TOOL_REFERENCE.md#the-sap-smart-query-universal-router)**: Learn how this single entry point analyzes, routes, and orchestrates your requests to simplify interaction.

## 2. User Guide

This section is for those who need to interact with the server to query SAP data.

-   **[Authentication Flow](./USER_GUIDE.md#step-by-step-authentication-flow)**: A step-by-step guide on how to authenticate and manage sessions.
-   **[Tool Reference](./TOOL_REFERENCE.md)**: Detailed documentation for all available tools, including new UI tools, with examples and parameters.
-   **[Workflow Examples](./USER_GUIDE.md#workflow-examples)**: Common usage scenarios, including UI generation and interactive dashboard creation.

## 3. Administrator Guide

This section is for those who need to deploy, configure, and maintain the application.

-   **[Deployment](./DEPLOYMENT.md)**: Detailed instructions for deploying to **SAP BTP, Cloud Foundry** and for the **local development environment**.
-   **[Configuration](./CONFIGURATION.md)**: The definitive guide to all **environment variables**, BTP service configuration (`mta.yaml`), and security (`xs-security.json`).
-   **[Security and Roles](./CONFIGURATION.md#security-configuration-xs-securityjson)**: How to configure roles and permissions through BTP Role Collections.
-   **[Monitoring and Health Check](./DEPLOYMENT.md#monitoring-and-health-check)**: How to monitor the application's status via health check endpoints.

## 4. Advanced Guides

In-depth information on specific aspects of the application.

-   **[Testing Guide](./guides/TESTING.md)**: How to run and extend the automated test suite.
-   **[Token Consumption Analysis](./work/TOKEN_CONSUMPTION_ANALYSIS.md)**: A detailed analysis of token consumption and optimization strategies (moved to `work/`).
-   **[Identity Management Review](./work/IDENTITY_MANAGEMENT_REVIEW.md)**: The action plan for migrating to XSUAA (moved to `work/`).
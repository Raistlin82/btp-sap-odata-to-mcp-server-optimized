# Tool Reference

This guide provides detailed documentation for each of the tools available in the SAP MCP Server. The tools are organized into functional categories.

## Category 1: Entry Point and Authentication

These tools are the starting point for any interaction with the server.

### 1. `sap-smart-query` (Universal Router)

-   **Description**: **This is the primary and recommended tool for all interactions.** It functions as an intelligent, universal router that analyzes your request and orchestrates the most effective sequence of underlying tools to achieve your goal. It is designed to handle ambiguity and complex, multi-step requests.
-   **When to use it**: Always. It is the single entry point for any request, whether it's a simple question in natural language (e.g., "show me customers in Germany"), a precise OData query (`A_BusinessPartner?$filter=...`), or a complex command (e.g., "analyze sales trends for product X and find anomalies").
-   **How it Works**: It uses the `IntelligentToolRouterModule` to parse the `userRequest`. Based on routing rules, it can chain multiple tools together, for example: `natural-query-builder` -> `execute-entity-operation` -> `smart-data-analysis`.
-   **Parameters**:
    -   `userRequest` (string, required): Your request in natural language or OData syntax.
    -   `context` (object, optional): Additional context to guide the router, such as `serviceId` or `entityType` if you already know them.
-   **Authentication**: Handled automatically by the underlying tools invoked by the router.

### 2. `check-sap-authentication`

-   **Description**: Validates and associates your authentication session. It is called automatically at the beginning of a conversation but can be used manually to provide a `session_id`.
-   **When to use it**: Only after completing the login flow in the browser to associate the `session_id` with your MCP session.
-   **Parameters**:
    -   `session_id` (string, optional): The session ID obtained from the browser-based authentication flow.
-   **Authentication**: This tool *manages* authentication.

## Category 2: Data Discovery

These tools help you explore what data and services are available.

### 3. `search-sap-services`

-   **Description**: Searches for and finds available OData services based on keywords or categories.
-   **Parameters**:
    -   `query` (string, optional): Search term.
    -   `category` (enum, optional): Category to filter services (e.g., `sales`, `finance`).
-   **Authentication**: Not required.

### 4. `discover-service-entities`

-   **Description**: Lists all entities (datasets) available within a specific OData service.
-   **Parameters**:
    -   `serviceId` (string, required): The ID of the service to explore.
-   **Authentication**: Not required.

### 5. `get-entity-schema`

-   **Description**: Provides the detailed structure (fields, data types, keys) of a specific entity.
-   **Parameters**:
    -   `serviceId` (string, required): The ID of the service.
    -   `entityName` (string, required): The name of the entity.
-   **Authentication**: Not required.

## Category 3: Data Execution and Analysis

These tools perform operations on data and provide analysis.

### 6. `execute-entity-operation`

-   **Description**: Performs CRUD (Create, Read, Update, Delete) operations on an entity. **Warning**: Use only with precise OData syntax. For natural language, rely on `sap-smart-query`.
-   **Parameters**:
    -   `serviceId` (string, required): The ID of the service.
    -   `entityName` (string, required): The name of the entity.
    -   `operation` (enum, required): `read`, `create`, `update`, `delete`.
    -   `parameters` (object, optional): Data for operations (e.g., the body for `create`/`update` or keys for `delete`).
    -   `queryOptions` (object, optional): OData options like `$filter`, `$select`, `$top`.
-   **Authentication**: **Required**.

### 7. `natural-query-builder`

-   **Description**: Translates a natural language request (e.g., "customers from Rome") into a valid OData query. It is typically invoked automatically by `sap-smart-query`.
-   **Parameters**:
    -   `naturalQuery` (string, required): The natural language request.
    -   `entityType` (string, required): The target entity.
-   **Authentication**: Not required.

### 8. `smart-data-analysis`

-   **Description**: Analyzes a dataset to identify trends, anomalies, and generate business insights using AI.
-   **Parameters**:
    -   `data` (array, required): An array of JSON objects to analyze.
    -   `analysisType` (enum, required): `trend`, `anomaly`, `forecast`.
-   **Authentication**: **Required**.

## Category 4: AI and Real-Time Capabilities

These advanced tools provide deeper insights and live data monitoring. They are typically orchestrated by the `sap-smart-query` router.

### 9. `query-performance-optimizer`

-   **Description**: Analyzes a slow or inefficient OData query and suggests optimizations. For example, it might recommend using `$select` to limit columns or adding a missing `$filter`.
-   **Parameters**:
    - `query` (string, required): The OData query to analyze.
-   **Authentication**: **Required**.

### 10. `business-process-insights`

-   **Description**: Analyzes a stream of transactional data (e.g., sales orders over time) to identify process bottlenecks, inefficiencies, or deviation from norms.
-   **Parameters**:
    - `data` (array, required): A time-series array of transactional data.
    - `processType` (string, required): The business process to analyze (e.g., "OrderToCash").
-   **Authentication**: **Required**.

### 11. `realtime-data-stream`

-   **Description**: Establishes a WebSocket connection to provide a live stream of data from an SAP entity. Useful for building real-time dashboards or monitoring critical events.
-   **Parameters**:
    - `serviceId` (string, required): The ID of the service.
    - `entityName` (string, required): The name of the entity to stream.
    - `filter` (string, optional): An OData filter to apply to the stream.
-   **Authentication**: **Required**.

### 12. `kpi-dashboard-builder`

-   **Description**: A high-level tool that generates a complete dashboard configuration for a specific business KPI. It identifies the right entities, queries, and visualizations.
-   **Parameters**:
    - `kpiName` (string, required): The name of the KPI to build a dashboard for (e.g., "Monthly Recurring Revenue").
-   **Authentication**: **Required**.

## Category 5: UI and User Experience Tools

These tools generate interactive user interfaces and forms for enhanced user experience with SAP data.

### 13. `ui-form-generator`

-   **Description**: Generates interactive forms for SAP entities with validation and data binding. Creates HTML forms with SAP UI5 styling for create, update, or search operations.
-   **Parameters**:
    - `entityType` (string, required): SAP entity type (e.g., 'Customer', 'Product', 'Order').
    - `operation` (enum, required): Form operation type ('create', 'update', 'search').
    - `customFields` (array, optional): Custom field configurations with validation rules.
    - `layout` (enum, optional): Form layout type ('vertical', 'horizontal', 'grid').
    - `theme` (enum, optional): SAP UI theme ('sap_horizon', 'sap_fiori_3').
-   **Authentication**: **Required**.

### 14. `ui-workflow-builder`

-   **Description**: Creates multi-step workflow interfaces for complex business processes. Generates step-by-step wizards with navigation and validation.
-   **Parameters**:
    - `processType` (string, required): Business process type (e.g., 'OrderToCash', 'ProcureToPay').
    - `steps` (array, required): Array of workflow steps with configurations.
    - `theme` (enum, optional): UI theme for consistent styling.
    - `validation` (object, optional): Cross-step validation rules.
-   **Authentication**: **Required**.

### 15. `ui-dashboard-composer`

-   **Description**: Composes interactive dashboards with charts, tables, and KPIs. Creates responsive layouts with real-time data visualization.
-   **Parameters**:
    - `dashboardConfig` (object, required): Dashboard configuration with widgets and layout.
    - `dataSource` (string, required): Primary data source for dashboard.
    - `refreshInterval` (number, optional): Auto-refresh interval in seconds.
    - `filters` (array, optional): Dashboard-wide filters.
-   **Authentication**: **Required**.

### 16. `ui-data-grid`

-   **Description**: Generates advanced data grids with sorting, filtering, pagination, and inline editing capabilities for SAP entities.
-   **Parameters**:
    - `entityType` (string, required): SAP entity type to display.
    - `columns` (array, optional): Column configurations and display options.
    - `features` (object, optional): Grid features like sorting, filtering, editing.
    - `pageSize` (number, optional): Number of rows per page.
-   **Authentication**: **Required**.

### 17. `ui-report-builder`

-   **Description**: Creates formatted reports with charts, tables, and export capabilities. Supports PDF, Excel, and CSV export formats.
-   **Parameters**:
    - `reportType` (string, required): Type of report to generate.
    - `dataQuery` (string, required): OData query for report data.
    - `format` (enum, optional): Output format ('html', 'pdf', 'excel', 'csv').
    - `template` (string, optional): Report template name.
-   **Authentication**: **Required**.

---

**Next Steps**: [User Guide](./USER_GUIDE.md) | [Configuration Guide](./CONFIGURATION.md)
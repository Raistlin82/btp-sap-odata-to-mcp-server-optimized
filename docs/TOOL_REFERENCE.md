# Tool Reference

This guide provides detailed documentation for each of the tools available in the SAP MCP Server. The tools are organized into functional categories.

## Category 1: Entry Point and Authentication

These tools are the starting point for any interaction with the server.

### 1. `sap-smart-query` (Universal Router)

-   **Description**: **This is the only tool you should use for all your requests.** It acts as an intelligent router that analyzes your request and invokes the most appropriate tool sequence for you.
-   **When to use it**: Always. For any request, whether in natural language ("show customers") or as a direct OData query (`A_BusinessPartner?$filter=...`).
-   **Parameters**:
    -   `userRequest` (string, required): Your request.
    -   `context` (object, optional): Additional context, such as `serviceId` or `entityType` if already known.
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

Advanced tools for optimization, process analysis, and real-time monitoring.

### 9. `query-performance-optimizer`

-   **Description**: Analyzes a slow OData query and suggests optimizations.
-   **Authentication**: **Required**.

### 10. `business-process-insights`

-   **Description**: Analyzes transactional data to identify bottlenecks and inefficiencies in business processes.
-   **Authentication**: **Required**.

### 11. `realtime-data-stream`

-   **Description**: Opens a WebSocket channel for real-time data streaming.
-   **Authentication**: Not required to start the stream, but may be required to access specific data.

### 12. `kpi-dashboard-builder`

-   **Description**: Creates and manages dashboards with Key Performance Indicators (KPIs) based on SAP data.
-   **Authentication**: **Required**.

---

**Next Steps**: [User Guide](./USER_GUIDE.md) | [Configuration Guide](./CONFIGURATION.md)
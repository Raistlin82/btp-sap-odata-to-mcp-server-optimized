# 📐 Architecture Documentation: Tool Sequence Diagrams

> **🎨 For modern, interactive diagrams see [Modern Architecture Diagrams](./MODERN-ARCHITECTURE-DIAGRAMS.md)**

![Architecture](https://img.shields.io/badge/Architecture-Microservices-blue) ![Documentation](https://img.shields.io/badge/Docs-Interactive-green) ![Status](https://img.shields.io/badge/Status-Updated-brightgreen)

## Table of Contents

1. [System Overview](#system-overview)
2. [Core SAP Tools](#core-sap-tools)
3. [UI Tools](#ui-tools)
4. [AI-Enhanced Tools](#ai-enhanced-tools)
5. [Real-time Tools](#real-time-tools)
6. [Authentication Flow](#authentication-flow)

---

## System Overview

The SAP OData MCP Server implements a hierarchical tool architecture with 17 intelligent tools organized into categories:

- **Core Tools (4):** Basic SAP operations
- **UI Tools (5):** Interactive UI generation
- **AI Tools (4):** Natural language processing and analytics
- **Real-time Tools (4):** Streaming and monitoring

### Key Architectural Principles

1. **Universal Entry Point:** `sap-smart-query` acts as intelligent router
2. **Authentication-First:** UI tools require authentication upfront
3. **Hierarchical Discovery:** Reduces tool explosion through smart routing
4. **Context Preservation:** Tools maintain session state and context

---

## Core SAP Tools

### 1. check-sap-authentication

```mermaid
sequenceDiagram
    box rgba(129, 199, 132, 0.1) 👤 Client Layer
        participant User as 👨‍💻 User
        participant MCP as 💻 MCP Client
    end

    box rgba(33, 150, 243, 0.1) 🎯 Smart Router
        participant Router as 🎯 sap-smart-query
        participant Auth as 🔑 check-sap-authentication
    end

    box rgba(255, 152, 0, 0.1) 🛡️ Security Layer
        participant Manager as 🔐 MCPAuthManager
        participant Store as 💾 TokenStore
    end

    box rgba(76, 175, 80, 0.1) ☁️ SAP BTP
        participant XSUAA as 🌐 SAP BTP XSUAA
    end

    User->>+MCP: 🔐 "Authenticate to SAP"
    MCP->>+Router: 📡 Route authentication request
    Router->>+Auth: 🎯 Direct to auth tool

    rect rgba(255, 235, 59, 0.1)
        Note over Auth,User: 🔐 Authentication Flow
        Auth->>User: 🌐 Return auth_url
        User->>XSUAA: 🖱️ Visit auth URL in browser
        XSUAA->>User: ✅ Return session_id
        User->>Auth: 🎫 Provide session_id
    end

    Auth->>+Manager: 🔍 Validate session
    Manager->>Store: 💾 Store secure token
    Manager->>XSUAA: ✅ Validate JWT + scopes
    XSUAA-->>Manager: 🎯 Token valid + permissions
    Manager-->>-Auth: ✅ Authentication successful
    Auth-->>-Router: 🛠️ Return available tools
    Router-->>-MCP: 📊 Tool capabilities
    MCP-->>-User: ✨ Ready for SAP operations
```

### 2. search-sap-services

```mermaid
sequenceDiagram
    participant User
    participant sap-smart-query
    participant search-sap-services
    participant SAPClient
    participant SAP Gateway

    User->>sap-smart-query: "Show available SAP services"
    sap-smart-query->>search-sap-services: Route to service discovery

    search-sap-services->>SAPClient: Get service catalog
    SAPClient->>SAP Gateway: GET /sap/opu/odata/iwfnd/catalogservice
    SAP Gateway-->>SAPClient: Service list
    SAPClient-->>search-sap-services: Parsed services

    search-sap-services->>search-sap-services: Categorize by domain
    search-sap-services-->>User: Categorized service list with metadata
```

### 3. discover-service-entities

```mermaid
sequenceDiagram
    participant User
    participant sap-smart-query
    participant discover-service-entities
    participant SAPClient
    participant SAP Service
    participant UIToolSuggester

    User->>sap-smart-query: "Show entities in SALES service"
    sap-smart-query->>discover-service-entities: Route with serviceId

    discover-service-entities->>SAPClient: Get metadata
    SAPClient->>SAP Service: GET /$metadata
    SAP Service-->>SAPClient: EDMX metadata
    SAPClient-->>discover-service-entities: Parsed entities

    discover-service-entities->>UIToolSuggester: Check for UI suggestions
    UIToolSuggester-->>discover-service-entities: Relevant UI tools

    discover-service-entities-->>User: Entity list + UI tool suggestions
```

### 4. execute-entity-operation

```mermaid
sequenceDiagram
    participant User
    participant sap-smart-query
    participant execute-entity-operation
    participant MCPAuthManager
    participant SAPClient
    participant SAP Service
    participant UIToolSuggester

    User->>sap-smart-query: "Create new Customer"
    sap-smart-query->>execute-entity-operation: Route CRUD operation

    execute-entity-operation->>MCPAuthManager: Check auth for write
    MCPAuthManager-->>execute-entity-operation: ✅ Authorized

    execute-entity-operation->>SAPClient: Build OData request
    SAPClient->>SAP Service: POST /Customers
    SAP Service-->>SAPClient: Created entity
    SAPClient-->>execute-entity-operation: Success + data

    execute-entity-operation->>UIToolSuggester: Generate UI suggestions
    UIToolSuggester-->>execute-entity-operation: Suggest ui-form-generator

    execute-entity-operation-->>User: Result + UI tool suggestions
```

---

## UI Tools

### 5. ui-form-generator

```mermaid
sequenceDiagram
    participant User
    participant sap-smart-query
    participant MCPAuthManager
    participant ui-form-generator
    participant SAPEntityManager
    participant FormBuilder
    participant HTMLRenderer

    User->>sap-smart-query: "Create form for Customer entity"

    Note over sap-smart-query: Check authentication first
    sap-smart-query->>MCPAuthManager: Validate UI scope
    MCPAuthManager-->>sap-smart-query: ✅ Has ui.forms scope

    sap-smart-query->>ui-form-generator: Route with entity info

    ui-form-generator->>SAPEntityManager: Get entity metadata
    SAPEntityManager-->>ui-form-generator: Field definitions

    ui-form-generator->>FormBuilder: Build form config
    FormBuilder->>FormBuilder: Add validation rules
    FormBuilder->>FormBuilder: Apply SAP Fiori styling
    FormBuilder-->>ui-form-generator: Form configuration

    ui-form-generator->>HTMLRenderer: Generate HTML
    HTMLRenderer->>HTMLRenderer: Add JavaScript handlers
    HTMLRenderer->>HTMLRenderer: Add CSS styling
    HTMLRenderer-->>ui-form-generator: Complete HTML

    ui-form-generator-->>User: Interactive HTML form
```

### 6. ui-data-grid

```mermaid
sequenceDiagram
    participant User
    participant sap-smart-query
    participant MCPAuthManager
    participant ui-data-grid
    participant execute-entity-operation
    participant GridBuilder
    participant HTMLRenderer

    User->>sap-smart-query: "Show products in a grid"

    sap-smart-query->>MCPAuthManager: Validate UI scope
    MCPAuthManager-->>sap-smart-query: ✅ Has ui.grids scope

    sap-smart-query->>execute-entity-operation: Fetch data first
    execute-entity-operation-->>sap-smart-query: Product data

    sap-smart-query->>ui-data-grid: Generate grid with data

    ui-data-grid->>GridBuilder: Configure columns
    GridBuilder->>GridBuilder: Add sorting logic
    GridBuilder->>GridBuilder: Add filtering
    GridBuilder->>GridBuilder: Add pagination
    GridBuilder-->>ui-data-grid: Grid configuration

    ui-data-grid->>HTMLRenderer: Generate HTML table
    HTMLRenderer->>HTMLRenderer: Add interactive JS
    HTMLRenderer->>HTMLRenderer: Apply Fiori theme
    HTMLRenderer-->>ui-data-grid: Complete HTML

    ui-data-grid-->>User: Interactive data grid
```

### 7. ui-dashboard-composer

```mermaid
sequenceDiagram
    participant User
    participant sap-smart-query
    participant MCPAuthManager
    participant ui-dashboard-composer
    participant smart-data-analysis
    participant ChartBuilder
    participant HTMLRenderer

    User->>sap-smart-query: "Dashboard for sales KPIs"

    sap-smart-query->>MCPAuthManager: Validate UI scope
    MCPAuthManager-->>sap-smart-query: ✅ Has ui.dashboards scope

    sap-smart-query->>smart-data-analysis: Analyze data first
    smart-data-analysis-->>sap-smart-query: KPI metrics

    sap-smart-query->>ui-dashboard-composer: Create dashboard

    ui-dashboard-composer->>ChartBuilder: Create KPI widgets
    ChartBuilder->>ChartBuilder: Configure Chart.js
    ChartBuilder->>ChartBuilder: Set real-time updates
    ChartBuilder-->>ui-dashboard-composer: Widget configs

    ui-dashboard-composer->>HTMLRenderer: Generate dashboard
    HTMLRenderer->>HTMLRenderer: Add responsive layout
    HTMLRenderer->>HTMLRenderer: Add WebSocket handlers
    HTMLRenderer-->>ui-dashboard-composer: Complete HTML

    ui-dashboard-composer-->>User: Interactive dashboard
```

### 8. ui-workflow-builder

```mermaid
sequenceDiagram
    participant User
    participant sap-smart-query
    participant MCPAuthManager
    participant ui-workflow-builder
    participant WorkflowEngine
    participant VisualBuilder
    participant HTMLRenderer

    User->>sap-smart-query: "Build approval workflow"

    sap-smart-query->>MCPAuthManager: Validate UI scope
    MCPAuthManager-->>sap-smart-query: ✅ Has ui.workflows scope

    sap-smart-query->>ui-workflow-builder: Route to builder

    ui-workflow-builder->>WorkflowEngine: Initialize workflow
    WorkflowEngine->>WorkflowEngine: Define states
    WorkflowEngine->>WorkflowEngine: Set transitions
    WorkflowEngine->>WorkflowEngine: Add actions
    WorkflowEngine-->>ui-workflow-builder: Workflow model

    ui-workflow-builder->>VisualBuilder: Create visual flow
    VisualBuilder->>VisualBuilder: Add drag-drop
    VisualBuilder->>VisualBuilder: Connect nodes
    VisualBuilder-->>ui-workflow-builder: Visual config

    ui-workflow-builder->>HTMLRenderer: Generate HTML
    HTMLRenderer-->>ui-workflow-builder: Interactive workflow

    ui-workflow-builder-->>User: Visual workflow builder
```

### 9. ui-report-builder

```mermaid
sequenceDiagram
    participant User
    participant sap-smart-query
    participant MCPAuthManager
    participant ui-report-builder
    participant smart-data-analysis
    participant ReportEngine
    participant HTMLRenderer

    User->>sap-smart-query: "Generate sales report"

    sap-smart-query->>MCPAuthManager: Validate UI scope
    MCPAuthManager-->>sap-smart-query: ✅ Has ui.reports scope

    sap-smart-query->>smart-data-analysis: Analyze data
    smart-data-analysis-->>sap-smart-query: Aggregated data

    sap-smart-query->>ui-report-builder: Build report

    ui-report-builder->>ReportEngine: Configure report
    ReportEngine->>ReportEngine: Set drill-down levels
    ReportEngine->>ReportEngine: Add filters
    ReportEngine->>ReportEngine: Configure charts
    ReportEngine-->>ui-report-builder: Report config

    ui-report-builder->>HTMLRenderer: Generate report
    HTMLRenderer->>HTMLRenderer: Add export buttons
    HTMLRenderer->>HTMLRenderer: Add interactivity
    HTMLRenderer-->>ui-report-builder: Complete report

    ui-report-builder-->>User: Interactive report
```

---

## AI-Enhanced Tools

### 10. natural-query-builder

```mermaid
sequenceDiagram
    participant User
    participant sap-smart-query
    participant natural-query-builder
    participant NLPEngine
    participant QueryOptimizer
    participant execute-entity-operation

    User->>sap-smart-query: "Show German customers with revenue > 1M"
    sap-smart-query->>natural-query-builder: Process natural language

    natural-query-builder->>NLPEngine: Parse intent
    NLPEngine->>NLPEngine: Extract entities
    NLPEngine->>NLPEngine: Identify filters
    NLPEngine-->>natural-query-builder: Parsed query

    natural-query-builder->>QueryOptimizer: Optimize OData
    QueryOptimizer->>QueryOptimizer: Add indexes
    QueryOptimizer->>QueryOptimizer: Optimize joins
    QueryOptimizer-->>natural-query-builder: OData query

    natural-query-builder->>execute-entity-operation: Execute query
    execute-entity-operation-->>natural-query-builder: Results

    natural-query-builder-->>User: Data + explanation
```

### 11. smart-data-analysis

```mermaid
sequenceDiagram
    participant User
    participant sap-smart-query
    participant smart-data-analysis
    participant DataAnalyzer
    participant MLEngine
    participant VisualizationEngine

    User->>sap-smart-query: "Analyze sales trends"
    sap-smart-query->>smart-data-analysis: Route to analyzer

    smart-data-analysis->>DataAnalyzer: Load dataset
    DataAnalyzer->>DataAnalyzer: Calculate statistics
    DataAnalyzer->>DataAnalyzer: Find patterns
    DataAnalyzer-->>smart-data-analysis: Analysis results

    smart-data-analysis->>MLEngine: Predict trends
    MLEngine->>MLEngine: Train model
    MLEngine->>MLEngine: Generate forecast
    MLEngine-->>smart-data-analysis: Predictions

    smart-data-analysis->>VisualizationEngine: Create visuals
    VisualizationEngine-->>smart-data-analysis: Charts

    smart-data-analysis-->>User: Insights + predictions
```

### 12. query-performance-optimizer

```mermaid
sequenceDiagram
    participant User
    participant sap-smart-query
    participant query-performance-optimizer
    participant PerformanceAnalyzer
    participant QueryRewriter
    participant CacheManager

    User->>sap-smart-query: "Query is slow, optimize it"
    sap-smart-query->>query-performance-optimizer: Analyze performance

    query-performance-optimizer->>PerformanceAnalyzer: Profile query
    PerformanceAnalyzer->>PerformanceAnalyzer: Check indexes
    PerformanceAnalyzer->>PerformanceAnalyzer: Analyze joins
    PerformanceAnalyzer-->>query-performance-optimizer: Bottlenecks

    query-performance-optimizer->>QueryRewriter: Optimize query
    QueryRewriter->>QueryRewriter: Rewrite filters
    QueryRewriter->>QueryRewriter: Optimize selects
    QueryRewriter-->>query-performance-optimizer: Optimized query

    query-performance-optimizer->>CacheManager: Cache results
    CacheManager-->>query-performance-optimizer: Cache key

    query-performance-optimizer-->>User: Optimized query + tips
```

### 13. business-process-insights

```mermaid
sequenceDiagram
    participant User
    participant sap-smart-query
    participant business-process-insights
    participant ProcessMiner
    participant BottleneckAnalyzer
    participant RecommendationEngine

    User->>sap-smart-query: "Analyze order fulfillment process"
    sap-smart-query->>business-process-insights: Analyze process

    business-process-insights->>ProcessMiner: Mine process data
    ProcessMiner->>ProcessMiner: Extract events
    ProcessMiner->>ProcessMiner: Build process map
    ProcessMiner-->>business-process-insights: Process model

    business-process-insights->>BottleneckAnalyzer: Find issues
    BottleneckAnalyzer->>BottleneckAnalyzer: Analyze delays
    BottleneckAnalyzer->>BottleneckAnalyzer: Find loops
    BottleneckAnalyzer-->>business-process-insights: Bottlenecks

    business-process-insights->>RecommendationEngine: Generate tips
    RecommendationEngine-->>business-process-insights: Improvements

    business-process-insights-->>User: Process insights
```

---

## Real-time Tools

### 14. realtime-data-stream

```mermaid
sequenceDiagram
    participant User
    participant sap-smart-query
    participant realtime-data-stream
    participant WebSocketManager
    participant ChangeDetector
    participant StreamProcessor

    User->>sap-smart-query: "Stream order updates"
    sap-smart-query->>realtime-data-stream: Setup stream

    realtime-data-stream->>WebSocketManager: Open connection
    WebSocketManager-->>realtime-data-stream: WebSocket ready

    loop Real-time monitoring
        ChangeDetector->>SAP Service: Poll changes
        SAP Service-->>ChangeDetector: New data
        ChangeDetector->>StreamProcessor: Process changes
        StreamProcessor->>WebSocketManager: Send to client
        WebSocketManager-->>User: Real-time update
    end

    User->>realtime-data-stream: Stop stream
    realtime-data-stream->>WebSocketManager: Close connection
```

### 15. monitor-query-performance

```mermaid
sequenceDiagram
    participant User
    participant sap-smart-query
    participant monitor-query-performance
    participant MetricsCollector
    participant PerformanceTracker
    participant AlertManager

    User->>sap-smart-query: "Monitor query performance"
    sap-smart-query->>monitor-query-performance: Start monitoring

    loop Performance monitoring
        MetricsCollector->>SAP Service: Collect metrics
        SAP Service-->>MetricsCollector: Response times
        MetricsCollector->>PerformanceTracker: Track metrics

        alt Performance degradation
            PerformanceTracker->>AlertManager: Trigger alert
            AlertManager-->>User: Performance warning
        end

        PerformanceTracker-->>User: Metrics dashboard
    end
```

### 16. kpi-dashboard-builder

```mermaid
sequenceDiagram
    participant User
    participant sap-smart-query
    participant kpi-dashboard-builder
    participant KPICalculator
    participant DashboardRenderer
    participant AutoRefresh

    User->>sap-smart-query: "Build KPI dashboard"
    sap-smart-query->>kpi-dashboard-builder: Create dashboard

    kpi-dashboard-builder->>KPICalculator: Define KPIs
    KPICalculator->>KPICalculator: Set formulas
    KPICalculator->>KPICalculator: Set thresholds
    KPICalculator-->>kpi-dashboard-builder: KPI definitions

    kpi-dashboard-builder->>DashboardRenderer: Render widgets
    DashboardRenderer-->>kpi-dashboard-builder: Dashboard HTML

    kpi-dashboard-builder->>AutoRefresh: Setup refresh

    loop Auto-refresh cycle
        AutoRefresh->>KPICalculator: Recalculate
        KPICalculator-->>DashboardRenderer: New values
        DashboardRenderer-->>User: Updated dashboard
    end
```

### 17. predictive-analytics-engine

```mermaid
sequenceDiagram
    participant User
    participant sap-smart-query
    participant predictive-analytics-engine
    participant DataPreprocessor
    participant MLModelEngine
    participant ForecastGenerator

    User->>sap-smart-query: "Predict Q4 sales"
    sap-smart-query->>predictive-analytics-engine: Generate forecast

    predictive-analytics-engine->>DataPreprocessor: Prepare data
    DataPreprocessor->>DataPreprocessor: Clean data
    DataPreprocessor->>DataPreprocessor: Feature engineering
    DataPreprocessor-->>predictive-analytics-engine: Prepared dataset

    predictive-analytics-engine->>MLModelEngine: Train model
    MLModelEngine->>MLModelEngine: Select algorithm
    MLModelEngine->>MLModelEngine: Train/validate
    MLModelEngine-->>predictive-analytics-engine: Trained model

    predictive-analytics-engine->>ForecastGenerator: Generate predictions
    ForecastGenerator->>ForecastGenerator: Calculate forecast
    ForecastGenerator->>ForecastGenerator: Confidence intervals
    ForecastGenerator-->>predictive-analytics-engine: Predictions

    predictive-analytics-engine-->>User: Forecast + confidence
```

---

## Authentication Flow

### Complete Authentication & Authorization Flow

```mermaid
sequenceDiagram
    participant User
    participant MCP Client
    participant sap-smart-query
    participant check-sap-authentication
    participant MCPAuthManager
    participant TokenStore
    participant SAP BTP XSUAA
    participant UI Tool

    Note over User: User requests UI tool
    User->>MCP Client: "Create form for customers"
    MCP Client->>sap-smart-query: Route request

    Note over sap-smart-query: Detects UI intent
    sap-smart-query->>sap-smart-query: Check requiresAuth

    alt Not Authenticated
        sap-smart-query-->>User: ❌ Auth required + auth_url
        User->>SAP BTP XSUAA: Visit auth URL
        SAP BTP XSUAA->>User: OAuth flow
        User->>SAP BTP XSUAA: Login
        SAP BTP XSUAA-->>User: session_id

        User->>check-sap-authentication: Provide session_id
        check-sap-authentication->>MCPAuthManager: Validate
        MCPAuthManager->>SAP BTP XSUAA: Verify JWT
        SAP BTP XSUAA-->>MCPAuthManager: Valid + scopes
        MCPAuthManager->>TokenStore: Store token
        MCPAuthManager-->>check-sap-authentication: ✅ Authenticated
        check-sap-authentication-->>User: Session associated

        User->>MCP Client: Retry "Create form for customers"
        MCP Client->>sap-smart-query: Route request
    end

    Note over sap-smart-query: User authenticated
    sap-smart-query->>MCPAuthManager: Check UI scope

    alt Has Required Scope
        MCPAuthManager-->>sap-smart-query: ✅ Has ui.forms
        sap-smart-query->>UI Tool: Execute
        UI Tool-->>User: Generated form
    else Missing Scope
        MCPAuthManager-->>sap-smart-query: ❌ Missing scope
        sap-smart-query-->>User: Insufficient permissions
    end
```

---

## Key Architectural Decisions

### 1. Tool Hierarchy
- **Problem:** Tool explosion with hundreds of entity-specific tools
- **Solution:** Hierarchical discovery with 17 intelligent tools
- **Benefit:** Reduced context, better performance

### 2. Authentication-First for UI
- **Problem:** UI tools expose sensitive operations
- **Solution:** Mandatory authentication check before UI tool execution
- **Benefit:** Security by design, clear user flow

### 3. Smart Routing
- **Problem:** Users don't know which tool to use
- **Solution:** `sap-smart-query` intelligently routes based on intent
- **Benefit:** Simplified UX, natural language support

### 4. Context Preservation
- **Problem:** Losing context between tool calls
- **Solution:** Session state management with TokenStore
- **Benefit:** Seamless multi-tool workflows

### 5. Progressive Enhancement
- **Problem:** Not all operations need authentication
- **Solution:** Public tools for discovery, auth for data operations
- **Benefit:** Flexible security model

---

## Performance Characteristics

| Tool Category | Latency | Authentication | Caching |
|--------------|---------|---------------|---------|
| Core SAP Tools | 100-500ms | Required for CRUD | Yes |
| UI Tools | 50-200ms | Always Required | Generated HTML |
| AI Tools | 200-1000ms | Recommended | Results cached |
| Real-time Tools | <50ms | Required | WebSocket |

---

## Security Model

```mermaid
graph TD
    A[User Request] --> B{Tool Type?}
    B -->|Discovery| C[No Auth Required]
    B -->|Data Operation| D[Check Auth]
    B -->|UI Tool| E[Require Auth First]

    D --> F{Authenticated?}
    F -->|No| G[Request Auth]
    F -->|Yes| H[Check Scope]

    E --> I{Authenticated?}
    I -->|No| J[Block + Guide to Auth]
    I -->|Yes| K[Validate UI Scope]

    H --> L{Has Scope?}
    L -->|Yes| M[Execute Tool]
    L -->|No| N[Deny Access]

    K --> O{Has UI Scope?}
    O -->|Yes| P[Generate UI]
    O -->|No| Q[Insufficient Permissions]
```

---

## Deployment Architecture

```mermaid
graph TB
    subgraph "SAP BTP Cloud Foundry"
        A[MCP Server] --> B[XSUAA Service]
        A --> C[Connectivity Service]
        A --> D[Destination Service]
        A --> E[Application Logging]
    end

    subgraph "Backend Systems"
        C --> F[SAP S/4HANA]
        C --> G[SAP Gateway]
        D --> H[External APIs]
    end

    subgraph "Client Layer"
        I[Claude Desktop] --> A
        J[VS Code] --> A
        K[Custom MCP Client] --> A
    end
```

---

## Conclusion

This architecture provides:
- ✅ **Scalable** tool management
- ✅ **Secure** authentication flow
- ✅ **Intelligent** routing
- ✅ **Interactive** UI generation
- ✅ **Real-time** capabilities
- ✅ **AI-powered** analytics

The system successfully reduces complexity while maintaining flexibility and security.
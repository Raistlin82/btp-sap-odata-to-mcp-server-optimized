# System Architecture

> **Reference to Original Project**  
> This architecture extends the foundation laid by [@lemaiwo](https://github.com/lemaiwo)'s original [btp-sap-odata-to-mcp-server](https://github.com/lemaiwo/btp-sap-odata-to-mcp-server) with enterprise-grade enhancements.

## 🏗️ High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        A[Claude Desktop]
        B[Other MCP Clients]
        C[Web Browser]
    end
    
    subgraph "MCP Server Application"
        D[MCP Protocol Handler]
        E[Authentication Manager]
        F[Tool Registry]
        G[Health Service]
    end
    
    subgraph "SAP BTP Services"
        H[SAP IAS]
        I[XSUAA Service]
        J[Connectivity Service]
        K[Destination Service]
        L[Cloud Logging]
    end
    
    subgraph "SAP Backend Systems"
        M[SAP S/4HANA]
        N[Other SAP Systems]
    end
    
    A --> D
    B --> D
    C --> E
    D --> E
    D --> F
    E --> H
    E --> I
    F --> J
    F --> K
    G --> L
    J --> M
    J --> N
```

## 🔧 Core Components

### 1. MCP Protocol Layer
- **Location**: `src/mcp-server.ts`, `src/tools/hierarchical-tool-registry.ts`
- **Purpose**: Handle MCP communication and tool management
- **Features**: HTTP/stdio transport, tool registration, request routing

### 2. Authentication & Authorization
- **Location**: `src/middleware/auth.ts`, `src/services/auth-server.ts`
- **Purpose**: Secure access control and session management
- **Features**: SAP IAS integration, JWT tokens, role-based permissions

### 3. Tool Registry
- **Location**: `src/tools/hierarchical-tool-registry.ts`
- **Purpose**: Manage and execute SAP OData tools
- **Categories**:
  - **Discovery Tools** (Public): `search-sap-services`, `discover-service-entities`
  - **Runtime Tools** (Authenticated): `execute-entity-operation`

### 4. SAP Connectivity Layer
- **Location**: `src/services/destination-service.ts`, `src/services/sap-client.ts`
- **Purpose**: Connect to SAP backend systems
- **Features**: Destination management, connection pooling, principal propagation

## 🔐 Security Architecture

### Authentication Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant M as MCP Server
    participant I as SAP IAS
    participant S as SAP System
    
    C->>M: Tool Request
    M->>M: Check Authentication
    alt No Session
        M->>C: Auth Instructions
        C->>I: Browser OAuth2 Flow
        I->>M: Store Session
        M->>C: Return Session ID
    end
    C->>M: Tool Request + Session ID
    M->>S: Execute with User Context
    S->>M: Return Data
    M->>C: Return Results
```

### Security Features
1. **Token Management**: JWT validation, session-based auth, auto-renewal
2. **Authorization**: Role-based access control, scope permissions
3. **Data Protection**: Request sanitization, audit logging, PII masking

## 📊 Data Flow

### Service Discovery Flow
```mermaid
graph LR
    A[Client] --> B[search-sap-services]
    B --> C[Service Discovery Config]
    C --> D[SAP Service Catalog]
    D --> E[Filter & Cache Results]
    E --> A
```

### Entity Operation Flow
```mermaid
graph LR
    A[Client + Session] --> B[execute-entity-operation]
    B --> C[Validate Auth]
    C --> D[Build OData Request]
    D --> E[SAP Backend]
    E --> F[Transform Response]
    F --> A
```

## 🚀 Deployment Architecture

### SAP BTP Cloud Foundry
```mermaid
graph TB
    subgraph "Cloud Foundry Runtime"
        A[MCP Server App]
        B[Health Endpoint]
    end
    
    subgraph "Platform Services"
        C[Connectivity]
        D[Destination]
        E[XSUAA]
        F[Cloud Logging]
    end
    
    A --> C
    A --> D
    A --> E
    A --> F
```

**Deployment Features**:
- Auto-scaling based on load
- Service binding automation
- Health check integration
- Zero-downtime deployments

## 📈 Performance Optimizations

### Caching Strategy
- **Service Metadata**: 1 hour TTL
- **Schema Definitions**: 30 minutes TTL
- **Connection Pool**: Max 10 per destination

### Resource Management
- Async I/O processing
- Connection reuse
- Efficient session storage
- Automatic cleanup processes

---

**📖 Next Steps**: [Configuration Guide](CONFIGURATION.md) | [Deployment Guide](DEPLOYMENT.md)
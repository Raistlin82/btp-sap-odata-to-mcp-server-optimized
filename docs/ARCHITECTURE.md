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
        F[Session Management]
        G[Tool Registry]
        H[Health Service]
        I[Logging Service]
    end
    
    subgraph "SAP BTP Services"
        J[SAP IAS]
        K[XSUAA Service]
        L[Connectivity Service]
        M[Cloud Logging]
        N[Destination Service]
    end
    
    subgraph "SAP Backend Systems"
        O[SAP S/4HANA]
        P[SAP SuccessFactors]
        Q[SAP Ariba]
        R[Other SAP Systems]
    end
    
    A --> D
    B --> D
    C --> E
    D --> E
    D --> G
    E --> F
    E --> J
    E --> K
    G --> L
    G --> N
    L --> O
    L --> P
    L --> Q
    L --> R
    H --> M
    I --> M
```

## 🔧 Component Architecture

### 1. MCP Protocol Layer

**Location**: `src/mcp-server.ts`, `src/tools/hierarchical-tool-registry.ts`

**Responsibilities**:
- Handle MCP protocol communication
- Manage tool registration and execution
- Provide standardized error handling
- Route requests to appropriate handlers

**Key Features**:
- HTTP and stdio transport support
- Tool capability advertisement
- Request/response validation
- Protocol version management

```typescript
interface MCPServer {
  initialize(): Promise<void>
  connectStdio(): Promise<void>
  createHTTPTransport(options): StreamableHTTPServerTransport
}
```

### 2. Authentication & Authorization Layer

**Location**: `src/middleware/auth.ts`, `src/middleware/mcp-auth.ts`, `src/services/auth-server.ts`

**Architecture**:

```mermaid
graph LR
    A[Client Request] --> B{Auth Required?}
    B -->|No| C[Public Tool]
    B -->|Yes| D{Session ID?}
    D -->|No| E[Return Auth Instructions]
    D -->|Yes| F[Validate Session]
    F -->|Valid| G[Check Scopes]
    F -->|Invalid| H[Session Expired]
    G -->|Authorized| I[Execute Tool]
    G -->|Denied| J[Insufficient Permissions]
```

**Components**:

#### IAS Authentication Service
- **File**: `src/services/ias-auth-service.ts`
- **Purpose**: Handle SAP Identity Authentication Service integration
- **Features**: OAuth2 flow, token exchange, user profile management

#### Session Management
- **File**: `src/services/token-store.ts`
- **Purpose**: Manage user sessions and JWT tokens
- **Features**: Session persistence, auto-cleanup, client tracking

#### Authorization Manager
- **File**: `src/middleware/mcp-auth.ts`
- **Purpose**: Handle request authorization and scope validation
- **Features**: Role-based access control, scope hierarchy, tool permissions

### 3. Tool Registry & Execution Engine

**Location**: `src/tools/hierarchical-tool-registry.ts`

**Architecture**:

```mermaid
graph TD
    A[Tool Request] --> B[Tool Registry]
    B --> C{Tool Type}
    C -->|Discovery| D[Service Discovery Tools]
    C -->|Schema| E[Metadata Tools]
    C -->|Runtime| F[Operation Tools]
    D --> G[SAP Service Catalog]
    E --> H[OData Metadata]
    F --> I[SAP Connectivity]
    G --> J[Return Results]
    H --> J
    I --> J
```

**Tool Categories**:

1. **Discovery Tools** (Public)
   - `search-sap-services`
   - `discover-service-entities`
   - `get-entity-schema`

2. **Runtime Tools** (Authenticated)
   - `execute-entity-operation`

**Caching Strategy**:
- Service metadata caching
- Schema definition caching
- Connection pooling
- Result caching for read operations

### 4. SAP Connectivity Layer

**Location**: `src/services/destination-service.ts`, `src/services/sap-client.ts`

**Architecture**:

```mermaid
graph LR
    A[OData Request] --> B[Destination Service]
    B --> C[Connectivity Service]
    C --> D[Cloud Connector]
    D --> E[On-Premise Systems]
    C --> F[Cloud Systems]
    B --> G[Principal Propagation]
    G --> H[User Context]
```

**Features**:
- Destination configuration management
- Principal propagation for user context
- Connection pooling and reuse
- Automatic retry with exponential backoff
- Certificate-based authentication

### 5. Monitoring & Observability Layer

**Location**: `src/services/health-service.ts`, `src/services/cloud-logging-service.ts`

#### Health Monitoring

```mermaid
graph TD
    A[Health Check Request] --> B[Health Service]
    B --> C[Connectivity Check]
    B --> D[Authentication Check]
    B --> E[Service Binding Check]
    B --> F[Memory Check]
    B --> G[Log Service Check]
    C --> H[Aggregate Status]
    D --> H
    E --> H
    F --> H
    G --> H
    H --> I[Return Health Report]
```

**Health Check Components**:
- **Connectivity**: SAP system reachability
- **Authentication**: IAS/XSUAA service status  
- **Services**: Bound service availability
- **Resources**: Memory and disk usage
- **Logging**: Cloud logging service status

#### Structured Logging

```typescript
interface LogEntry {
  "@timestamp": string
  level: "ERROR" | "WARN" | "INFO" | "DEBUG"
  message: string
  service: string
  version: string
  component: string
  correlation_id: string
  cf_app: CFAppInfo
  context: LogContext
}
```

**Logging Features**:
- Correlation ID tracking across requests
- Structured JSON format for ELK stack
- Automatic Cloud Foundry metadata injection
- Performance metrics and timing
- Error tracking with stack traces

## 🔐 Security Architecture

### Authentication Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant M as MCP Server
    participant A as Auth Server
    participant I as SAP IAS
    participant X as XSUAA
    participant S as SAP System
    
    C->>M: Tool Request
    M->>M: Check Authentication
    alt No Session
        M->>C: Auth Instructions
        C->>A: Browser Auth Request
        A->>I: IAS OAuth2 Flow
        I->>A: Authorization Code
        A->>I: Exchange for Token
        I->>A: IAS JWT Token
        A->>X: Exchange for XSUAA Token
        X->>A: XSUAA JWT Token (with scopes)
        A->>M: Store Session
        A->>C: Return Session ID
    end
    C->>M: Tool Request + Session ID
    M->>M: Validate Session
    M->>S: Execute with User Context
    S->>M: Return Data
    M->>C: Return Results
```

### Security Features

1. **Token Management**
   - JWT token validation and refresh
   - Session-based authentication
   - Automatic token renewal
   - Secure token storage

2. **Authorization**
   - Role-based access control (RBAC)
   - Scope-based permissions
   - Tool-level authorization
   - Operation-level authorization

3. **Data Protection**
   - Request/response sanitization
   - Secure error handling
   - PII data masking
   - Audit logging

## 📊 Data Flow Architecture

### Service Discovery Flow

```mermaid
graph LR
    A[Client] --> B[search-sap-services]
    B --> C[Service Discovery Config]
    C --> D[Destination Service]
    D --> E[SAP Service Catalog]
    E --> F[Filter & Format]
    F --> G[Cache Results]
    G --> A
```

### Entity Operation Flow

```mermaid
graph LR
    A[Client + Session] --> B[execute-entity-operation]
    B --> C[Validate Auth]
    C --> D[Build OData Request]
    D --> E[SAP Connectivity]
    E --> F[Principal Propagation]
    F --> G[SAP Backend]
    G --> H[Transform Response]
    H --> A
```

## 🚀 Deployment Architecture

### SAP BTP Cloud Foundry

```mermaid
graph TB
    subgraph "SAP BTP Cloud Foundry"
        subgraph "Application Runtime"
            A[MCP Server App]
            B[Auth Server]
            C[Health Endpoint]
        end
        
        subgraph "Platform Services"
            D[Connectivity Service]
            E[Destination Service]
            F[XSUAA Service]
            G[Cloud Logging]
        end
        
        subgraph "External Services"
            H[SAP IAS]
            I[Cloud Connector]
        end
    end
    
    A --> D
    A --> E
    B --> F
    B --> H
    A --> G
    D --> I
```

**Deployment Features**:
- Zero-downtime deployments
- Auto-scaling based on load
- Service binding automation
- Environment-specific configuration
- Health check integration with platform

## 🔄 Session Management Architecture

### Session Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Created: User Authentication
    Created --> Active: Session ID Generated
    Active --> Refreshed: Token Renewal
    Refreshed --> Active: Updated Token
    Active --> Expired: Timeout/Manual
    Expired --> Cleaned: Auto-cleanup
    Cleaned --> [*]
    
    Active --> Active: API Calls (extends TTL)
```

**Session Features**:
- User-specific session isolation
- Configurable session timeout
- Automatic cleanup of expired sessions
- Session persistence across app restarts
- Client-specific session tracking

## 📈 Performance Optimizations

### Caching Strategy

1. **Service Metadata Cache**
   - TTL: 1 hour
   - Scope: Per service
   - Invalidation: Manual + TTL

2. **Schema Definition Cache**
   - TTL: 30 minutes
   - Scope: Per entity set
   - Invalidation: Version-based

3. **Connection Pool**
   - Max connections: 10 per destination
   - Idle timeout: 5 minutes
   - Connection reuse for same user/destination

### Resource Management

- **Memory**: Efficient object pooling
- **CPU**: Async processing for I/O operations
- **Network**: Connection reuse and HTTP/2 support
- **Storage**: Optimized session storage with cleanup

## 🔮 Future Architecture Enhancements

### Planned Improvements

1. **Microservices Architecture**
   - Split authentication service
   - Separate tool registry service
   - Independent scaling components

2. **Advanced Caching**
   - Redis-based distributed caching
   - Cache warming strategies
   - Intelligent cache invalidation

3. **Enhanced Monitoring**
   - Application Performance Monitoring (APM)
   - Distributed tracing
   - Custom metrics dashboards
   - Alerting and notification system

4. **Multi-tenancy Support**
   - Tenant-specific configurations
   - Isolated data access
   - Tenant-aware caching

---

**📖 Related Documentation**:
- [Configuration Guide](CONFIGURATION.md)
- [Deployment Guide](DEPLOYMENT.md)  
- [API Reference](API_REFERENCE.md)
- [Troubleshooting](TROUBLESHOOTING.md)
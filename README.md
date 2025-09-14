# SAP OData to MCP Server - Enhanced Playground

> **🔗 Original Project Reference**  
> This repository is a **playground** and **experimental enhancement** of the original project:  
> **[btp-sap-odata-to-mcp-server](https://github.com/lemaiwo/btp-sap-odata-to-mcp-server)** by [@lemaiwo](https://github.com/lemaiwo)
> 
> ⚡ **Goal**: Introduce and test new features that may eventually be integrated back into the original project.

## 🏗️ Enhanced Architecture & Features

This playground extends the original SAP BTP OData MCP Server with advanced features for enterprise-grade deployments:

### 🚀 Phase 3 Complete: AI Analytics + Real-time + Optimized

- **🔐 Smart Authentication System**
  - Automatic session association (MCP session ↔ User session)
  - Persistent authentication without repeated session ID input
  - Role-based access control with granular permissions
  - OAuth 2.0 flow with SAP IAS integration

- **🧠 AI-Powered Query Intelligence**
  - Natural language to OData query conversion
  - Smart data analysis with automated insights
  - Query performance optimization using AI
  - Business process analysis and recommendations

- **⚡ Real-time Analytics & KPI Dashboards**
  - WebSocket streaming with intelligent filtering
  - Dynamic KPI dashboard builder
  - ML-powered predictive analytics engine
  - Automated business intelligence insights

- **🎯 Intelligent Tool Routing**
  - Universal `sap-smart-query` entry point for all requests
  - Context-aware routing based on user intent
  - Optimized token consumption (98% reduction)
  - JSON-based document grounding for efficiency

- **📊 Enterprise Monitoring & Logging**
  - SAP Cloud Logging integration
  - Structured JSON logging with correlation IDs
  - Health checks with detailed system status
  - Performance metrics and monitoring

- **🔄 Advanced Session Management**
  - User-specific session isolation
  - Automatic session expiration
  - Session persistence across deployments
  - Client-based session tracking

- **🛡️ Security Enhancements**
  - JWT token validation and refresh
  - Secure error handling with sanitization
  - Request/response validation
  - Security headers and CORS configuration

- **☁️ Cloud-Native Optimizations**
  - SAP BTP Cloud Foundry optimized deployment
  - Auto-scaling and resource management
  - Service discovery and binding automation
  - Graceful shutdown handling

## 🎯 MCP Tools Overview (12 Total Tools)

### 🌟 Entry Points (2 tools)
- **`check-sap-authentication`** - 🔐 Auto-start session validation
- **`sap-smart-query`** - 🧠 Universal router for ALL requests

### 🔍 Discovery & Query Building (4 tools)
- **`search-sap-services`** - Find SAP services by keyword/category
- **`discover-service-entities`** - List entities within services
- **`get-entity-schema`** - Get entity structure and properties
- **`natural-query-builder`** - Convert natural language to OData

### ⚡ Execution & AI Analysis (4 tools)
- **`execute-entity-operation`** - Direct OData CRUD operations
- **`smart-data-analysis`** - AI-powered data insights
- **`query-performance-optimizer`** - Optimize queries using AI
- **`business-process-insights`** - Business process analysis

### 🔮 Real-time Analytics (4 tools)
- **`realtime-data-stream`** - WebSocket streaming
- **`kpi-dashboard-builder`** - Dynamic KPI dashboards
- **`predictive-analytics-engine`** - ML forecasting
- **`business-intelligence-insights`** - Automated BI insights

## 📚 Documentation Structure

```
docs/
├── workflow-guide.md            # Complete workflow guide (moved from config/)
├── ARCHITECTURE.md              # System architecture and design
├── CONFIGURATION.md             # Configuration guide
├── DEPLOYMENT.md               # Deployment instructions
├── IDENTITY_MANAGEMENT_REVIEW.md # XSUAA migration action plan
└── TROUBLESHOOTING.md          # Common issues and solutions
config/
└── tool-routing-rules.json     # JSON-based routing rules (efficient document grounding)
```

## 🎯 Quick Start

### Simple 2-Step Workflow

1. **🔐 Authenticate Once**: `check-sap-authentication({ session_id: "your-id" })`
2. **🧠 Use Universal Router**: `sap-smart-query("your request")` for everything else

**That's it!** The smart router handles all the complexity automatically.

### Prerequisites

- SAP BTP Cloud Foundry environment
- SAP Identity Authentication Service (IAS)
- SAP Connectivity Service
- Node.js 18+ and npm

### 1. Clone and Install

```bash
git clone <this-repo>
cd btp-sap-odata-to-mcp-server-optimized
npm install
```

### 2. Configure Environment

Copy the example environment file and configure:

```bash
cp .env.example .env
```

Required environment variables:
```env
# SAP IAS Configuration
SAP_IAS_URL=https://your-tenant.accounts.ondemand.com
SAP_IAS_CLIENT_ID=your-client-id
SAP_IAS_CLIENT_SECRET=your-client-secret

# Server Configuration
PORT=8080
NODE_ENV=production
```

### 3. Deploy to SAP BTP

```bash
npm run build
cf push
```

### 4. Access the Application

- **Web Interface**: `https://your-app.cfapps.region.hana.ondemand.com/auth/`
- **MCP Connection**: Use the Session ID from the web interface
- **Health Check**: `https://your-app.cfapps.region.hana.ondemand.com/health`

## 🔧 Configuration

| Component | Status | Configuration File |
|-----------|--------|--------------------|
| Authentication | ✅ Ready | [CONFIGURATION.md#auth](docs/CONFIGURATION.md#authentication) |
| Cloud Logging | ✅ Ready | [CONFIGURATION.md#logging](docs/CONFIGURATION.md#logging) |
| Service Discovery | ✅ Ready | [CONFIGURATION.md#discovery](docs/CONFIGURATION.md#service-discovery) |
| Health Monitoring | ✅ Ready | [CONFIGURATION.md#health](docs/CONFIGURATION.md#health-checks) |

## 🏛️ Architecture Overview

### High-Level Architecture

```mermaid
graph TD
    A[Claude Desktop/Client] --> B[MCP Protocol]
    B --> C[SAP MCP Server]
    C --> D[Authentication Layer]
    C --> E[Session Management]
    C --> F[OData Tools Registry]
    F --> G[SAP Connectivity]
    G --> H[SAP Backend Systems]
    C --> I[Cloud Logging]
    C --> J[Health Monitoring]
```

### Component Architecture

- **MCP Protocol Layer**: Handles Model Context Protocol communication
- **Authentication Layer**: IAS/XSUAA hybrid authentication with session management  
- **Tools Registry**: Hierarchical SAP OData tools with caching
- **Connectivity Layer**: SAP BTP Connectivity Service integration
- **Monitoring Layer**: Health checks, logging, and observability

For detailed architecture information, see [ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 📖 API Reference

### MCP Tools Available

| Tool | Description | Auth Required |
|------|-------------|---------------|
| `search-sap-services` | Discover available SAP OData services | No |
| `discover-service-entities` | Get entities for a specific service | No |
| `get-entity-schema` | Retrieve entity metadata and schema | No |
| `execute-entity-operation` | Perform CRUD operations on entities | Yes* |

*Requires Session ID for runtime operations

### Authentication Flow

```mermaid
sequenceDiagram
    participant C as Claude Client
    participant M as MCP Server  
    participant I as SAP IAS
    participant S as SAP Systems
    
    C->>M: Request tool execution
    M->>M: Check authentication
    alt No Session ID
        M->>C: Return auth instructions
        C->>I: Authenticate (web browser)
        I->>C: Return Session ID
    end
    C->>M: Tool request with Session ID
    M->>S: Execute operation with user context
    S->>M: Return data
    M->>C: Return results
```

## 🚀 Deployment

### SAP BTP Cloud Foundry

The application is optimized for SAP BTP Cloud Foundry with:

- **Automatic service binding** for Connectivity and XSUAA
- **SAP Cloud Logging** integration for centralized logging
- **Health checks** for monitoring and auto-recovery
- **Resource optimization** for efficient scaling

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed deployment instructions.

### Local Development

```bash
npm run dev
```

The server will start at `http://localhost:8080` with hot reload enabled.

## 🔍 Monitoring & Observability

### Health Endpoints

- **`/health`**: Comprehensive health check with service status
- **`/auth/status`**: Authentication system status
- **Logs**: Structured JSON logs with correlation IDs

### SAP Cloud Logging Dashboard

Access centralized logs and metrics through the SAP Cloud Logging service dashboard.

## 🤝 Contributing

This is an experimental playground for testing enhancements to the original project:

1. **Test new features** in this environment
2. **Document improvements** and performance impacts
3. **Propose integration** back to the [original project](https://github.com/lemaiwo/btp-sap-odata-to-mcp-server)

### Development Workflow

1. Fork this playground repository
2. Create feature branches for new enhancements
3. Test thoroughly in SAP BTP environment
4. Document changes and performance impacts
5. Create pull request with detailed description

## 📄 License

This project follows the same license as the original project. Please refer to the [original repository](https://github.com/lemaiwo/btp-sap-odata-to-mcp-server) for licensing information.

## 🙏 Acknowledgments

- **[@lemaiwo](https://github.com/lemaiwo)** - Creator of the original SAP BTP OData MCP Server
- **SAP Community** - For comprehensive BTP documentation and best practices
- **Anthropic** - For the Model Context Protocol specification

## 🔗 Links

- **Original Project**: https://github.com/lemaiwo/btp-sap-odata-to-mcp-server
- **Model Context Protocol**: https://modelcontextprotocol.io/
- **SAP BTP Documentation**: https://help.sap.com/docs/btp
- **Claude Desktop**: https://claude.ai/desktop

---

**⚠️ Important**: This is a playground environment for testing enhancements. For production use cases, please refer to the [original stable project](https://github.com/lemaiwo/btp-sap-odata-to-mcp-server).
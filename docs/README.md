# Documentation Hub

Welcome to the complete documentation for the **SAP OData to AI-Powered MCP Server** - an enterprise-ready solution with enhanced security, simplified configuration, and comprehensive Cloud Foundry integration.

This documentation guides you through key concepts, usage, configuration, deployment, and development of this optimized MCP server.

## 📖 Documentation Navigation

### 🏗️ Architecture & Design
- **[Architecture Overview](./ARCHITECTURE.md)**: Deep dive into the system's architecture, hierarchical tool model, and smart router
- **[Architecture Sequence Diagrams](./ARCHITECTURE-SEQUENCE-DIAGRAMS.md)**: Visual representation of system interactions and workflows

### 👥 User Guides
- **[User Guide](./USER_GUIDE.md)**: Step-by-step guide for authentication, tool usage, and workflow examples
- **[Tool Reference](./TOOL_REFERENCE.md)**: Complete documentation for all available tools with parameters and examples

### ⚙️ Configuration & Deployment
- **[Configuration Guide](./CONFIGURATION.md)**: Comprehensive guide to environment variables, OData discovery, authentication, and Cloud Foundry deployment
- **[Deployment Guide](./DEPLOYMENT.md)**: Instructions for deploying to SAP BTP Cloud Foundry and local development setup

### 🧪 Development & Testing
- **[Testing Guide](./guides/TESTING.md)**: Information on running and extending the automated test suite

### 📋 Project Information
- **[Changelog](./CHANGELOG.md)**: Complete history of changes, features, and improvements

## 🚀 Quick Navigation by Use Case

### I want to...

#### **Get Started Quickly**
1. 📖 [Architecture Overview](./ARCHITECTURE.md) - Understand the system
2. ⚙️ [Configuration Guide](./CONFIGURATION.md) - Set up environment variables
3. 🚀 [Deployment Guide](./DEPLOYMENT.md) - Deploy to BTP or run locally

#### **Use the Tools**
1. 👥 [User Guide](./USER_GUIDE.md) - Learn authentication and basic usage
2. 🔧 [Tool Reference](./TOOL_REFERENCE.md) - Explore all available tools

#### **Configure OData Discovery**
1. ⚙️ [Configuration Guide - OData Discovery](./CONFIGURATION.md#odata-discovery-configuration) - Pattern-based filtering
2. ⚙️ [Configuration Guide - Cloud Foundry](./CONFIGURATION.md#cloud-foundry-deployment) - CF environment setup

#### **Understand the Security Model**
1. 🏗️ [Architecture - Security](./ARCHITECTURE.md) - Security architecture overview
2. ⚙️ [Configuration - Security](./CONFIGURATION.md#security-configuration) - XSUAA and IAS setup

#### **Deploy to Production**
1. 🚀 [Deployment Guide](./DEPLOYMENT.md) - Complete deployment instructions
2. ⚙️ [Configuration - Best Practices](./CONFIGURATION.md#best-practices-for-production) - Production configuration

#### **Develop and Test**
1. 🧪 [Testing Guide](./guides/TESTING.md) - Run test suites
2. 🏗️ [Architecture](./ARCHITECTURE.md) - Understand the codebase structure

## 🔑 Key Features Overview

### 🔐 Enhanced Security
- **Modular Authentication**: Factory pattern supporting IAS, OAuth2, JWT, Basic Auth, API Keys
- **Secure Session Management**: Thread-safe session bridging with proper locking
- **Role-Based Access Control**: Granular permissions with XSUAA integration

### 🎯 Simplified Configuration
- **Pattern-Based OData Discovery**: Simple include/exclude patterns
- **Business Domain Mode**: Pre-configured domains (sales, finance, HR)
- **Environment-Aware**: Automatic detection of Cloud Foundry vs local development

### 🧠 AI-Powered Tools
- **Smart Query Router**: Natural language to OData conversion
- **Hierarchical Architecture**: 17+ tools organized in logical layers
- **Intelligent Orchestration**: Automatic tool chaining and optimization

### 🎨 Interactive UI Tools
- **Form Generator**: Dynamic SAP Fiori forms with validation
- **Data Grids**: Interactive tables with sorting and filtering
- **Dashboards**: Real-time KPI dashboards with visualizations
- **Workflow Builder**: Visual workflow creation tools
- **Report Builder**: Analytical reports with drill-down capabilities

## 📞 Support & Contributing

- **Issues**: Report bugs or request features
- **Architecture Questions**: Refer to [Architecture Documentation](./ARCHITECTURE.md)
- **Configuration Help**: Check [Configuration Guide](./CONFIGURATION.md)
- **Deployment Issues**: See [Deployment Guide](./DEPLOYMENT.md)

---

**🏠 [← Back to Main README](../README.md)**
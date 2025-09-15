# Deployment Guide

This guide covers the two main deployment scenarios for the server: production deployment on **SAP BTP, Cloud Foundry** and configuration for **local development**.

## 1. Deployment to SAP BTP, Cloud Foundry (Production)

This is the recommended scenario for production use, taking full advantage of the BTP platform services.

### Prerequisites

Ensure that the following services are available and entitled in your BTP subaccount:

-   **Authorization & Trust Management (XSUAA)**: For role and permission management.
-   **Identity (IAS)**: For user authentication.
-   **Connectivity**: For secure connection to backend SAP systems.
-   **Destination**: For centralized management of system destinations.

### Step 1: Preparing BTP Services

Before deploying the application, you need to create instances of the BTP services it will use. These commands should be run only once.

```bash
# 1. Create the XSUAA service using your security configuration
# (Ensure the xs-security.json file is correct)
cf create-service xsuaa application sap-mcp-xsuaa -c xs-security.json

# 2. Create the connectivity service
cf create-service connectivity lite sap-mcp-connectivity

# 3. Create the destination service
cf create-service destination lite sap-mcp-destination
```

### Step 2: Build and Deploy the Application

With the services ready, you can proceed with the deployment.

```bash
# 1. Install project dependencies
npm install

# 2. Build the TypeScript source code for BTP
npm run build:btp

# 3. Deploy to Cloud Foundry
# The deploy command will use the configurations defined in mta.yaml
npm run deploy:btp
```

After the deployment, the application will start and automatically bind to the previously created services, as defined in the `mta.yaml` file.

### Step 3: Post-Deployment Configuration

1.  **Assign Roles**: In the BTP Cockpit, go to **Security > Role Collections** and assign the role collections (e.g., `MCPAdministrator`, `MCPUser`) to the users or user groups who need to access the application.

2.  **Configure Destinations**: In the BTP Cockpit, go to **Connectivity > Destinations** and create the necessary destinations to connect to your backend SAP systems (e.g., S/4HANA). Ensure that the authentication is set up correctly (e.g., `PrincipalPropagation`).

3.  **Verification**: Check the application's status with `cf apps` and access the `/health` endpoint to ensure everything is working correctly.

    ```bash
    # Check the app status
    cf apps

    # Verify the health check (replace with your URL)
    curl https://your-app-name.cfapps.region.hana.ondemand.com/health
    ```

## 2. Configuration for Local Development

To develop and test the application locally.

### Prerequisites

-   Node.js >= 18
-   A correctly configured `.env` file.

### Step 1: Environment Setup

1.  **Clone the Repository** and install dependencies:

    ```bash
    git clone <this-repo>
    cd btp-sap-odata-to-mcp-server-optimized
    npm install
    ```

2.  **Create and configure the `.env` file**:

    ```bash
    cp .env.example .env
    ```

3.  **Edit the `.env` file** with the credentials of your SAP IAS tenant (for authentication) and other necessary configurations for development. Set `NODE_ENV=development`.

    ```env
    # Example configuration for development
    NODE_ENV=development
    PORT=8080
    LOG_LEVEL=debug

    # Credentials for your development IAS tenant
    SAP_IAS_URL=https://your-dev-tenant.accounts.ondemand.com
    SAP_IAS_CLIENT_ID=...
    SAP_IAS_CLIENT_SECRET=...

    # To simulate the Destination service locally
    destinations=[{"name":"MyLocalDest","url":"http://localhost:4004/catalog","authentication":"NoAuthentication"}]
    ```

### Step 2: Starting the Development Server

Run one of the following commands:

```bash
# Start the server in development mode with hot-reload (recommended)
npm run dev

# Start the server in standard mode (requires manual build)
npm run build
npm run start
```

The server will be available at `http://localhost:8080`.

### Connecting to BTP Services (Optional)

If you want to connect to real BTP services (like XSUAA or Destination) from your local environment, you can use **service keys**.

1.  **Create a Service Key** in BTP:

    ```bash
    cf create-service-key sap-mcp-destination local-dev-key
    ```

2.  **View the Service Key** and copy the credentials into your `.env` file or a `default-env.json` file.

    ```bash
    cf service-key sap-mcp-destination local-dev-key
    ```

---

**Next Steps**: [Configuration Guide](./CONFIGURATION.md) | [Tool Reference](./TOOL_REFERENCE.md)
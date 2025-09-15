# User Guide

This guide is intended for users who need to interact with the server to query SAP data. It illustrates the authentication flow and provides practical usage examples.

## Step-by-Step Authentication Flow

Authentication is session-based and requires a single sign-on at the beginning of a conversation. Once authenticated, all tools that require data access will work without further interruption.

**Step 1: Session Start and Initial Authentication**

1.  **Start Conversation**: When you start a new conversation with the client (e.g., Claude), the MCP server creates a new session.
2.  **First Call (Automatic)**: The client should automatically call the `check-sap-authentication` tool. If you are not authenticated, the tool will respond with a link.

    ```json
    {
      "status": "authentication_required",
      "message": "🔑 Authentication required for SAP data operations",
      "auth_url": "https://<your-app-url>/auth/",
      "action": "Visit auth_url → get session_id → call check-sap-authentication({session_id: \"your_id\"})"
    }
    ```

3.  **Login via Browser**: Visit the `auth_url` in a browser. Log in with your SAP credentials (IAS).
4.  **Get the `session_id`**: After logging in, the page will display a `session_id`. Copy it.

**Step 2: Session Association**

1.  **Provide the `session_id`**: Run the `check-sap-authentication` tool again, this time providing the `session_id` you copied.

    ```
    check-sap-authentication({ session_id: "<your-session-id>" })
    ```

2.  **Confirmation**: The tool will confirm that the session has been authenticated and associated.

    ```json
    {
      "status": "authenticated",
      "message": "✅ Authentication successful! Session associated.",
      "user": "user.name@example.com"
    }
    ```

**Step 3: Using the Tools**

From this point on, you can use any tool without having to specify the `session_id` again. The server will automatically manage the security context for you. **It is always recommended to use the `sap-smart-query` tool for all requests.**

## Workflow Examples

Here are some common use-case scenarios that show how to interact with the server after authentication.

### Example 1: Finding a Customer and Viewing its Details

**Objective**: Find a specific Business Partner and get its schema details.

1.  **Service Search**: Start by searching for the correct service.

    > **You**: "Use `sap-smart-query` to find services related to business partners."

    The smart router will execute `search-sap-services` and return relevant services, such as `API_BUSINESS_PARTNER`.

2.  **Entity Exploration**: Discover which entities are available in the service.

    > **You**: "Use `sap-smart-query` to explore entities in the `API_BUSINESS_PARTNER` service."

    The router will execute `discover-service-entities` and show entities like `A_BusinessPartner`.

3.  **Get Schema**: View the entity's structure.

    > **You**: "Use `sap-smart-query` to get the schema for the `A_BusinessPartner` entity in the `API_BUSINESS_PARTNER` service."

    The router will execute `get-entity-schema`, providing you with all the fields, types, and keys.

### Example 2: Natural Language Query

**Objective**: Find all customers created in the last month.

1.  **Direct Request**: After authenticating, make your request in natural language.

    > **You**: "Use `sap-smart-query` to show me all business partners created in the last month."

2.  **Router's Automatic Workflow**:
    *   `sap-smart-query` detects that it is a natural language request.
    *   It executes `natural-query-builder` to translate your request into an OData query (e.g., `A_BusinessPartner?$filter=CreationDate ge ...`).
    *   It executes `execute-entity-operation` with the generated OData query, retrieving the data.
    *   (Optional) It executes `smart-data-analysis` to provide an analysis of the results.

3.  **Result**: You will receive the list of business partners that meet the criteria, without needing to know OData syntax.

### Example 3: Executing a Direct OData Query

**Objective**: If you are a developer and already know the OData query, you can execute it directly.

1.  **Request with OData Query**:

    > **You**: "Use `sap-smart-query` to execute the query `A_BusinessPartnerAddress?$filter=Country eq 'IT'&$top=5` in the `API_BUSINESS_PARTNER` service."

2.  **Router's Direct Execution**:
    *   `sap-smart-query` detects the OData syntax.
    *   It directly executes `execute-entity-operation` with your query.

3.  **Result**: You immediately get the top 5 business partner addresses in Italy.
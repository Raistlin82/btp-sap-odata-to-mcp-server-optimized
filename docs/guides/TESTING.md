# Complete Guide to the SAP MCP Server Test Suite

This unified guide provides all the necessary information to run, maintain, and extend the SAP MCP Server test suite, ensuring the application's stability and reliability.

## 1. Overview and Objectives

The test suite is designed to comprehensively verify the server's main functionalities, including:

-   **MCP Protocol Compliance**: Correct initialization, tool registration, and JSON-RPC communication.
-   **Authentication System**: Session management, token validation, and development fallback.
-   **Tool Execution**: Error-free operation of all main tools.
-   **Schema Validation**: Correctness and compatibility of Zod schemas with the MCP standard.
-   **Advanced Features**: Specific tests for intelligent routing, AI analysis, and real-time features.

## 2. Test Suite Structure

The tests are organized into modular files within the `/tests` folder:

```
tests/
├── run-tests.js                 # Main test runner that orchestrates execution
├── test-mcp-protocol.js         # Tests for MCP protocol compliance
├── test-authentication.js       # Tests for the authentication system
├── test-tool-execution.js       # Tests for basic tool execution
└── test-advanced-features.js    # Tests for advanced features (AI, routing)
```

## 3. How to Run the Tests

You can run the tests via NPM scripts or by executing the test runner directly.

### NPM Commands (Recommended)

```bash
# Run the complete test suite (includes advanced tests)
npm run test:all

# Run specific suites
npm run test:protocol      # Only MCP protocol tests
npm run test:auth          # Only authentication tests
npm run test:tools         # Only basic tool execution tests
npm run test:advanced      # Only advanced feature tests

# Run all tests with detailed output
npm run test:full
```

### Direct Execution with Node.js

```bash
# Run the complete suite
node tests/run-tests.js

# Run a specific suite
node tests/run-tests.js --suite=protocol

# Enable verbose output for debugging
node tests/run-tests.js --suite=all --verbose
```

## 4. Test Coverage

### Current Test Suites

1.  **MCP Protocol Tests** (`test-mcp-protocol.js`)
    *   **Verifies**: Server connection, `initialize/initialized` messages, registration of at least 12 tools, protocol version.
    *   **Success Criteria**: Stable connection, `2024-11-05` protocol supported, working JSON-RPC communication.

2.  **Authentication Tests** (`test-authentication.js`)
    *   **Verifies**: Behavior of `check-sap-authentication` with and without `session_id`, environment handling (development vs. production).
    *   **Success Criteria**: Correct responses (`auth_disabled`, `authentication_required`, `auth_failed`) based on the context.

3.  **Tool Execution Tests** (`test-tool-execution.js`)
    *   **Verifies**: Error-free execution of main tools (`search-sap-services`, `sap-smart-query`, etc.) and validity of Zod schemas.
    *   **Success Criteria**: No "Tool execution failed" errors, compliant schemas, `items` property defined for arrays.

4.  **Advanced Features Tests** (`test-advanced-features.js`)
    *   **Verifies**: Effectiveness of the `sap-smart-query` router, execution of AI tools, schema completeness, and performance under load.
    *   **Success Criteria**: Correct routing, valid schemas, handling of concurrent requests.

## 5. Extending the Test Suite

### Adding a New Test for a Tool

To test a new tool, add it to the `toolsToTest` array in `test-tool-execution.js`:

```javascript
{
    name: 'new-tool-name',
    args: {
        param1: 'value',
        param2: true
    },
    description: 'Test description for the new tool'
}
```

### Creating a New Test Suite

1.  **Create a new test file** (e.g., `tests/test-custom-feature.js`).
2.  **Integrate the new file** into `run-tests.js` by importing it and adding it to the execution logic.
3.  **Add a new NPM script** in `package.json` to run the new suite in isolation.

```json
"scripts": {
  "test:custom": "node tests/run-tests.js --suite=custom"
}
```

## 6. Debugging and Troubleshooting

### Error: "Tool execution failed"
*   **Common Cause**: Non-compliant Zod schemas (e.g., an array without `.describe()` or the `items` property).
*   **Solution**: Check the tool's schema definition in `src/tools/hierarchical-tool-registry.ts`.

### Timeout during Tests
*   **Common Causes**: Slow BTP server, unstable network connection, memory leak.
*   **Solutions**: Increase the timeout via the environment variable `TEST_TIMEOUT=45000` or run the tests in a local environment (`NODE_ENV=development npm run test:all`).

## 7. Continuous Integration (CI/CD)

The tests are designed to be run in a CI/CD pipeline to prevent regressions.

### Example Pre-Deploy Hook

```bash
#!/bin/bash
echo "Running SAP MCP Server test suite..."
npm run test:all

if [ $? -eq 0 ]; then
    echo "✅ All tests passed - proceeding with deployment"
    # Include the deploy command here, e.g., npm run deploy:btp
else
    echo "❌ Tests failed - blocking deployment"
    exit 1
fi
```

### Example for GitHub Actions

```yaml
- name: Run MCP Test Suite & Build
  run: |
    npm ci
    npm run test:all
    npm run build:btp
  env:
    NODE_ENV: test
```

## 8. Future Recommendations

-   **Increase Coverage**: Write tests for all 12+ tools.
-   **Load Testing**: Implement performance tests with a high number of concurrent requests.
-   **Mock SAP Services**: To create faster and more isolated tests, mock the SAP services.
-   **Code Coverage**: Integrate a code coverage reporting tool with the goal of exceeding 90%.
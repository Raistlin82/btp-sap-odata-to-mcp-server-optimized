#!/usr/bin/env node

/**
 * SAP MCP Server - Stdio Entry Point
 * 
 * This script provides stdio transport compatibility for standard MCP clients
 * like Claude Desktop. It runs the server in stdio mode instead of HTTP mode.
 */

import { runStdioServer } from './dist/mcp-server.js';

// Run the MCP server in stdio mode
runStdioServer([]).catch(console.error);
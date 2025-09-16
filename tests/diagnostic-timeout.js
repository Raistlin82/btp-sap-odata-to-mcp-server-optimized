#!/usr/bin/env node

/**
 * Diagnostic Test for Timeout Issues
 * Step-by-step analysis to identify where the timeout occurs
 */

import { spawn } from 'child_process';
import chalk from 'chalk';

async function diagnosticTest() {
    console.log(chalk.blue('🔍 DIAGNOSTIC: Timeout Issue Analysis'));
    console.log(chalk.blue('=====================================\n'));

    let step = 1;
    const log = (msg, level = 'info') => {
        const prefix = level === 'error' ? '❌' : level === 'success' ? '✅' : 'ℹ';
        console.log(`${prefix} Step ${step++}: ${msg}`);
    };

    return new Promise((resolve) => {
        log('Starting MCP server for diagnostic...');

        const child = spawn('node', ['dist/index.js'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, NODE_ENV: 'test' }
        });

        let serverReady = false;
        let timeoutHit = false;
        const startTime = Date.now();

        // 30-second diagnostic timeout
        const timeout = setTimeout(() => {
            timeoutHit = true;
            log(`Timeout hit after ${Date.now() - startTime}ms`, 'error');
            child.kill();
            resolve({ success: false, step: step - 1, reason: 'timeout' });
        }, 30000);

        child.stderr.on('data', (data) => {
            const msg = data.toString();

            // Check for key server initialization messages
            if (msg.includes('SAP MCP Server running on stdio')) {
                serverReady = true;
                log(`Server ready after ${Date.now() - startTime}ms`, 'success');

                // Now try the MCP protocol handshake
                log('Sending initialize request...');

                const initRequest = {
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'initialize',
                    params: {
                        protocolVersion: '2024-11-05',
                        capabilities: {
                            roots: { listChanged: true }
                        },
                        clientInfo: { name: 'diagnostic-test', version: '1.0.0' }
                    }
                };

                child.stdin.write(JSON.stringify(initRequest) + '\n');
            }
        });

        let responseCount = 0;
        child.stdout.on('data', (data) => {
            const output = data.toString();

            try {
                const lines = output.split('\n').filter(line => line.trim());
                for (const line of lines) {
                    const response = JSON.parse(line);
                    responseCount++;

                    if (response.id === 1 && response.result) {
                        log(`Initialize response received (${Date.now() - startTime}ms)`, 'success');

                        // Now request tools list
                        log('Requesting tools list...');
                        const toolsRequest = {
                            jsonrpc: '2.0',
                            id: 2,
                            method: 'tools/list'
                        };
                        child.stdin.write(JSON.stringify(toolsRequest) + '\n');

                    } else if (response.id === 2 && response.result) {
                        log(`Tools list received: ${response.result.tools?.length || 0} tools (${Date.now() - startTime}ms)`, 'success');

                        // Now try to execute ONE simple tool
                        log('Testing search-sap-services tool...');
                        const toolRequest = {
                            jsonrpc: '2.0',
                            id: 3,
                            method: 'tools/call',
                            params: {
                                name: 'search-sap-services',
                                arguments: { query: 'test', limit: 1 }
                            }
                        };
                        child.stdin.write(JSON.stringify(toolRequest) + '\n');

                    } else if (response.id === 3) {
                        if (response.error) {
                            log(`Tool execution failed: ${response.error.message} (${Date.now() - startTime}ms)`, 'error');
                        } else {
                            log(`Tool executed successfully (${Date.now() - startTime}ms)`, 'success');
                        }

                        // Success - cleanup
                        clearTimeout(timeout);
                        child.kill();
                        log(`Diagnostic completed in ${Date.now() - startTime}ms`, 'success');
                        resolve({
                            success: true,
                            totalTime: Date.now() - startTime,
                            serverReadyTime: serverReady ? 'yes' : 'no',
                            step: step - 1
                        });
                        return;
                    }
                }
            } catch (e) {
                // Ignore parse errors for now
            }
        });

        child.on('error', (error) => {
            log(`Server error: ${error.message}`, 'error');
            if (!timeoutHit) {
                clearTimeout(timeout);
                resolve({ success: false, step: step - 1, reason: 'server_error', error: error.message });
            }
        });

        child.on('exit', (code) => {
            if (!timeoutHit) {
                log(`Server exited with code ${code}`, code === 0 ? 'success' : 'error');
                clearTimeout(timeout);
                resolve({ success: code === 0, step: step - 1, reason: 'server_exit', code });
            }
        });
    });
}

// Run the diagnostic
diagnosticTest().then(result => {
    console.log('\n' + chalk.blue('📊 DIAGNOSTIC RESULTS:'));
    console.log(`Success: ${result.success ? '✅' : '❌'}`);
    console.log(`Completed Step: ${result.step}`);
    console.log(`Total Time: ${result.totalTime || 'N/A'}ms`);
    if (result.reason) console.log(`Reason: ${result.reason}`);

    process.exit(result.success ? 0 : 1);
});
#!/usr/bin/env node

/**
 * Debug Schema Tool - Verifica schema JSON generato per smart-data-analysis
 */

import { spawn } from 'child_process';

const debugSchema = () => {
    console.log('🔍 Debug schema smart-data-analysis...');

    const child = spawn('node', ['dist/mcp-server.js'], {
        stdio: ['pipe', 'pipe', 'pipe']
    });

    let messageId = 1;

    child.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');

        for (const line of lines) {
            if (line.trim().startsWith('{')) {
                try {
                    const message = JSON.parse(line.trim());

                    if (message.id === 1 && message.result) {
                        // Send initialized
                        const initializedMsg = JSON.stringify({
                            jsonrpc: "2.0",
                            method: "notifications/initialized",
                            params: {}
                        });
                        child.stdin.write(initializedMsg + '\n');

                        // Get tools list
                        setTimeout(() => {
                            const toolsMsg = JSON.stringify({
                                jsonrpc: "2.0",
                                id: ++messageId,
                                method: "tools/list"
                            });
                            child.stdin.write(toolsMsg + '\n');
                        }, 500);
                    }

                    if (message.id === 2 && message.result?.tools) {
                        const tools = message.result.tools;
                        const smartDataTool = tools.find(t => t.name === 'smart-data-analysis');

                        if (smartDataTool) {
                            console.log('\n📊 Schema smart-data-analysis:');
                            console.log(JSON.stringify(smartDataTool.inputSchema, null, 2));

                            // Verifica problemi specifici Copilot
                            const dataProperty = smartDataTool.inputSchema.properties?.data;
                            console.log('\n🔍 Analisi proprietà "data":');
                            console.log('- Type:', dataProperty?.type);
                            console.log('- Items:', dataProperty?.items ? '✅ Present' : '❌ Missing');
                            console.log('- Items type:', dataProperty?.items?.type);

                            if (dataProperty?.type === 'array' && !dataProperty?.items) {
                                console.log('\n❌ PROBLEMA TROVATO: Array senza proprietà items!');
                                console.log('📝 Copilot richiede proprietà "items" per tutti gli array.');
                            } else {
                                console.log('\n✅ Schema sembra corretto per Copilot');
                            }
                        } else {
                            console.log('❌ Tool smart-data-analysis non trovato!');
                        }

                        child.kill();
                    }
                } catch (e) {
                    // Ignore non-JSON
                }
            }
        }
    });

    child.stderr.on('data', (data) => {
        const stderr = data.toString();
        if (stderr.includes('Connected to stdio transport')) {
            setTimeout(() => {
                const initMessage = JSON.stringify({
                    jsonrpc: "2.0",
                    id: messageId,
                    method: "initialize",
                    params: {
                        protocolVersion: "2024-11-05",
                        capabilities: { tools: {} },
                        clientInfo: { name: "schema-debug", version: "1.0.0" }
                    }
                });
                child.stdin.write(initMessage + '\n');
            }, 1000);
        }
    });
};

debugSchema();
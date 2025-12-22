#!/usr/bin/env node

/**
 * Simple MCP Client Test Script
 * Demonstrates how to send requests to the MCP server programmatically
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const SERVER_SCRIPT = join(__dirname, 'index.js');

// Helper function to send a request and get response
function sendRequest(server, request) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let responseHandler = null;
    
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, 10000);

    responseHandler = (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            // Check if this is the response we're waiting for
            if (response.id === request.id) {
              clearTimeout(timeout);
              server.stdout.removeListener('data', responseHandler);
              resolve(response);
              return;
            }
          } catch (e) {
            // Not JSON, might be error output
            console.error('Parse error:', e, 'Line:', line);
          }
        }
      }
    };

    server.stdout.on('data', responseHandler);
    
    // Send request
    server.stdin.write(JSON.stringify(request) + '\n');
  });
}

// Main test function
async function testMCP() {
  console.log('🚀 Starting MCP Server...\n');
  
  // Start the MCP server
  const server = spawn('node', [SERVER_SCRIPT], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      // Add your database config here or use environment variables
      DB_USER: process.env.DB_USER || 'postgres',
      DB_HOST: process.env.DB_HOST || 'localhost',
      DB_NAME: process.env.DB_NAME || 'postgres',
      DB_PASSWORD: process.env.DB_PASSWORD || 'password',
      DB_PORT: process.env.DB_PORT || '5432',
    }
  });

  // Handle server errors
  server.stderr.on('data', (data) => {
    const message = data.toString();
    // MCP servers typically log to stderr
    if (message.includes('running')) {
      console.log('✅', message.trim());
    } else if (message.includes('error') || message.includes('Error')) {
      console.error('❌', message.trim());
    }
  });

  // Wait a moment for server to start
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    // Test 1: List available tools
    console.log('\n📋 Test 1: Listing available tools...');
    const listToolsRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    };
    
    const toolsResponse = await sendRequest(server, listToolsRequest);
    if (toolsResponse.result && toolsResponse.result.tools) {
      console.log(`✅ Found ${toolsResponse.result.tools.length} tools:`);
      toolsResponse.result.tools.forEach(tool => {
        console.log(`   • ${tool.name}: ${tool.description}`);
      });
    } else {
      console.log('Response:', JSON.stringify(toolsResponse, null, 2));
    }

    // Test 2: Get connection info
    console.log('\n🔌 Test 2: Getting connection information...');
    const connInfoRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'get_connection_info',
        arguments: {}
      }
    };
    
    const connResponse = await sendRequest(server, connInfoRequest);
    if (connResponse.result && connResponse.result.content) {
      console.log('✅ Connection info retrieved');
      connResponse.result.content.forEach(content => {
        if (content.type === 'text') {
          console.log('\n' + content.text);
        }
      });
    } else if (connResponse.error) {
      console.error('❌ Error:', connResponse.error);
    }

    // Test 3: List databases
    console.log('\n🗄️  Test 3: Listing databases...');
    const listDbRequest = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'list_databases',
        arguments: {}
      }
    };
    
    const dbResponse = await sendRequest(server, listDbRequest);
    if (dbResponse.result && dbResponse.result.content) {
      console.log('✅ Databases retrieved');
      dbResponse.result.content.forEach(content => {
        if (content.type === 'text') {
          console.log('\n' + content.text);
        }
      });
    } else if (dbResponse.error) {
      console.error('❌ Error:', dbResponse.error);
    }

    console.log('\n✅ All tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    // Cleanup
    server.kill();
    process.exit(0);
  }
}

// Run tests
testMCP().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


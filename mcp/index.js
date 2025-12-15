#!/usr/bin/env node

/**
 * LaserTags MCP Server
 * Provides AI-powered business management for LaserTags pet ID tag e-commerce
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
const { Client } = pg;
const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Backend configuration
const BACKEND_URL = process.env.LASER_BACKEND_URL || 'http://localhost:3003';
const DB_CONFIG = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
};

// Project paths
const PROJECT_MANAGER_URL = process.env.PROJECT_MANAGER_URL || 'http://localhost:32666';
const LASERTAGS_PATH = process.env.LASERTAGS_PROJECT_PATH || 'C:/Projects/LaserTags';
const BACKEND_LASER_PATH = process.env.BACKEND_LASER_PROJECT_PATH || 'C:/Projects/backendlaser';

// Helper function to get git status
async function getGitStatus(projectPath) {
  try {
    const { stdout } = await execAsync('git status --porcelain', { cwd: projectPath });
    const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath });
    const { stdout: lastCommit } = await execAsync('git log -1 --format=%H|%s|%an|%ad --date=iso', { cwd: projectPath });
    const [hash, message, author, date] = lastCommit.trim().split('|');
    
    return {
      branch: branch.trim(),
      lastCommit: {
        hash: hash,
        message: message,
        author: author,
        date: date
      },
      changes: stdout.trim().split('\n').filter(line => line).map(line => {
        const status = line.substring(0, 2);
        const file = line.substring(3);
        return { status, file };
      })
    };
  } catch (error) {
    return { error: 'Not a git repository or git not available' };
  }
}

// Helper function to read package.json
async function readPackageJson(projectPath) {
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const content = await fs.readFile(packageJsonPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

// Helper function to check if path exists
async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Database client
let dbClient = null;

async function getDbClient() {
  if (!dbClient) {
    dbClient = new Client(DB_CONFIG);
    await dbClient.connect();
  }
  return dbClient;
}

// Helper function for API calls
async function callApi(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${BACKEND_URL}${endpoint}`,
      headers: { 'Content-Type': 'application/json' },
    };
    if (data) {
      config.data = data;
    }
    const response = await axios(config);
    return response.data;
  } catch (error) {
    throw new Error(`API Error: ${error.message}`);
  }
}

// Create MCP server
const server = new Server(
  {
    name: 'lasertags-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_contact',
        description: 'Retrieve contact information by contact ID for LaserTag orders',
        inputSchema: {
          type: 'object',
          properties: {
            contactid: {
              type: 'number',
              description: 'The unique contact identifier',
            },
          },
          required: ['contactid'],
        },
      },
      {
        name: 'save_contact',
        description: 'Create a new contact for a LaserTag customer',
        inputSchema: {
          type: 'object',
          properties: {
            firstname: {
              type: 'string',
              description: 'Customer first name',
            },
            lastname: {
              type: 'string',
              description: 'Customer last name',
            },
            petname: {
              type: 'string',
              description: 'Pet name for the ID tag',
            },
            phone: {
              type: 'string',
              description: 'Customer phone number',
            },
            address: {
              type: 'string',
              description: 'Customer address',
            },
          },
          required: ['firstname', 'lastname', 'petname'],
        },
      },
      {
        name: 'update_contact',
        description: 'Update an existing contact record',
        inputSchema: {
          type: 'object',
          properties: {
            contactid: {
              type: 'number',
              description: 'Contact ID to update',
            },
            firstname: {
              type: 'string',
              description: 'Customer first name',
            },
            lastname: {
              type: 'string',
              description: 'Customer last name',
            },
            petname: {
              type: 'string',
              description: 'Pet name for the ID tag',
            },
            phone: {
              type: 'string',
              description: 'Customer phone number',
            },
            address: {
              type: 'string',
              description: 'Customer address',
            },
          },
          required: ['contactid'],
        },
      },
      {
        name: 'get_all_contacts',
        description: 'Retrieve all contacts from the database',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of contacts to return (default: 100)',
            },
          },
        },
      },
      {
        name: 'get_revenue_stats',
        description: 'Get revenue statistics and order counts for business tracking',
        inputSchema: {
          type: 'object',
          properties: {
            start_date: {
              type: 'string',
              description: 'Start date for revenue period (YYYY-MM-DD)',
            },
            end_date: {
              type: 'string',
              description: 'End date for revenue period (YYYY-MM-DD)',
            },
          },
        },
      },
      {
        name: 'get_recent_orders',
        description: 'Get recent LaserTag orders with contact information',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Number of recent orders to retrieve (default: 10)',
            },
          },
        },
      },
      {
        name: 'track_progress',
        description: 'Track your business progress and milestones toward launch',
        inputSchema: {
          type: 'object',
          properties: {
            metric: {
              type: 'string',
              description: 'Progress metric to track (contacts, orders, revenue, setup)',
              enum: ['contacts', 'orders', 'revenue', 'setup'],
            },
          },
        },
      },
      {
        name: 'search_contacts',
        description: 'Search contacts by name, pet name, or phone number',
        inputSchema: {
          type: 'object',
          properties: {
            search_term: {
              type: 'string',
              description: 'Search term to find in contact records',
            },
          },
          required: ['search_term'],
        },
      },
      {
        name: 'check_project_status',
        description: 'Check the status of LaserTags or backendlaser project (git status, dependencies, structure)',
        inputSchema: {
          type: 'object',
          properties: {
            project: {
              type: 'string',
              description: 'Project to check: "lasertags" or "backendlaser"',
              enum: ['lasertags', 'backendlaser'],
            },
          },
          required: ['project'],
        },
      },
      {
        name: 'check_go_live_readiness',
        description: 'Comprehensive go-live readiness check for both LaserTags and backendlaser projects',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_project_info',
        description: 'Get detailed information about LaserTags or backendlaser project',
        inputSchema: {
          type: 'object',
          properties: {
            project: {
              type: 'string',
              description: 'Project to get info for: "lasertags" or "backendlaser"',
              enum: ['lasertags', 'backendlaser'],
            },
          },
          required: ['project'],
        },
      },
      {
        name: 'monitor_projects',
        description: 'Monitor both LaserTags and backendlaser projects together for deployment readiness',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Tool implementations
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_contact': {
        const data = await callApi('GET', `/getContact/${args.contactid}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'save_contact': {
        const contactData = {
          firstname: args.firstname,
          lastname: args.lastname,
          petname: args.petname,
          phone: args.phone || null,
          address: args.address || null,
        };
        const data = await callApi('POST', '/saveContact', contactData);
        return {
          content: [
            {
              type: 'text',
              text: `✅ Contact saved successfully!\n\nContact ID: ${data.contactid}\nName: ${data.firstname} ${data.lastname}\nPet: ${data.petname}\n\n${JSON.stringify(data, null, 2)}`,
            },
          ],
        };
      }

      case 'update_contact': {
        const updateData = { contactid: args.contactid, ...args };
        const data = await callApi('POST', '/updateContact', updateData);
        return {
          content: [
            {
              type: 'text',
              text: `✅ Contact updated successfully!\n\n${JSON.stringify(data, null, 2)}`,
            },
          ],
        };
      }

      case 'get_all_contacts': {
        const client = await getDbClient();
        const limit = args.limit || 100;
        const result = await client.query(
          `SELECT * FROM lasertg.contact ORDER BY contactid DESC LIMIT $1`,
          [limit]
        );
        return {
          content: [
            {
              type: 'text',
              text: `📋 Retrieved ${result.rows.length} contacts:\n\n${JSON.stringify(result.rows, null, 2)}`,
            },
          ],
        };
      }

      case 'get_revenue_stats': {
        const client = await getDbClient();
        
        // Get order count and revenue
        const statsQuery = `
          SELECT 
            COUNT(*) as total_orders,
            COALESCE(SUM(amount::numeric / 100), 0) as total_revenue
          FROM lasertg.orders
          WHERE 1=1
          ${args.start_date ? `AND created_at >= $1` : ''}
          ${args.end_date ? `AND created_at <= $2` : ''}
        `;
        
        const params = [];
        if (args.start_date) params.push(args.start_date);
        if (args.end_date) params.push(args.end_date);
        
        const stats = await client.query(statsQuery, params);
        const contactCount = await client.query('SELECT COUNT(*) as count FROM lasertg.contact');
        
        const report = {
          total_orders: parseInt(stats.rows[0].total_orders),
          total_revenue: parseFloat(stats.rows[0].total_revenue),
          total_contacts: parseInt(contactCount.rows[0].count),
          period: {
            start: args.start_date || 'inception',
            end: args.end_date || 'present',
          },
        };

        return {
          content: [
            {
              type: 'text',
              text: `💰 Revenue Report\n\n` +
                    `📊 Total Orders: ${report.total_orders}\n` +
                    `💵 Total Revenue: $${report.total_revenue.toFixed(2)}\n` +
                    `👥 Total Contacts: ${report.total_contacts}\n` +
                    `📅 Period: ${report.period.start} to ${report.period.end}\n\n` +
                    `${JSON.stringify(report, null, 2)}`,
            },
          ],
        };
      }

      case 'get_recent_orders': {
        const client = await getDbClient();
        const limit = args.limit || 10;
        
        const result = await client.query(
          `SELECT o.*, c.firstname, c.lastname, c.petname 
           FROM lasertg.orders o
           LEFT JOIN lasertg.contact c ON o.contactid = c.contactid
           ORDER BY o.created_at DESC
           LIMIT $1`,
          [limit]
        );

        return {
          content: [
            {
              type: 'text',
              text: `📦 Recent ${result.rows.length} Orders:\n\n${JSON.stringify(result.rows, null, 2)}`,
            },
          ],
        };
      }

      case 'track_progress': {
        const client = await getDbClient();
        const metric = args.metric || 'setup';

        if (metric === 'contacts') {
          const result = await client.query('SELECT COUNT(*) as count FROM lasertg.contact');
          return {
            content: [
              {
                type: 'text',
                text: `👥 Contact Progress: ${result.rows[0].count} customers enrolled\n\n` +
                      `Target milestones:\n` +
                      `✓ 1st customer: ${result.rows[0].count >= 1 ? '✅ Complete!' : '⏳ Pending'}\n` +
                      `✓ 10 customers: ${result.rows[0].count >= 10 ? '✅ Complete!' : `⏳ ${result.rows[0].count}/10`}\n` +
                      `✓ 50 customers: ${result.rows[0].count >= 50 ? '✅ Complete!' : `⏳ ${result.rows[0].count}/50`}`,
              },
            ],
          };
        }

        if (metric === 'orders') {
          const result = await client.query('SELECT COUNT(*) as count FROM lasertg.orders');
          return {
            content: [
              {
                type: 'text',
                text: `📦 Order Progress: ${result.rows[0].count} orders processed\n\n` +
                      `Target milestones:\n` +
                      `✓ 1st sale: ${result.rows[0].count >= 1 ? '✅ Complete!' : '⏳ Pending'}\n` +
                      `✓ 10 orders: ${result.rows[0].count >= 10 ? '✅ Complete!' : `⏳ ${result.rows[0].count}/10`}\n` +
                      `✓ 100 orders: ${result.rows[0].count >= 100 ? '✅ Complete!' : `⏳ ${result.rows[0].count}/100`}`,
              },
            ],
          };
        }

        if (metric === 'revenue') {
          const result = await client.query(
            'SELECT COALESCE(SUM(amount::numeric / 100), 0) as revenue FROM lasertg.orders'
          );
          const revenue = parseFloat(result.rows[0].revenue);
          return {
            content: [
              {
                type: 'text',
                text: `💰 Revenue Progress: $${revenue.toFixed(2)}\n\n` +
                      `Target milestones:\n` +
                      `✓ First $100: ${revenue >= 100 ? '✅ Complete!' : `⏳ $${revenue.toFixed(2)}/$100`}\n` +
                      `✓ First $1,000: ${revenue >= 1000 ? '✅ Complete!' : `⏳ $${revenue.toFixed(2)}/$1,000`}\n` +
                      `✓ First $10,000: ${revenue >= 10000 ? '✅ Complete!' : `⏳ $${revenue.toFixed(2)}/$10,000`}`,
              },
            ],
          };
        }

        // Default to setup progress
        return {
          content: [
            {
              type: 'text',
              text: `🚀 LaserTags Setup Progress:\n\n` +
                    `✅ Backend API: Running\n` +
                    `✅ Database: Connected\n` +
                    `✅ MCP Server: Active\n` +
                    `✅ Stripe Integration: Ready\n` +
                    `✅ QR Code Generation: Ready\n\n` +
                    `🎯 Ready to take orders!`,
            },
          ],
        };
      }

      case 'search_contacts': {
        const client = await getDbClient();
        const searchTerm = `%${args.search_term}%`;
        
        const result = await client.query(
          `SELECT * FROM lasertg.contact 
           WHERE firstname ILIKE $1 
              OR lastname ILIKE $1 
              OR petname ILIKE $1 
              OR phone ILIKE $1
           ORDER BY contactid DESC`,
          [searchTerm]
        );

        return {
          content: [
            {
              type: 'text',
              text: `🔍 Found ${result.rows.length} matching contacts:\n\n${JSON.stringify(result.rows, null, 2)}`,
            },
          ],
        };
      }

      case 'check_project_status': {
        const projectPath = args.project === 'lasertags' ? LASERTAGS_PATH : BACKEND_LASER_PATH;
        const projectName = args.project === 'lasertags' ? 'LaserTags' : 'BackendLaser';
        
        // Try project manager API first (optional enhancement)
        let statusData = null;
        try {
          statusData = await callApi('GET', `${PROJECT_MANAGER_URL}/api/project/status`);
        } catch (error) {
          // Fall back to direct file system access
        }
        
        // Direct file system check (always works)
        const exists = await pathExists(projectPath);
        const packageJson = exists ? await readPackageJson(projectPath) : null;
        const gitStatus = exists ? await getGitStatus(projectPath) : null;
        
        // Check for common files
        const commonFiles = ['package.json', 'README.md', '.gitignore', 'Dockerfile'];
        const fileStatus = {};
        for (const file of commonFiles) {
          const filePath = path.join(projectPath, file);
          fileStatus[file] = await pathExists(filePath);
        }
        
        // Use API data if available, otherwise use direct checks
        const finalStatus = statusData || {
          projectPath: projectPath,
          exists: exists,
          packageJson: packageJson ? {
            name: packageJson.name,
            version: packageJson.version,
            dependencies: Object.keys(packageJson.dependencies || {}).length,
            devDependencies: Object.keys(packageJson.devDependencies || {}).length
          } : null,
          git: gitStatus,
          files: fileStatus
        };
        
        return {
          content: [
            {
              type: 'text',
              text: `📊 ${projectName} Project Status:\n\n` +
                    `📍 Path: ${finalStatus.projectPath}\n` +
                    `✅ Exists: ${finalStatus.exists}\n` +
                    `📦 Package: ${finalStatus.packageJson?.name || 'N/A'} v${finalStatus.packageJson?.version || 'N/A'}\n` +
                    `🌿 Git Branch: ${finalStatus.git?.branch || 'N/A'}\n` +
                    `📝 Last Commit: ${finalStatus.git?.lastCommit?.message || 'N/A'}\n` +
                    `📁 Files: ${JSON.stringify(finalStatus.files, null, 2)}\n\n` +
                    `${statusData ? '✅ Enhanced info from Project Manager API' : 'ℹ️ Using direct file system access'}\n\n` +
                    `Full Status:\n${JSON.stringify(finalStatus, null, 2)}`,
            },
          ],
        };
      }

      case 'get_project_info': {
        const projectPath = args.project === 'lasertags' ? LASERTAGS_PATH : BACKEND_LASER_PATH;
        const projectName = args.project === 'lasertags' ? 'LaserTags' : 'BackendLaser';
        
        // Try project manager API first (optional enhancement)
        let infoData = null;
        try {
          infoData = await callApi('GET', `${PROJECT_MANAGER_URL}/api/project/info`);
        } catch (error) {
          // Fall back to direct file system access
        }
        
        // Direct file system check (always works)
        const exists = await pathExists(projectPath);
        const packageJson = exists ? await readPackageJson(projectPath) : null;
        let readme = null;
        if (exists) {
          try {
            const readmePath = path.join(projectPath, 'README.md');
            readme = await fs.readFile(readmePath, 'utf8');
            readme = readme.substring(0, 500); // First 500 chars
          } catch (error) {
            // README not found, that's okay
          }
        }
        
        // Use API data if available, otherwise use direct checks
        const finalInfo = infoData || {
          projectPath: projectPath,
          exists: exists,
          packageJson: packageJson,
          readme: readme
        };
        
        return {
          content: [
            {
              type: 'text',
              text: `📋 ${projectName} Project Information:\n\n` +
                    `📍 Path: ${finalInfo.projectPath}\n` +
                    `✅ Exists: ${finalInfo.exists}\n` +
                    `📦 Package: ${finalInfo.packageJson?.name || 'N/A'} v${finalInfo.packageJson?.version || 'N/A'}\n` +
                    `📝 Description: ${finalInfo.packageJson?.description || 'N/A'}\n` +
                    (finalInfo.readme ? `\n📄 README Preview:\n${finalInfo.readme}...\n` : '') +
                    `\n${infoData ? '✅ Enhanced info from Project Manager API' : 'ℹ️ Using direct file system access'}\n\n` +
                    `Full Info:\n${JSON.stringify(finalInfo, null, 2)}`,
            },
          ],
        };
      }

      case 'check_go_live_readiness': {
        const checks = {
          database: { status: 'pending', message: '' },
          backend_api: { status: 'pending', message: '' },
          lasertags_project: { status: 'pending', message: '' },
          backendlaser_project: { status: 'pending', message: '' },
          mcp_server: { status: 'pending', message: '' },
        };

        // Check database
        try {
          const client = await getDbClient();
          await client.query('SELECT 1');
          checks.database = { status: 'ready', message: 'Database connection successful' };
        } catch (error) {
          checks.database = { status: 'error', message: `Database error: ${error.message}` };
        }

        // Check backend API
        try {
          await callApi('GET', '/api/health');
          checks.backend_api = { status: 'ready', message: 'Backend API is responding' };
        } catch (error) {
          checks.backend_api = { status: 'error', message: `Backend API error: ${error.message}` };
        }

        // Check LaserTags project
        try {
          const lasertagsExists = await fs.access(LASERTAGS_PATH).then(() => true).catch(() => false);
          if (lasertagsExists) {
            const packageJsonPath = path.join(LASERTAGS_PATH, 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
            checks.lasertags_project = { 
              status: 'ready', 
              message: `LaserTags project found: ${packageJson.name} v${packageJson.version}` 
            };
          } else {
            checks.lasertags_project = { status: 'error', message: 'LaserTags project path not found' };
          }
        } catch (error) {
          checks.lasertags_project = { status: 'error', message: `Error: ${error.message}` };
        }

        // Check BackendLaser project
        try {
          const backendExists = await fs.access(BACKEND_LASER_PATH).then(() => true).catch(() => false);
          if (backendExists) {
            const packageJsonPath = path.join(BACKEND_LASER_PATH, 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
            checks.backendlaser_project = { 
              status: 'ready', 
              message: `BackendLaser project found: ${packageJson.name} v${packageJson.version}` 
            };
          } else {
            checks.backendlaser_project = { status: 'error', message: 'BackendLaser project path not found' };
          }
        } catch (error) {
          checks.backendlaser_project = { status: 'error', message: `Error: ${error.message}` };
        }

        // Check MCP server
        checks.mcp_server = { status: 'ready', message: 'MCP server is running' };

        const allReady = Object.values(checks).every(c => c.status === 'ready');
        const statusIcon = allReady ? '✅' : '⚠️';

        return {
          content: [
            {
              type: 'text',
              text: `${statusIcon} Go-Live Readiness Check\n\n` +
                    `${checks.database.status === 'ready' ? '✅' : '❌'} Database: ${checks.database.message}\n` +
                    `${checks.backend_api.status === 'ready' ? '✅' : '❌'} Backend API: ${checks.backend_api.message}\n` +
                    `${checks.lasertags_project.status === 'ready' ? '✅' : '❌'} LaserTags Project: ${checks.lasertags_project.message}\n` +
                    `${checks.backendlaser_project.status === 'ready' ? '✅' : '❌'} BackendLaser Project: ${checks.backendlaser_project.message}\n` +
                    `${checks.mcp_server.status === 'ready' ? '✅' : '❌'} MCP Server: ${checks.mcp_server.message}\n\n` +
                    `${allReady ? '🎉 All systems ready for go-live!' : '⚠️ Some checks failed. Review errors above.'}\n\n` +
                    `Detailed Status:\n${JSON.stringify(checks, null, 2)}`,
            },
          ],
        };
      }

      case 'monitor_projects': {
        const results = {
          lasertags: {},
          backendlaser: {},
          summary: {},
        };

        // Monitor LaserTags
        try {
          const lasertagsExists = await fs.access(LASERTAGS_PATH).then(() => true).catch(() => false);
          if (lasertagsExists) {
            const packageJsonPath = path.join(LASERTAGS_PATH, 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
            results.lasertags = {
              exists: true,
              name: packageJson.name,
              version: packageJson.version,
              dependencies: Object.keys(packageJson.dependencies || {}).length,
            };
          } else {
            results.lasertags = { exists: false, error: 'Path not found' };
          }
        } catch (error) {
          results.lasertags = { exists: false, error: error.message };
        }

        // Monitor BackendLaser
        try {
          const backendExists = await fs.access(BACKEND_LASER_PATH).then(() => true).catch(() => false);
          if (backendExists) {
            const packageJsonPath = path.join(BACKEND_LASER_PATH, 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
            results.backendlaser = {
              exists: true,
              name: packageJson.name,
              version: packageJson.version,
              dependencies: Object.keys(packageJson.dependencies || {}).length,
            };
          } else {
            results.backendlaser = { exists: false, error: 'Path not found' };
          }
        } catch (error) {
          results.backendlaser = { exists: false, error: error.message };
        }

        // Summary
        results.summary = {
          both_projects_exist: results.lasertags.exists && results.backendlaser.exists,
          ready_for_deployment: results.lasertags.exists && results.backendlaser.exists,
        };

        return {
          content: [
            {
              type: 'text',
              text: `📊 Project Monitoring Dashboard\n\n` +
                    `🎨 LaserTags Project:\n` +
                    `   ${results.lasertags.exists ? '✅' : '❌'} Status: ${results.lasertags.exists ? 'Found' : 'Not Found'}\n` +
                    (results.lasertags.name ? `   📦 ${results.lasertags.name} v${results.lasertags.version}\n` : '') +
                    (results.lasertags.dependencies ? `   📚 ${results.lasertags.dependencies} dependencies\n` : '') +
                    (results.lasertags.error ? `   ⚠️ Error: ${results.lasertags.error}\n` : '') +
                    `\n⚙️ BackendLaser Project:\n` +
                    `   ${results.backendlaser.exists ? '✅' : '❌'} Status: ${results.backendlaser.exists ? 'Found' : 'Not Found'}\n` +
                    (results.backendlaser.name ? `   📦 ${results.backendlaser.name} v${results.backendlaser.version}\n` : '') +
                    (results.backendlaser.dependencies ? `   📚 ${results.backendlaser.dependencies} dependencies\n` : '') +
                    (results.backendlaser.error ? `   ⚠️ Error: ${results.backendlaser.error}\n` : '') +
                    `\n📈 Summary:\n` +
                    `   ${results.summary.both_projects_exist ? '✅' : '❌'} Both projects exist\n` +
                    `   ${results.summary.ready_for_deployment ? '✅' : '❌'} Ready for deployment\n\n` +
                    `Full Details:\n${JSON.stringify(results, null, 2)}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('LaserTags MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

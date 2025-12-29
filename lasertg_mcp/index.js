#!/usr/bin/env node

/**
 * LaserTags MCP Server - UPDATED FOR ACTUAL SCHEMA
 * Provides AI-powered business management for LaserTags pet ID tag e-commerce
 * 
 * Schema Notes:
 * - contact table uses `id` not `contactid`
 * - orders table uses `id` not `orderid`
 * - Updated to match actual database structure
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import pg from 'pg';
const { Client } = pg;

// Database configuration
const DB_CONFIG = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
};

// Database client
let dbClient = null;

async function getDbClient() {
  if (!dbClient) {
    dbClient = new Client(DB_CONFIG);
    await dbClient.connect();
  }
  return dbClient;
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
            email: {
              type: 'string',
              description: 'Customer email address',
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
            email: {
              type: 'string',
              description: 'Customer email address',
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
        name: 'check_database',
        description: 'Verify database connection and schema is properly set up',
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
        const client = await getDbClient();
        const result = await client.query(
          'SELECT * FROM lasertg.contact WHERE id = $1',
          [args.contactid]
        );
        
        if (result.rows.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Contact ID ${args.contactid} not found`,
              },
            ],
          };
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `📋 Contact Details:\n\n${JSON.stringify(result.rows[0], null, 2)}`,
            },
          ],
        };
      }

      case 'save_contact': {
        const client = await getDbClient();
        
        // Create fullname
        const fullname = `${args.firstname} ${args.lastname}`;
        
        const result = await client.query(
          `INSERT INTO lasertg.contact (firstname, lastname, petname, fullname, phone, email)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [args.firstname, args.lastname, args.petname, fullname, args.phone || null, args.email || null]
        );
        
        const newContact = result.rows[0];
        
        return {
          content: [
            {
              type: 'text',
              text: `✅ Contact saved successfully!\n\n` +
                    `Contact ID: ${newContact.id}\n` +
                    `Name: ${newContact.firstname} ${newContact.lastname}\n` +
                    `Pet: ${newContact.petname}\n` +
                    `Phone: ${newContact.phone || 'N/A'}\n` +
                    `Email: ${newContact.email || 'N/A'}\n\n` +
                    `${JSON.stringify(newContact, null, 2)}`,
            },
          ],
        };
      }

      case 'update_contact': {
        const client = await getDbClient();
        
        // Build dynamic update query
        const updates = [];
        const values = [];
        let paramCount = 1;
        
        if (args.firstname) {
          updates.push(`firstname = $${paramCount++}`);
          values.push(args.firstname);
        }
        if (args.lastname) {
          updates.push(`lastname = $${paramCount++}`);
          values.push(args.lastname);
        }
        if (args.petname) {
          updates.push(`petname = $${paramCount++}`);
          values.push(args.petname);
        }
        if (args.phone) {
          updates.push(`phone = $${paramCount++}`);
          values.push(args.phone);
        }
        if (args.email) {
          updates.push(`email = $${paramCount++}`);
          values.push(args.email);
        }
        
        // Update fullname if first or last name changed
        if (args.firstname || args.lastname) {
          // Get current values to construct fullname
          const current = await client.query('SELECT firstname, lastname FROM lasertg.contact WHERE id = $1', [args.contactid]);
          if (current.rows.length > 0) {
            const fname = args.firstname || current.rows[0].firstname;
            const lname = args.lastname || current.rows[0].lastname;
            updates.push(`fullname = $${paramCount++}`);
            values.push(`${fname} ${lname}`);
          }
        }
        
        if (updates.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: '⚠️ No fields to update',
              },
            ],
          };
        }
        
        values.push(args.contactid); // Add contactid at the end
        
        const query = `UPDATE lasertg.contact SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
        const result = await client.query(query, values);
        
        if (result.rows.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Contact ID ${args.contactid} not found`,
              },
            ],
          };
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `✅ Contact updated successfully!\n\n${JSON.stringify(result.rows[0], null, 2)}`,
            },
          ],
        };
      }

      case 'get_all_contacts': {
        const client = await getDbClient();
        const limit = args.limit || 100;
        const result = await client.query(
          'SELECT * FROM lasertg.contact ORDER BY id DESC LIMIT $1',
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

      case 'search_contacts': {
        const client = await getDbClient();
        const searchTerm = `%${args.search_term}%`;
        
        const result = await client.query(
          `SELECT * FROM lasertg.contact 
           WHERE firstname ILIKE $1 
              OR lastname ILIKE $1 
              OR petname ILIKE $1 
              OR phone ILIKE $1
              OR email ILIKE $1
           ORDER BY id DESC`,
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

      case 'get_revenue_stats': {
        const client = await getDbClient();
        
        // Build WHERE clause for date filtering
        let whereClause = 'WHERE 1=1';
        const params = [];
        let paramCount = 1;
        
        if (args.start_date) {
          whereClause += ` AND created_at >= $${paramCount++}`;
          params.push(args.start_date);
        }
        if (args.end_date) {
          whereClause += ` AND created_at <= $${paramCount++}`;
          params.push(args.end_date);
        }
        
        // Get order statistics
        const statsQuery = `
          SELECT 
            COUNT(*) as total_orders,
            COUNT(DISTINCT contactid) as unique_customers,
            COALESCE(SUM(amount::numeric / 100), 0) as total_revenue
          FROM lasertg.orders
          ${whereClause}
        `;
        
        const stats = await client.query(statsQuery, params);
        const contactCount = await client.query('SELECT COUNT(*) as count FROM lasertg.contact');
        
        const report = {
          total_orders: parseInt(stats.rows[0].total_orders),
          total_revenue: parseFloat(stats.rows[0].total_revenue),
          unique_customers: parseInt(stats.rows[0].unique_customers || 0),
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
                    `👥 Unique Customers: ${report.unique_customers}\n` +
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
          `SELECT 
             o.id as orderid,
             o.*,
             c.firstname, 
             c.lastname, 
             c.petname,
             c.phone,
             c.email
           FROM lasertg.orders o
           LEFT JOIN lasertg.contact c ON o.contactid = c.id
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
                    `✅ Database: Connected\n` +
                    `✅ MCP Server: Active\n` +
                    `✅ Contact Table: Ready\n` +
                    `✅ Orders Table: Ready\n\n` +
                    `🎯 Ready to take orders!`,
            },
          ],
        };
      }

      case 'check_database': {
        const client = await getDbClient();
        
        // Check schema exists
        const schemaCheck = await client.query(
          "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'lasertg'"
        );
        
        // Check tables
        const tableCheck = await client.query(
          `SELECT table_name FROM information_schema.tables 
           WHERE table_schema = 'lasertg' AND table_name IN ('contact', 'orders')`
        );
        
        // Check contact table columns
        const contactColumns = await client.query(
          `SELECT column_name, data_type 
           FROM information_schema.columns 
           WHERE table_schema = 'lasertg' AND table_name = 'contact'
           ORDER BY ordinal_position`
        );
        
        // Check orders table columns
        const orderColumns = await client.query(
          `SELECT column_name, data_type 
           FROM information_schema.columns 
           WHERE table_schema = 'lasertg' AND table_name = 'orders'
           ORDER BY ordinal_position`
        );
        
        // Count existing data
        const contactCount = await client.query('SELECT COUNT(*) as count FROM lasertg.contact');
        const orderCount = await client.query('SELECT COUNT(*) as count FROM lasertg.orders');
        
        return {
          content: [
            {
              type: 'text',
              text: `🔍 Database Check Results:\n\n` +
                    `✅ Schema 'lasertg': ${schemaCheck.rows.length > 0 ? 'Exists' : 'Missing'}\n` +
                    `✅ Tables Found: ${tableCheck.rows.map(r => r.table_name).join(', ')}\n\n` +
                    `📊 Data Summary:\n` +
                    `   Contacts: ${contactCount.rows[0].count}\n` +
                    `   Orders: ${orderCount.rows[0].count}\n\n` +
                    `📋 Contact Table Columns:\n` +
                    `${contactColumns.rows.map(c => `   - ${c.column_name} (${c.data_type})`).join('\n')}\n\n` +
                    `📋 Orders Table Columns:\n` +
                    `${orderColumns.rows.map(c => `   - ${c.column_name} (${c.data_type})`).join('\n')}`,
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
          text: `❌ Error: ${error.message}\n\nStack: ${error.stack}`,
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

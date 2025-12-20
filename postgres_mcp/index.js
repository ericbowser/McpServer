#!/usr/bin/env node

/**
 * PostgreSQL MCP Server
 * Provides database management tools for backups, restores, and database information
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import pg from 'pg';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { Client } = pg;

// Database configuration
const DB_CONFIG = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
};

// Backup directory
const BACKUP_DIR = process.env.BACKUP_DIR || join(__dirname, 'backups');

// Ensure backup directory exists
if (!existsSync(BACKUP_DIR)) {
  mkdirSync(BACKUP_DIR, { recursive: true });
}

// Database client
let dbClient = null;

async function getDbClient(database = null) {
  const config = { ...DB_CONFIG };
  if (database) {
    config.database = database;
  }
  const client = new Client(config);
  await client.connect();
  return client;
}

// Helper function to format file size
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Security: Validate PostgreSQL identifier format
// Valid identifiers: start with letter/underscore, contain only alphanumeric, underscore, dollar
function isValidIdentifier(identifier) {
  if (!identifier || typeof identifier !== 'string') return false;
  // PostgreSQL identifier rules: must start with letter or underscore, can contain letters, digits, underscore, dollar
  // We use a strict validation to prevent injection
  return /^[a-zA-Z_][a-zA-Z0-9_$]*$/.test(identifier) && identifier.length <= 63;
}

// Security: Escape identifier for shell commands (validate and quote if needed)
function escapeShellIdentifier(identifier) {
  if (!isValidIdentifier(identifier)) {
    throw new Error(`Invalid identifier format: ${identifier}`);
  }
  // If identifier contains only safe characters, return as-is
  // Otherwise, wrap in double quotes and escape any double quotes inside
  if (/^[a-zA-Z_][a-zA-Z0-9_$]*$/.test(identifier)) {
    return identifier;
  }
  // This shouldn't happen with our validation, but be safe
  return `"${identifier.replace(/"/g, '\\"')}"`;
}

// Security: Get quoted identifier from PostgreSQL (for SQL queries)
async function quoteIdent(client, identifier) {
  if (!isValidIdentifier(identifier)) {
    throw new Error(`Invalid identifier format: ${identifier}`);
  }
  const result = await client.query('SELECT quote_ident($1) as quoted', [identifier]);
  return result.rows[0].quoted;
}

// Create MCP server
const server = new Server(
  {
    name: 'postgres-mcp-server',
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
        name: 'create_backup',
        description: 'Create a backup of a PostgreSQL database',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              description: 'Database name to backup (default: uses DB_NAME from env)',
            },
            filename: {
              type: 'string',
              description: 'Optional custom filename for the backup (without extension)',
            },
            format: {
              type: 'string',
              enum: ['custom', 'plain', 'tar'],
              description: 'Backup format: custom (recommended), plain (SQL), or tar (default: custom)',
            },
          },
        },
      },
      {
        name: 'restore_backup',
        description: 'Restore a PostgreSQL database from a backup file',
        inputSchema: {
          type: 'object',
          properties: {
            filename: {
              type: 'string',
              description: 'Backup filename (from backups directory) or full path',
            },
            database: {
              type: 'string',
              description: 'Target database name (default: uses DB_NAME from env)',
            },
            create_database: {
              type: 'boolean',
              description: 'Create the database if it does not exist (default: false)',
            },
          },
          required: ['filename'],
        },
      },
      {
        name: 'list_backups',
        description: 'List all available backup files',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              description: 'Filter backups by database name',
            },
          },
        },
      },
      {
        name: 'list_databases',
        description: 'List all PostgreSQL databases',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_database_info',
        description: 'Get detailed information about a specific database',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              description: 'Database name (default: uses DB_NAME from env)',
            },
          },
        },
      },
      {
        name: 'list_tables',
        description: 'List all tables in a database or schema',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              description: 'Database name (default: uses DB_NAME from env)',
            },
            schema: {
              type: 'string',
              description: 'Schema name (default: public)',
            },
          },
        },
      },
      {
        name: 'get_table_info',
        description: 'Get detailed information about a specific table',
        inputSchema: {
          type: 'object',
          properties: {
            table_name: {
              type: 'string',
              description: 'Table name',
            },
            schema: {
              type: 'string',
              description: 'Schema name (default: public)',
            },
            database: {
              type: 'string',
              description: 'Database name (default: uses DB_NAME from env)',
            },
          },
          required: ['table_name'],
        },
      },
      {
        name: 'get_database_size',
        description: 'Get the size of a database and its tables',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              description: 'Database name (default: uses DB_NAME from env)',
            },
          },
        },
      },
      {
        name: 'get_connection_info',
        description: 'Get PostgreSQL server connection information and version',
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
      case 'create_backup': {
        const database = args.database || DB_CONFIG.database;
        const format = args.format || 'custom';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = args.filename 
          ? `${args.filename}.${format === 'custom' ? 'dump' : format === 'tar' ? 'tar' : 'sql'}`
          : `${database}_${timestamp}.${format === 'custom' ? 'dump' : format === 'tar' ? 'tar' : 'sql'}`;
        const backupPath = join(BACKUP_DIR, filename);

        // Validate database name to prevent injection
        if (!isValidIdentifier(database)) {
          throw new Error(`Invalid database name: ${database}`);
        }
        
        // Build pg_dump command with escaped database name
        const safeDatabase = escapeShellIdentifier(database);
        const pgDumpCmd = `pg_dump -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -F ${format} -f "${backupPath}" ${safeDatabase}`;
        
        // Set PGPASSWORD environment variable
        const env = { ...process.env, PGPASSWORD: DB_CONFIG.password };

        try {
          const { stdout, stderr } = await execAsync(pgDumpCmd, { env });
          
          if (stderr && !stderr.includes('WARNING')) {
            throw new Error(stderr);
          }

          const stats = statSync(backupPath);
          
          return {
            content: [
              {
                type: 'text',
                text: `✅ Backup created successfully!\n\n` +
                      `Database: ${database}\n` +
                      `Format: ${format}\n` +
                      `Filename: ${filename}\n` +
                      `Path: ${backupPath}\n` +
                      `Size: ${formatBytes(stats.size)}\n` +
                      `Created: ${new Date(stats.birthtime).toLocaleString()}`,
              },
            ],
          };
        } catch (error) {
          throw new Error(`Backup failed: ${error.message}`);
        }
      }

      case 'restore_backup': {
        const database = args.database || DB_CONFIG.database;
        let backupPath = args.filename;
        
        // If not absolute path, assume it's in backup directory
        if (!backupPath.includes('\\') && !backupPath.includes('/')) {
          backupPath = join(BACKUP_DIR, backupPath);
        }

        if (!existsSync(backupPath)) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Backup file not found: ${backupPath}`,
              },
            ],
            isError: true,
          };
        }

        // Determine backup format from extension
        const ext = backupPath.split('.').pop().toLowerCase();
        const format = ext === 'dump' ? 'custom' : ext === 'tar' ? 'tar' : 'plain';

        // Validate database name to prevent injection
        if (!isValidIdentifier(database)) {
          throw new Error(`Invalid database name: ${database}`);
        }
        
        // Create database if requested
        if (args.create_database) {
          const createDbClient = await getDbClient('postgres');
          try {
            // Use quote_ident to safely escape the database name
            const quotedDb = await quoteIdent(createDbClient, database);
            await createDbClient.query(`CREATE DATABASE ${quotedDb}`);
            await createDbClient.end();
          } catch (error) {
            if (!error.message.includes('already exists')) {
              throw new Error(`Failed to create database: ${error.message}`);
            }
          }
        }

        // Build restore command with escaped database name
        const safeDatabase = escapeShellIdentifier(database);
        let restoreCmd;
        if (format === 'custom' || format === 'tar') {
          restoreCmd = `pg_restore -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -d ${safeDatabase} -c "${backupPath}"`;
        } else {
          restoreCmd = `psql -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -d ${safeDatabase} -f "${backupPath}"`;
        }

        const env = { ...process.env, PGPASSWORD: DB_CONFIG.password };

        try {
          const { stdout, stderr } = await execAsync(restoreCmd, { env });
          
          if (stderr && !stderr.includes('WARNING') && !stderr.includes('NOTICE')) {
            throw new Error(stderr);
          }

          return {
            content: [
              {
                type: 'text',
                text: `✅ Backup restored successfully!\n\n` +
                      `Database: ${database}\n` +
                      `Backup: ${basename(backupPath)}\n` +
                      `Format: ${format}\n` +
                      `Restored: ${new Date().toLocaleString()}`,
              },
            ],
          };
        } catch (error) {
          throw new Error(`Restore failed: ${error.message}`);
        }
      }

      case 'list_backups': {
        const files = readdirSync(BACKUP_DIR)
          .filter(f => f.endsWith('.dump') || f.endsWith('.tar') || f.endsWith('.sql'))
          .map(f => {
            const filePath = join(BACKUP_DIR, f);
            const stats = statSync(filePath);
            return {
              filename: f,
              size: formatBytes(stats.size),
              created: stats.birthtime.toLocaleString(),
              modified: stats.mtime.toLocaleString(),
            };
          })
          .sort((a, b) => new Date(b.created) - new Date(a.created));

        let filtered = files;
        if (args.database) {
          filtered = files.filter(f => f.filename.includes(args.database));
        }

        if (filtered.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `📦 No backups found${args.database ? ` for database: ${args.database}` : ''}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `📦 Available Backups (${filtered.length}):\n\n` +
                    filtered.map(f => 
                      `📄 ${f.filename}\n` +
                      `   Size: ${f.size}\n` +
                      `   Created: ${f.created}\n`
                    ).join('\n'),
            },
          ],
        };
      }

      case 'list_databases': {
        const client = await getDbClient('postgres');
        const result = await client.query(`
          SELECT 
            datname as name,
            pg_size_pretty(pg_database_size(datname)) as size,
            datcollate as collation,
            datctype as ctype
          FROM pg_database
          WHERE datistemplate = false
          ORDER BY datname
        `);
        await client.end();

        return {
          content: [
            {
              type: 'text',
              text: `🗄️  PostgreSQL Databases (${result.rows.length}):\n\n` +
                    result.rows.map(db => 
                      `📊 ${db.name}\n` +
                      `   Size: ${db.size}\n` +
                      `   Collation: ${db.collation}\n`
                    ).join('\n'),
            },
          ],
        };
      }

      case 'get_database_info': {
        const database = args.database || DB_CONFIG.database;
        
        // Validate database name to prevent injection
        if (!isValidIdentifier(database)) {
          throw new Error(`Invalid database name: ${database}`);
        }
        
        const client = await getDbClient(database);

        // Get database size
        const sizeResult = await client.query('SELECT pg_size_pretty(pg_database_size($1)) as size', [database]);
        
        // Get connection count
        const connResult = await client.query(`
          SELECT count(*) as connections
          FROM pg_stat_activity
          WHERE datname = $1
        `, [database]);

        // Get table count
        const tableResult = await client.query(`
          SELECT count(*) as table_count
          FROM information_schema.tables
          WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        `);

        // Get schema list
        const schemaResult = await client.query(`
          SELECT schema_name
          FROM information_schema.schemata
          WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
          ORDER BY schema_name
        `);

        await client.end();

        return {
          content: [
            {
              type: 'text',
              text: `📊 Database Information: ${database}\n\n` +
                    `Size: ${sizeResult.rows[0].size}\n` +
                    `Active Connections: ${connResult.rows[0].connections}\n` +
                    `Tables: ${tableResult.rows[0].table_count}\n` +
                    `Schemas: ${schemaResult.rows.map(s => s.schema_name).join(', ')}\n`,
            },
          ],
        };
      }

      case 'list_tables': {
        const database = args.database || DB_CONFIG.database;
        const schema = args.schema || 'public';
        
        // Validate identifiers to prevent injection
        if (!isValidIdentifier(database)) {
          throw new Error(`Invalid database name: ${database}`);
        }
        if (!isValidIdentifier(schema)) {
          throw new Error(`Invalid schema name: ${schema}`);
        }
        
        const client = await getDbClient(database);

        const result = await client.query(`
          SELECT 
            table_name,
            table_type
          FROM information_schema.tables
          WHERE table_schema = $1
          ORDER BY table_name
        `, [schema]);

        await client.end();

        if (result.rows.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `📋 No tables found in schema '${schema}' of database '${database}'`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `📋 Tables in ${database}.${schema} (${result.rows.length}):\n\n` +
                    result.rows.map(t => `  • ${t.table_name} (${t.table_type})`).join('\n'),
            },
          ],
        };
      }

      case 'get_table_info': {
        const database = args.database || DB_CONFIG.database;
        const schema = args.schema || 'public';
        const tableName = args.table_name;
        
        // Validate identifiers to prevent SQL injection
        if (!isValidIdentifier(schema)) {
          throw new Error(`Invalid schema name: ${schema}`);
        }
        if (!isValidIdentifier(tableName)) {
          throw new Error(`Invalid table name: ${tableName}`);
        }
        if (!isValidIdentifier(database)) {
          throw new Error(`Invalid database name: ${database}`);
        }
        
        const client = await getDbClient(database);

        // Get quoted identifiers for safe SQL construction
        const quotedSchema = await quoteIdent(client, schema);
        const quotedTable = await quoteIdent(client, tableName);
        const qualifiedName = `${quotedSchema}.${quotedTable}`;

        // Get table size - use regclass for safe identifier resolution
        const sizeResult = await client.query(`
          SELECT 
            pg_size_pretty(pg_total_relation_size($1::regclass)) as total_size,
            pg_size_pretty(pg_relation_size($1::regclass)) as table_size,
            pg_size_pretty(pg_total_relation_size($1::regclass) - pg_relation_size($1::regclass)) as indexes_size
        `, [qualifiedName]);

        // Get row count - use quoted identifiers
        const countResult = await client.query(`SELECT count(*) as row_count FROM ${quotedSchema}.${quotedTable}`);

        // Get columns
        const columnsResult = await client.query(`
          SELECT 
            column_name,
            data_type,
            character_maximum_length,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2
          ORDER BY ordinal_position
        `, [schema, tableName]);

        // Get indexes - use parameterized query with validated identifiers
        const indexesResult = await client.query(`
          SELECT indexname, indexdef
          FROM pg_indexes
          WHERE schemaname = $1 AND tablename = $2
        `, [schema, tableName]);

        await client.end();

        return {
          content: [
            {
              type: 'text',
              text: `📋 Table Information: ${schema}.${tableName}\n\n` +
                    `Size: ${sizeResult.rows[0].total_size} (table: ${sizeResult.rows[0].table_size}, indexes: ${sizeResult.rows[0].indexes_size})\n` +
                    `Rows: ${parseInt(countResult.rows[0].row_count).toLocaleString()}\n\n` +
                    `Columns (${columnsResult.rows.length}):\n` +
                    columnsResult.rows.map(c => 
                      `  • ${c.column_name}: ${c.data_type}${c.character_maximum_length ? `(${c.character_maximum_length})` : ''} ` +
                      `${c.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}${c.column_default ? ` DEFAULT ${c.column_default}` : ''}`
                    ).join('\n') +
                    `\n\nIndexes (${indexesResult.rows.length}):\n` +
                    (indexesResult.rows.length > 0 
                      ? indexesResult.rows.map(i => `  • ${i.indexname}`).join('\n')
                      : '  (none)'),
            },
          ],
        };
      }

      case 'get_database_size': {
        const database = args.database || DB_CONFIG.database;
        
        // Validate database name to prevent injection
        if (!isValidIdentifier(database)) {
          throw new Error(`Invalid database name: ${database}`);
        }
        
        const client = await getDbClient(database);

        // Get database size
        const dbSizeResult = await client.query('SELECT pg_size_pretty(pg_database_size($1)) as size', [database]);

        // Get table sizes
        const tableSizesResult = await client.query(`
          SELECT 
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
            pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size
          FROM pg_tables
          WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
          ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        `);

        await client.end();

        return {
          content: [
            {
              type: 'text',
              text: `💾 Database Size: ${database}\n\n` +
                    `Total Database Size: ${dbSizeResult.rows[0].size}\n\n` +
                    `Largest Tables:\n` +
                    tableSizesResult.rows.map(t => 
                      `  • ${t.schemaname}.${t.tablename}: ${t.size} (table: ${t.table_size})`
                    ).join('\n'),
            },
          ],
        };
      }

      case 'get_connection_info': {
        const client = await getDbClient('postgres');

        // Get PostgreSQL version
        const versionResult = await client.query('SELECT version()');
        
        // Get server settings
        const settingsResult = await client.query(`
          SELECT name, setting, unit
          FROM pg_settings
          WHERE name IN ('max_connections', 'shared_buffers', 'effective_cache_size', 'maintenance_work_mem')
          ORDER BY name
        `);

        // Get current connections
        const connectionsResult = await client.query(`
          SELECT 
            count(*) as total_connections,
            count(*) FILTER (WHERE state = 'active') as active_connections,
            count(*) FILTER (WHERE state = 'idle') as idle_connections
          FROM pg_stat_activity
        `);

        await client.end();

        return {
          content: [
            {
              type: 'text',
              text: `🔌 PostgreSQL Connection Information\n\n` +
                    `Version: ${versionResult.rows[0].version.split(',')[0]}\n` +
                    `Host: ${DB_CONFIG.host}:${DB_CONFIG.port}\n` +
                    `User: ${DB_CONFIG.user}\n\n` +
                    `Connections:\n` +
                    `  Total: ${connectionsResult.rows[0].total_connections}\n` +
                    `  Active: ${connectionsResult.rows[0].active_connections}\n` +
                    `  Idle: ${connectionsResult.rows[0].idle_connections}\n\n` +
                    `Server Settings:\n` +
                    settingsResult.rows.map(s => 
                      `  • ${s.name}: ${s.setting}${s.unit ? ` ${s.unit}` : ''}`
                    ).join('\n'),
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
  console.error('PostgreSQL MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});


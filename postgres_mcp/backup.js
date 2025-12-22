#!/usr/bin/env node

/**
 * Standalone PostgreSQL Backup Utility
 * Usage: node backup.js [database] [filename]
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const DB_CONFIG = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || '5432',
};

const BACKUP_DIR = process.env.BACKUP_DIR || join(__dirname, 'backups');
const FORMAT = process.env.BACKUP_FORMAT || 'custom'; // custom, plain, tar, inserts
const SCHEMA = process.env.BACKUP_SCHEMA || null; // Optional schema filter

// Ensure backup directory exists
if (!existsSync(BACKUP_DIR)) {
  mkdirSync(BACKUP_DIR, { recursive: true });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Security: Validate PostgreSQL identifier format
function isValidIdentifier(identifier) {
  if (!identifier || typeof identifier !== 'string') return false;
  return /^[a-zA-Z_][a-zA-Z0-9_$]*$/.test(identifier) && identifier.length <= 63;
}

// Security: Escape identifier for shell commands
function escapeShellIdentifier(identifier) {
  if (!isValidIdentifier(identifier)) {
    throw new Error(`Invalid identifier format: ${identifier}`);
  }
  return identifier;
}

async function createBackup(database, filename, schema = null) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  
  // Determine file extension based on format
  let ext;
  if (FORMAT === 'custom') ext = 'dump';
  else if (FORMAT === 'tar') ext = 'tar';
  else if (FORMAT === 'inserts') ext = 'sql';
  else ext = 'sql';
  
  const backupFile = filename 
    ? `${filename}.${ext}`
    : schema 
      ? `${database}_${schema}_${timestamp}.${ext}`
      : `${database}_${timestamp}.${ext}`;
  const backupPath = join(BACKUP_DIR, backupFile);

  // Validate database name to prevent injection
  if (!isValidIdentifier(database)) {
    console.error(`❌ Invalid database name: ${database}`);
    process.exit(1);
  }
  
  // Validate schema name if provided
  if (schema && !isValidIdentifier(schema)) {
    console.error(`❌ Invalid schema name: ${schema}`);
    process.exit(1);
  }

  console.log(`Creating backup of database: ${database}`);
  if (schema) console.log(`Schema: ${schema}`);
  console.log(`Format: ${FORMAT}`);
  console.log(`Output: ${backupPath}`);

  const safeDatabase = escapeShellIdentifier(database);
  let pgDumpCmd = `pg_dump -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user}`;
  
  // Add format flag (for inserts, we use plain format with --inserts flag)
  if (FORMAT === 'inserts') {
    pgDumpCmd += ` -F plain --inserts`;
  } else {
    pgDumpCmd += ` -F ${FORMAT}`;
  }
  
  // Add schema filter if specified
  if (schema) {
    const safeSchema = escapeShellIdentifier(schema);
    pgDumpCmd += ` -n ${safeSchema}`;
  }
  
  // Add output file and database
  pgDumpCmd += ` -f "${backupPath}" ${safeDatabase}`;
  
  const env = { ...process.env, PGPASSWORD: DB_CONFIG.password };

  try {
    const { stdout, stderr } = await execAsync(pgDumpCmd, { env });
    
    if (stderr && !stderr.includes('WARNING')) {
      console.error('Warning:', stderr);
    }

    const stats = statSync(backupPath);
    console.log(`\n✅ Backup created successfully!`);
    console.log(`   Size: ${formatBytes(stats.size)}`);
    console.log(`   File: ${backupFile}`);
    
    return backupPath;
  } catch (error) {
    console.error(`\n❌ Backup failed: ${error.message}`);
    process.exit(1);
  }
}

// Main
const database = process.argv[2] || DB_CONFIG.database;
const filename = process.argv[3] || null;
const schema = process.argv[4] || SCHEMA;

createBackup(database, filename, schema);


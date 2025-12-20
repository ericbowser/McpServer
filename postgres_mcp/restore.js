#!/usr/bin/env node

/**
 * Standalone PostgreSQL Restore Utility
 * Usage: node restore.js <backup_file> [target_database] [--create-db]
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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

async function restoreBackup(backupFile, targetDatabase, createDatabase = false) {
  let backupPath = backupFile;
  
  // If not absolute path, assume it's in backup directory
  if (!backupPath.includes('\\') && !backupPath.includes('/')) {
    backupPath = join(BACKUP_DIR, backupFile);
  }

  if (!existsSync(backupPath)) {
    console.error(`❌ Backup file not found: ${backupPath}`);
    process.exit(1);
  }

  // Determine backup format from extension
  const ext = backupPath.split('.').pop().toLowerCase();
  const format = ext === 'dump' ? 'custom' : ext === 'tar' ? 'tar' : 'plain';

  // Validate database name to prevent injection
  if (!isValidIdentifier(targetDatabase)) {
    console.error(`❌ Invalid database name: ${targetDatabase}`);
    process.exit(1);
  }

  console.log(`Restoring backup: ${basename(backupPath)}`);
  console.log(`Format: ${format}`);
  console.log(`Target database: ${targetDatabase}`);

  // Create database if requested
  if (createDatabase) {
    console.log(`Creating database: ${targetDatabase}...`);
    const safeDatabase = escapeShellIdentifier(targetDatabase);
    // Use psql with -c flag and properly quote the SQL command
    const createDbCmd = `psql -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -d postgres -c "CREATE DATABASE ${safeDatabase}"`;
    const env = { ...process.env, PGPASSWORD: DB_CONFIG.password };
    
    try {
      await execAsync(createDbCmd, { env });
      console.log(`✅ Database created`);
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.error(`❌ Failed to create database: ${error.message}`);
        process.exit(1);
      } else {
        console.log(`ℹ️  Database already exists`);
      }
    }
  }

  // Build restore command with escaped database name
  const safeDatabase = escapeShellIdentifier(targetDatabase);
  let restoreCmd;
  if (format === 'custom' || format === 'tar') {
    restoreCmd = `pg_restore -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -d ${safeDatabase} -c "${backupPath}"`;
  } else {
    restoreCmd = `psql -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -d ${safeDatabase} -f "${backupPath}"`;
  }

  const env = { ...process.env, PGPASSWORD: DB_CONFIG.password };

  try {
    console.log(`\nRestoring...`);
    const { stdout, stderr } = await execAsync(restoreCmd, { env });
    
    if (stderr && !stderr.includes('WARNING') && !stderr.includes('NOTICE')) {
      console.error('Warning:', stderr);
    }

    console.log(`\n✅ Backup restored successfully!`);
    console.log(`   Database: ${targetDatabase}`);
    console.log(`   Restored: ${new Date().toLocaleString()}`);
  } catch (error) {
    console.error(`\n❌ Restore failed: ${error.message}`);
    process.exit(1);
  }
}

// Parse arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node restore.js <backup_file> [target_database] [--create-db]');
  console.error('Example: node restore.js mydb_2024-01-01.dump mydb --create-db');
  process.exit(1);
}

const backupFile = args[0];
const targetDatabase = args[1] || DB_CONFIG.database;
const createDatabase = args.includes('--create-db');

restoreBackup(backupFile, targetDatabase, createDatabase);


#!/usr/bin/env node
/**
 * Quick database checker for batch_jobs table
 */

const { Client } = require('pg');
const config = require('dotenv');
console.log("config: ", config.parsed.DB_DATABASE);

const DB_CONFIG = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_DATABASE || 'ericbo', 
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
};

async function checkDatabase() {
  const client = new Client(DB_CONFIG);

  try {
    console.log('Connecting to database...');
    console.log(`  Host: ${DB_CONFIG.host}:${DB_CONFIG.port}`);
    console.log(`  Database: ${DB_CONFIG.database}`);
    console.log(`  User: ${DB_CONFIG.user}\n`);

    await client.connect();
    console.log('✓ Connected successfully\n');

    // Check if batch_jobs table exists
    console.log('Checking for batch_jobs table...');
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'prepper'
        AND table_name = 'batch_jobs'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('✗ batch_jobs table does NOT exist');
      console.log('\nYou need to create it with:');
      console.log('  psql -U postgres -d postgres -f C:/Projects/cloud_prepper_api/scripts/create_batch_jobs_table.sql\n');
      return;
    }

    console.log('✓ batch_jobs table exists\n');

    // Get table structure
    console.log('Table structure:');
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'prepper' AND table_name = 'batch_jobs'
      ORDER BY ordinal_position;
    `);

    columns.rows.forEach(col => {
      console.log(`  ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

    // Count batch jobs by status
    console.log('\nBatch jobs by status:');
    const statusCount = await client.query(`
      SELECT status, COUNT(*) as count
      FROM prepper.batch_jobs
      GROUP BY status
      ORDER BY status;
    `);

    if (statusCount.rows.length === 0) {
      console.log('  No batch jobs found\n');
    } else {
      statusCount.rows.forEach(row => {
        console.log(`  ${row.status.padEnd(20)} ${row.count}`);
      });
      console.log('');
    }

    // Get recent batch jobs
    console.log('Recent batch jobs (last 10):');
    const recent = await client.query(`
      SELECT
        batch_id,
        anthropic_batch_id,
        status,
        count,
        certification_type,
        domain_name,
        created_at,
        updated_at,
        last_polled_at,
        completed_at,
        error_message
      FROM prepper.batch_jobs
      ORDER BY created_at DESC
      LIMIT 10;
    `);

    if (recent.rows.length === 0) {
      console.log('  No batch jobs found\n');
    } else {
      recent.rows.forEach((row, i) => {
        console.log(`\n  [${i + 1}] ${row.batch_id}`);
        console.log(`      Anthropic ID: ${row.anthropic_batch_id}`);
        console.log(`      Status: ${row.status}`);
        console.log(`      Questions: ${row.count}`);
        console.log(`      Cert: ${row.certification_type || 'N/A'}, Domain: ${row.domain_name || 'N/A'}`);
        console.log(`      Created: ${row.created_at}`);
        console.log(`      Updated: ${row.updated_at}`);
        console.log(`      Last Polled: ${row.last_polled_at || 'never'}`);
        console.log(`      Completed: ${row.completed_at || 'not yet'}`);
        if (row.error_message) {
          console.log(`      Error: ${row.error_message}`);
        }
      });
      console.log('');
    }

    // Check for stuck batches (pending for > 1 hour)
    console.log('Checking for stuck batches...');
    const stuck = await client.query(`
      SELECT batch_id, status, created_at,
             EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_old
      FROM prepper.batch_jobs
      WHERE status IN ('pending', 'validating', 'in_progress')
      AND created_at < NOW() - INTERVAL '1 hour'
      ORDER BY created_at;
    `);

    if (stuck.rows.length === 0) {
      console.log('  No stuck batches found\n');
    } else {
      console.log(`  Found ${stuck.rows.length} potentially stuck batch(es):`);
      stuck.rows.forEach(row => {
        console.log(`    ${row.batch_id} - ${row.status} (${Math.floor(row.minutes_old)} minutes old)`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error('\nConnection failed. Make sure:');
    console.error('  1. PostgreSQL is running');
    console.error('  2. Database credentials are correct');
    console.error('  3. Database "postgres" exists');
    console.error('  4. Schema "prepper" exists\n');
  } finally {
    await client.end();
  }
}

checkDatabase().catch(console.error);

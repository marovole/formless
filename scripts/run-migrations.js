#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres.ixtvycjniqltthskfrdv:exOTmNnz1zh6IfVo@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres';

const migrations = [
  'supabase/migrations/20250102000000_base_schema.sql',
  'supabase/migrations/20250102000001_guanzhao_system.sql',
  'supabase/migrations/20250102000002_setup_cron_jobs.sql',
];

async function runMigrations() {
  const client = new Client({ connectionString });

  try {
    console.log('Connecting to Supabase database...');
    await client.connect();
    console.log('Connected!\n');

    for (const migration of migrations) {
      const migrationPath = path.join(__dirname, '..', migration);
      console.log(`Executing migration: ${migration}`);

      const sql = fs.readFileSync(migrationPath, 'utf8');

      try {
        await client.query(sql);
        console.log(`✅ Migration ${migration} completed successfully\n`);
      } catch (error) {
        // Ignore "already exists" errors
        if (error.message.includes('already exists')) {
          console.log(`⚠️  Migration ${migration} - some objects already exist, continuing...\n`);
        } else {
          console.error(`❌ Error executing ${migration}:`, error.message);
          throw error;
        }
      }
    }

    console.log('✨ All migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();

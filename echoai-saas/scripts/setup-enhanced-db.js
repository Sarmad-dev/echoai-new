#!/usr/bin/env node

/**
 * Database Setup Script for Advanced Automation Platform
 * 
 * This script applies the enhanced database schema to your Supabase instance.
 * It can be run to set up a new database or migrate an existing one.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Starting database migration for Advanced Automation Platform...\n');

  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../prisma/migrations/003_advanced_automation_platform.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Applying migration: 003_advanced_automation_platform.sql');

    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      console.error('❌ Migration failed:', error.message);
      process.exit(1);
    }

    console.log('✅ Migration completed successfully!');
    console.log('\n📊 New tables created:');
    console.log('   - ExternalUser (for chat widget users)');
    console.log('   - ConversationSession (for persistent memory)');
    console.log('   - AutomationWorkflow (for visual workflows)');
    console.log('   - WorkflowExecution (for execution tracking)');
    console.log('   - Integration (for third-party connections)');
    console.log('   - FAQ (for chatbot FAQs)');
    console.log('   - ImageAnalysis (for vision analysis results)');
    console.log('\n🔧 Enhanced existing tables:');
    console.log('   - Message (added sessionId, sentimentScore, metadata, imageUrl)');
    console.log('\n🎯 Performance optimizations:');
    console.log('   - Added 15+ new indexes for optimal query performance');
    console.log('   - Created composite indexes for common query patterns');
    console.log('   - Added foreign key constraints for data integrity');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

async function verifyMigration() {
  console.log('\n🔍 Verifying migration...');

  const tablesToCheck = [
    'ExternalUser',
    'ConversationSession', 
    'AutomationWorkflow',
    'WorkflowExecution',
    'Integration',
    'FAQ',
    'ImageAnalysis'
  ];

  for (const table of tablesToCheck) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    if (error) {
      console.error(`❌ Table ${table} verification failed:`, error.message);
      return false;
    }
    console.log(`✅ Table ${table} is accessible`);
  }

  // Check if new columns exist in Message table
  const { data: messageData, error: messageError } = await supabase
    .from('Message')
    .select('sessionId, sentimentScore, metadata, imageUrl')
    .limit(1);

  if (messageError) {
    console.error('❌ Message table enhancement verification failed:', messageError.message);
    return false;
  }
  console.log('✅ Message table enhancements are accessible');

  return true;
}

async function main() {
  await runMigration();
  
  const isVerified = await verifyMigration();
  
  if (isVerified) {
    console.log('\n🎉 Database migration completed successfully!');
    console.log('   Your database is now ready for the Advanced Automation Platform.');
    console.log('\n📝 Next steps:');
    console.log('   1. Run `npm run db:generate` to update Prisma client');
    console.log('   2. Start implementing the enhanced features');
    console.log('   3. Test the new functionality with your application');
  } else {
    console.log('\n⚠️  Migration completed but verification failed.');
    console.log('   Please check your database manually.');
    process.exit(1);
  }
}

// Handle command line execution
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { runMigration, verifyMigration };
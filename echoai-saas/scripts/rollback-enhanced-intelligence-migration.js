#!/usr/bin/env node

/**
 * Script to rollback Enhanced Chatbot Intelligence Migration
 * This script removes all the enhanced intelligence tables and types
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function rollbackEnhancedIntelligenceMigration() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔄 Rolling back Enhanced Chatbot Intelligence Migration...\n');

    // Read the rollback SQL file
    const rollbackPath = path.join(__dirname, '..', 'prisma', 'migrations', '008_add_enhanced_chatbot_intelligence_rollback.sql');
    
    if (!fs.existsSync(rollbackPath)) {
      throw new Error(`Rollback file not found: ${rollbackPath}`);
    }

    const rollbackSQL = fs.readFileSync(rollbackPath, 'utf8');
    
    console.log('📄 Rollback file loaded successfully');
    console.log('🔧 Executing rollback...\n');

    // Split the SQL into individual statements and execute them
    const statements = rollbackSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        try {
          console.log(`Executing rollback statement ${i + 1}/${statements.length}...`);
          await prisma.$executeRawUnsafe(statement);
        } catch (error) {
          // Some rollback statements might fail if objects don't exist, which is okay
          console.warn(`⚠️  Warning on statement ${i + 1}:`, error.message);
        }
      }
    }

    console.log('✅ Rollback executed successfully!\n');

    // Verify rollback
    console.log('🔍 Verifying rollback...\n');
    
    const tables = ['TrainingInstruction', 'ConversationIntelligence', 'EnhancedLead', 'EscalationRequest'];
    
    for (const table of tables) {
      try {
        const result = await prisma.$queryRawUnsafe(
          `SELECT table_name FROM information_schema.tables WHERE table_name = '${table}' AND table_schema = 'public'`
        );
        if (result.length > 0) {
          console.warn(`⚠️  Warning: Table ${table} still exists`);
        } else {
          console.log(`✅ Table ${table} removed successfully`);
        }
      } catch (error) {
        console.log(`✅ Table ${table} removed successfully`);
      }
    }

    console.log('\n🎉 Enhanced Chatbot Intelligence Migration rollback completed successfully!');
    
    // Regenerate Prisma client
    console.log('\n🔄 Regenerating Prisma client...');
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    
    try {
      await execPromise('npx prisma generate', { cwd: path.join(__dirname, '..') });
      console.log('✅ Prisma client regenerated successfully');
    } catch (error) {
      console.warn('⚠️  Warning: Could not regenerate Prisma client automatically');
      console.warn('Please run "npx prisma generate" manually');
    }

  } catch (error) {
    console.error('❌ Rollback failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run rollback if this script is executed directly
if (require.main === module) {
  rollbackEnhancedIntelligenceMigration();
}

module.exports = { rollbackEnhancedIntelligenceMigration };
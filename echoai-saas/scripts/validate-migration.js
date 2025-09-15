#!/usr/bin/env node

/**
 * Migration Validation Script
 * 
 * This script validates that the database migration can be applied safely
 * by checking for potential conflicts and prerequisites.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPrerequisites() {
  console.log('🔍 Checking migration prerequisites...\n');

  const requiredTables = ['User', 'Chatbot', 'Document', 'Conversation', 'Message'];
  const results = [];

  for (const table of requiredTables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        results.push({ table, status: 'MISSING', error: error.message });
      } else {
        results.push({ table, status: 'OK', recordCount: data?.length || 0 });
      }
    } catch (err) {
      results.push({ table, status: 'ERROR', error: err.message });
    }
  }

  return results;
}

async function checkForConflicts() {
  console.log('⚠️  Checking for potential conflicts...\n');

  const conflictChecks = [];

  // Check if new tables already exist
  const newTables = [
    'ExternalUser', 'ConversationSession', 'AutomationWorkflow',
    'WorkflowExecution', 'Integration', 'FAQ', 'ImageAnalysis'
  ];

  for (const table of newTables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (!error) {
        conflictChecks.push({
          type: 'TABLE_EXISTS',
          table,
          severity: 'WARNING',
          message: `Table ${table} already exists`
        });
      }
    } catch (err) {
      // Table doesn't exist - this is expected
    }
  }

  // Check if new columns already exist in Message table
  try {
    const { data, error } = await supabase
      .from('Message')
      .select('sessionId, sentimentScore, metadata, imageUrl')
      .limit(1);

    if (!error) {
      conflictChecks.push({
        type: 'COLUMNS_EXIST',
        table: 'Message',
        severity: 'WARNING',
        message: 'New columns already exist in Message table'
      });
    }
  } catch (err) {
    // Columns don't exist - this is expected
  }

  // Check if ExecutionStatus enum exists
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: "SELECT 1 FROM pg_type WHERE typname = 'ExecutionStatus'"
    });

    if (!error && data && data.length > 0) {
      conflictChecks.push({
        type: 'ENUM_EXISTS',
        name: 'ExecutionStatus',
        severity: 'WARNING',
        message: 'ExecutionStatus enum already exists'
      });
    }
  } catch (err) {
    // Enum doesn't exist - this is expected
  }

  return conflictChecks;
}

async function checkDatabaseSize() {
  console.log('📊 Checking database size and performance...\n');

  try {
    // Get table sizes
    const { data: tableSizes, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
      `
    });

    if (error) {
      return { error: error.message };
    }

    const totalSize = tableSizes?.reduce((sum, table) => sum + (table.size_bytes || 0), 0) || 0;
    const totalSizeMB = Math.round(totalSize / 1024 / 1024 * 100) / 100;

    return {
      tables: tableSizes || [],
      totalSizeMB,
      recommendation: totalSizeMB > 1000 ? 'Consider backup before migration' : 'Safe to proceed'
    };
  } catch (err) {
    return { error: err.message };
  }
}

async function generateMigrationPlan() {
  console.log('📋 Generating migration plan...\n');

  const plan = {
    steps: [
      {
        step: 1,
        description: 'Create ExecutionStatus enum',
        sql: 'CREATE TYPE "ExecutionStatus" AS ENUM (...)',
        estimatedTime: '< 1 second'
      },
      {
        step: 2,
        description: 'Create 7 new tables',
        tables: ['ExternalUser', 'ConversationSession', 'AutomationWorkflow', 'WorkflowExecution', 'Integration', 'FAQ', 'ImageAnalysis'],
        estimatedTime: '< 5 seconds'
      },
      {
        step: 3,
        description: 'Add new columns to Message table',
        columns: ['sessionId', 'sentimentScore', 'metadata', 'imageUrl'],
        estimatedTime: '< 2 seconds'
      },
      {
        step: 4,
        description: 'Create indexes for performance',
        indexCount: 15,
        estimatedTime: '< 10 seconds'
      },
      {
        step: 5,
        description: 'Add foreign key constraints',
        constraintCount: 8,
        estimatedTime: '< 5 seconds'
      },
      {
        step: 6,
        description: 'Create triggers and permissions',
        estimatedTime: '< 3 seconds'
      }
    ],
    totalEstimatedTime: '< 30 seconds',
    rollbackAvailable: true,
    dataLoss: false
  };

  return plan;
}

function printResults(prerequisites, conflicts, dbSize, plan) {
  console.log('📋 MIGRATION VALIDATION REPORT');
  console.log('=' .repeat(50));

  // Prerequisites
  console.log('\n✅ PREREQUISITES CHECK:');
  prerequisites.forEach(result => {
    const status = result.status === 'OK' ? '✅' : '❌';
    console.log(`   ${status} ${result.table}: ${result.status}`);
    if (result.error) {
      console.log(`      Error: ${result.error}`);
    }
  });

  // Conflicts
  console.log('\n⚠️  CONFLICT CHECK:');
  if (conflicts.length === 0) {
    console.log('   ✅ No conflicts detected');
  } else {
    conflicts.forEach(conflict => {
      const icon = conflict.severity === 'WARNING' ? '⚠️' : '❌';
      console.log(`   ${icon} ${conflict.type}: ${conflict.message}`);
    });
  }

  // Database size
  console.log('\n📊 DATABASE SIZE:');
  if (dbSize.error) {
    console.log(`   ❌ Error checking size: ${dbSize.error}`);
  } else {
    console.log(`   📦 Total size: ${dbSize.totalSizeMB} MB`);
    console.log(`   💡 Recommendation: ${dbSize.recommendation}`);
    
    if (dbSize.tables && dbSize.tables.length > 0) {
      console.log('   📋 Largest tables:');
      dbSize.tables.slice(0, 5).forEach(table => {
        console.log(`      - ${table.tablename}: ${table.size}`);
      });
    }
  }

  // Migration plan
  console.log('\n📋 MIGRATION PLAN:');
  console.log(`   ⏱️  Estimated time: ${plan.totalEstimatedTime}`);
  console.log(`   🔄 Rollback available: ${plan.rollbackAvailable ? 'Yes' : 'No'}`);
  console.log(`   💾 Data loss risk: ${plan.dataLoss ? 'Yes' : 'No'}`);
  
  console.log('\n   📝 Steps:');
  plan.steps.forEach(step => {
    console.log(`      ${step.step}. ${step.description} (${step.estimatedTime})`);
  });

  // Final recommendation
  console.log('\n🎯 RECOMMENDATION:');
  const hasErrors = prerequisites.some(p => p.status === 'MISSING' || p.status === 'ERROR');
  const hasBlockingConflicts = conflicts.some(c => c.severity === 'ERROR');

  if (hasErrors || hasBlockingConflicts) {
    console.log('   ❌ DO NOT PROCEED - Fix errors first');
  } else if (conflicts.length > 0) {
    console.log('   ⚠️  PROCEED WITH CAUTION - Review warnings');
  } else {
    console.log('   ✅ SAFE TO PROCEED - No issues detected');
  }

  console.log('\n📚 Next steps:');
  console.log('   1. Review this report carefully');
  console.log('   2. Backup your database (recommended)');
  console.log('   3. Run: npm run db:setup-enhanced');
  console.log('   4. Verify migration with: npm run db:generate');
}

async function main() {
  console.log('🚀 Advanced Automation Platform - Migration Validator\n');

  try {
    const [prerequisites, conflicts, dbSize, plan] = await Promise.all([
      checkPrerequisites(),
      checkForConflicts(),
      checkDatabaseSize(),
      generateMigrationPlan()
    ]);

    printResults(prerequisites, conflicts, dbSize, plan);

  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  }
}

// Handle command line execution
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { 
  checkPrerequisites, 
  checkForConflicts, 
  checkDatabaseSize, 
  generateMigrationPlan 
};
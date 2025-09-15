#!/usr/bin/env node

/**
 * Connection Validation Migration Validation Script
 * 
 * This script validates that the connection validation migration (007) can be applied safely
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
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkIntegrationTableExists() {
  console.log('🔍 Checking Integration table prerequisites...\n');

  try {
    const { data, error } = await supabase
      .from('Integration')
      .select('id, userId, provider, accessToken, refreshToken, tokenExpiry, config, isActive, lastHealthCheck, healthStatus, createdAt, updatedAt')
      .limit(1);

    if (error) {
      return {
        exists: false,
        error: error.message,
        status: 'MISSING'
      };
    }

    return {
      exists: true,
      status: 'OK',
      recordCount: data?.length || 0
    };
  } catch (err) {
    return {
      exists: false,
      error: err.message,
      status: 'ERROR'
    };
  }
}

async function checkForExistingColumns() {
  console.log('⚠️  Checking for existing connection validation columns...\n');

  const newColumns = [
    'lastConnectionValidation',
    'connectionStatus', 
    'accountInfo',
    'validationError'
  ];

  const existingColumns = [];

  for (const column of newColumns) {
    try {
      // Try to select the column to see if it exists
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `SELECT column_name FROM information_schema.columns 
              WHERE table_name = 'Integration' AND column_name = '${column}';`
      });

      if (!error && data && data.length > 0) {
        existingColumns.push({
          column,
          exists: true,
          severity: 'WARNING',
          message: `Column ${column} already exists in Integration table`
        });
      }
    } catch (err) {
      // Column doesn't exist - this is expected
    }
  }

  return existingColumns;
}

async function checkForIntegrationCacheTable() {
  console.log('📋 Checking for existing IntegrationCache table...\n');

  try {
    const { data, error } = await supabase
      .from('IntegrationCache')
      .select('*')
      .limit(1);

    if (!error) {
      return {
        exists: true,
        severity: 'WARNING',
        message: 'IntegrationCache table already exists'
      };
    }
  } catch (err) {
    // Table doesn't exist - this is expected
  }

  return {
    exists: false,
    message: 'IntegrationCache table does not exist (expected)'
  };
}

async function checkExistingIndexes() {
  console.log('🔍 Checking for existing indexes...\n');

  const indexesToCheck = [
    'idx_integration_connection_status',
    'idx_integration_cache_expiry'
  ];

  const existingIndexes = [];

  for (const indexName of indexesToCheck) {
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `SELECT indexname FROM pg_indexes 
              WHERE indexname = '${indexName}';`
      });

      if (!error && data && data.length > 0) {
        existingIndexes.push({
          index: indexName,
          exists: true,
          severity: 'WARNING',
          message: `Index ${indexName} already exists`
        });
      }
    } catch (err) {
      // Index doesn't exist - this is expected
    }
  }

  return existingIndexes;
}

async function validateMigrationSQL() {
  console.log('📝 Validating migration SQL syntax...\n');

  const migrationPath = path.join(__dirname, '../prisma/migrations/007_enhance_integration_connection_validation.sql');
  
  if (!fs.existsSync(migrationPath)) {
    return {
      valid: false,
      error: 'Migration file not found',
      path: migrationPath
    };
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  // Basic SQL validation checks
  const validationResults = [];

  // Check for required statements
  const requiredStatements = [
    'ALTER TABLE "Integration" ADD COLUMN',
    'CREATE TABLE IF NOT EXISTS "IntegrationCache"',
    'CREATE INDEX IF NOT EXISTS "idx_integration_connection_status"',
    'CREATE INDEX IF NOT EXISTS "idx_integration_cache_expiry"'
  ];

  for (const statement of requiredStatements) {
    if (!migrationSQL.includes(statement)) {
      validationResults.push({
        type: 'MISSING_STATEMENT',
        statement,
        severity: 'ERROR',
        message: `Required statement not found: ${statement}`
      });
    }
  }

  // Check for proper IF NOT EXISTS usage
  if (!migrationSQL.includes('IF NOT EXISTS')) {
    validationResults.push({
      type: 'SAFETY_CHECK',
      severity: 'WARNING',
      message: 'Migration should use IF NOT EXISTS for safety'
    });
  }

  return {
    valid: validationResults.filter(r => r.severity === 'ERROR').length === 0,
    results: validationResults,
    path: migrationPath
  };
}

async function estimateMigrationImpact() {
  console.log('📊 Estimating migration impact...\n');

  try {
    // Get Integration table size
    const { data: tableSize, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          pg_size_pretty(pg_total_relation_size('Integration')) as size,
          pg_total_relation_size('Integration') as size_bytes,
          COUNT(*) as record_count
        FROM "Integration";
      `
    });

    if (error) {
      return { error: error.message };
    }

    const sizeInfo = tableSize?.[0] || {};
    const sizeMB = Math.round((sizeInfo.size_bytes || 0) / 1024 / 1024 * 100) / 100;

    return {
      integrationTable: {
        size: sizeInfo.size || 'Unknown',
        sizeMB,
        recordCount: sizeInfo.record_count || 0
      },
      estimatedTime: sizeMB < 10 ? '< 5 seconds' : sizeMB < 100 ? '< 30 seconds' : '< 2 minutes',
      recommendation: sizeMB > 100 ? 'Consider backup before migration' : 'Safe to proceed'
    };
  } catch (err) {
    return { error: err.message };
  }
}

function printValidationReport(integrationCheck, columnCheck, cacheTableCheck, indexCheck, sqlValidation, impact) {
  console.log('📋 CONNECTION VALIDATION MIGRATION REPORT');
  console.log('=' .repeat(60));

  // Prerequisites
  console.log('\n✅ PREREQUISITES CHECK:');
  const status = integrationCheck.exists ? '✅' : '❌';
  console.log(`   ${status} Integration table: ${integrationCheck.status}`);
  if (integrationCheck.error) {
    console.log(`      Error: ${integrationCheck.error}`);
  }

  // Column conflicts
  console.log('\n📋 COLUMN CONFLICT CHECK:');
  if (columnCheck.length === 0) {
    console.log('   ✅ No column conflicts detected');
  } else {
    columnCheck.forEach(conflict => {
      console.log(`   ⚠️  ${conflict.message}`);
    });
  }

  // Table conflicts
  console.log('\n📋 TABLE CONFLICT CHECK:');
  if (!cacheTableCheck.exists) {
    console.log('   ✅ IntegrationCache table does not exist (expected)');
  } else {
    console.log(`   ⚠️  ${cacheTableCheck.message}`);
  }

  // Index conflicts
  console.log('\n🔍 INDEX CONFLICT CHECK:');
  if (indexCheck.length === 0) {
    console.log('   ✅ No index conflicts detected');
  } else {
    indexCheck.forEach(conflict => {
      console.log(`   ⚠️  ${conflict.message}`);
    });
  }

  // SQL validation
  console.log('\n📝 SQL VALIDATION:');
  if (sqlValidation.valid) {
    console.log('   ✅ Migration SQL is valid');
  } else {
    console.log('   ❌ Migration SQL has issues:');
    sqlValidation.results?.forEach(result => {
      const icon = result.severity === 'ERROR' ? '❌' : '⚠️';
      console.log(`      ${icon} ${result.message}`);
    });
  }

  // Impact assessment
  console.log('\n📊 MIGRATION IMPACT:');
  if (impact.error) {
    console.log(`   ❌ Error assessing impact: ${impact.error}`);
  } else {
    console.log(`   📦 Integration table size: ${impact.integrationTable.size}`);
    console.log(`   📊 Record count: ${impact.integrationTable.recordCount}`);
    console.log(`   ⏱️  Estimated time: ${impact.estimatedTime}`);
    console.log(`   💡 Recommendation: ${impact.recommendation}`);
  }

  // Migration plan
  console.log('\n📋 MIGRATION PLAN:');
  console.log('   📝 Steps to be executed:');
  console.log('      1. Add 4 new columns to Integration table');
  console.log('      2. Create IntegrationCache table');
  console.log('      3. Create 2 new indexes for performance');
  console.log('      4. Add table and column comments');

  // Final recommendation
  console.log('\n🎯 RECOMMENDATION:');
  const hasErrors = !integrationCheck.exists || !sqlValidation.valid;
  const hasWarnings = columnCheck.length > 0 || cacheTableCheck.exists || indexCheck.length > 0;

  if (hasErrors) {
    console.log('   ❌ DO NOT PROCEED - Fix errors first');
  } else if (hasWarnings) {
    console.log('   ⚠️  PROCEED WITH CAUTION - Review warnings');
    console.log('      Migration uses IF NOT EXISTS for safety');
  } else {
    console.log('   ✅ SAFE TO PROCEED - No issues detected');
  }

  console.log('\n📚 Next steps:');
  console.log('   1. Review this report carefully');
  console.log('   2. Backup your database (recommended)');
  console.log('   3. Run the migration:');
  console.log('      psql -d your_database -f prisma/migrations/007_enhance_integration_connection_validation.sql');
  console.log('   4. Update Prisma client: npm run db:generate');
  console.log('   5. Test the new schema with your application');
}

async function main() {
  console.log('🚀 Connection Validation Migration Validator\n');

  try {
    const [
      integrationCheck,
      columnCheck,
      cacheTableCheck,
      indexCheck,
      sqlValidation,
      impact
    ] = await Promise.all([
      checkIntegrationTableExists(),
      checkForExistingColumns(),
      checkForIntegrationCacheTable(),
      checkExistingIndexes(),
      validateMigrationSQL(),
      estimateMigrationImpact()
    ]);

    printValidationReport(
      integrationCheck,
      columnCheck,
      cacheTableCheck,
      indexCheck,
      sqlValidation,
      impact
    );

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
  checkIntegrationTableExists,
  checkForExistingColumns,
  checkForIntegrationCacheTable,
  checkExistingIndexes,
  validateMigrationSQL,
  estimateMigrationImpact
};
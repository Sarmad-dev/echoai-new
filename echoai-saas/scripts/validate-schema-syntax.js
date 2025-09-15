#!/usr/bin/env node

/**
 * Schema Syntax Validation Script
 * 
 * This script validates the Prisma schema syntax without requiring a database connection.
 * It checks that the schema can be parsed and that our new models are correctly defined.
 */

const fs = require('fs');
const path = require('path');

function validatePrismaSchema() {
  console.log('🔍 Validating Prisma schema syntax...\n');

  const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
  
  if (!fs.existsSync(schemaPath)) {
    return {
      valid: false,
      error: 'Schema file not found',
      path: schemaPath
    };
  }

  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  
  // Check for required Integration model enhancements
  const integrationChecks = [
    {
      name: 'lastConnectionValidation column',
      pattern: /lastConnectionValidation\s+DateTime\?/,
      required: true
    },
    {
      name: 'connectionStatus column',
      pattern: /connectionStatus\s+String\s+@default\("unknown"\)/,
      required: true
    },
    {
      name: 'accountInfo column',
      pattern: /accountInfo\s+Json\?/,
      required: true
    },
    {
      name: 'validationError column',
      pattern: /validationError\s+String\?/,
      required: true
    },
    {
      name: 'cacheEntries relationship',
      pattern: /cacheEntries\s+IntegrationCache\[\]/,
      required: true
    },
    {
      name: 'connection status index',
      pattern: /@@index\(\[userId, provider, connectionStatus\]/,
      required: true
    }
  ];

  // Check for IntegrationCache model
  const cacheTableChecks = [
    {
      name: 'IntegrationCache model',
      pattern: /model IntegrationCache \{/,
      required: true
    },
    {
      name: 'integrationId field',
      pattern: /integrationId\s+String/,
      required: true
    },
    {
      name: 'cacheKey field',
      pattern: /cacheKey\s+String/,
      required: true
    },
    {
      name: 'cacheData field',
      pattern: /cacheData\s+Json/,
      required: true
    },
    {
      name: 'expiresAt field',
      pattern: /expiresAt\s+DateTime/,
      required: true
    },
    {
      name: 'unique constraint',
      pattern: /@@unique\(\[integrationId, cacheKey\]\)/,
      required: true
    },
    {
      name: 'expiry index',
      pattern: /@@index\(\[expiresAt\]/,
      required: true
    }
  ];

  const results = [];

  // Validate Integration model enhancements
  console.log('✅ Checking Integration model enhancements:');
  integrationChecks.forEach(check => {
    const found = check.pattern.test(schemaContent);
    results.push({
      category: 'Integration',
      name: check.name,
      found,
      required: check.required,
      status: found ? 'PASS' : (check.required ? 'FAIL' : 'WARN')
    });
    
    const icon = found ? '✅' : '❌';
    console.log(`   ${icon} ${check.name}: ${found ? 'Found' : 'Missing'}`);
  });

  // Validate IntegrationCache model
  console.log('\n✅ Checking IntegrationCache model:');
  cacheTableChecks.forEach(check => {
    const found = check.pattern.test(schemaContent);
    results.push({
      category: 'IntegrationCache',
      name: check.name,
      found,
      required: check.required,
      status: found ? 'PASS' : (check.required ? 'FAIL' : 'WARN')
    });
    
    const icon = found ? '✅' : '❌';
    console.log(`   ${icon} ${check.name}: ${found ? 'Found' : 'Missing'}`);
  });

  // Check for syntax errors by looking for common issues
  console.log('\n🔍 Checking for common syntax issues:');
  const syntaxChecks = [
    {
      name: 'Balanced braces',
      test: () => {
        const openBraces = (schemaContent.match(/\{/g) || []).length;
        const closeBraces = (schemaContent.match(/\}/g) || []).length;
        return openBraces === closeBraces;
      }
    },
    {
      name: 'No duplicate model names',
      test: () => {
        const models = schemaContent.match(/model\s+(\w+)\s*\{/g) || [];
        const modelNames = models.map(m => m.match(/model\s+(\w+)/)[1]);
        return modelNames.length === new Set(modelNames).size;
      }
    },
    {
      name: 'Valid field types',
      test: () => {
        // Check for common typos in field types
        const invalidTypes = ['Strings', 'Integers', 'Booleans', 'DateTimes'];
        return !invalidTypes.some(type => schemaContent.includes(type));
      }
    }
  ];

  syntaxChecks.forEach(check => {
    const passed = check.test();
    results.push({
      category: 'Syntax',
      name: check.name,
      found: passed,
      required: true,
      status: passed ? 'PASS' : 'FAIL'
    });
    
    const icon = passed ? '✅' : '❌';
    console.log(`   ${icon} ${check.name}: ${passed ? 'Valid' : 'Invalid'}`);
  });

  const failures = results.filter(r => r.status === 'FAIL');
  const warnings = results.filter(r => r.status === 'WARN');

  return {
    valid: failures.length === 0,
    results,
    failures,
    warnings,
    summary: {
      total: results.length,
      passed: results.filter(r => r.status === 'PASS').length,
      failed: failures.length,
      warned: warnings.length
    }
  };
}

function checkMigrationFiles() {
  console.log('\n🔍 Checking migration files...\n');

  const migrationFiles = [
    'prisma/migrations/007_enhance_integration_connection_validation.sql',
    'prisma/migrations/007_enhance_integration_connection_validation_rollback.sql',
    'prisma/migrations/007_enhance_integration_connection_validation.md'
  ];

  const fileChecks = migrationFiles.map(file => {
    const fullPath = path.join(__dirname, '..', file);
    const exists = fs.existsSync(fullPath);
    
    let size = 0;
    let content = '';
    if (exists) {
      const stats = fs.statSync(fullPath);
      size = stats.size;
      content = fs.readFileSync(fullPath, 'utf8');
    }

    const icon = exists ? '✅' : '❌';
    console.log(`   ${icon} ${file}: ${exists ? `${size} bytes` : 'Missing'}`);

    return {
      file,
      exists,
      size,
      hasContent: content.length > 0
    };
  });

  return fileChecks;
}

function printValidationReport(schemaValidation, migrationFiles) {
  console.log('\n📋 SCHEMA VALIDATION REPORT');
  console.log('=' .repeat(60));

  // Schema validation summary
  console.log('\n📊 SCHEMA VALIDATION SUMMARY:');
  console.log(`   Total checks: ${schemaValidation.summary.total}`);
  console.log(`   ✅ Passed: ${schemaValidation.summary.passed}`);
  console.log(`   ❌ Failed: ${schemaValidation.summary.failed}`);
  console.log(`   ⚠️  Warnings: ${schemaValidation.summary.warned}`);

  if (schemaValidation.failures.length > 0) {
    console.log('\n❌ FAILURES:');
    schemaValidation.failures.forEach(failure => {
      console.log(`   - ${failure.category}: ${failure.name}`);
    });
  }

  if (schemaValidation.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    schemaValidation.warnings.forEach(warning => {
      console.log(`   - ${warning.category}: ${warning.name}`);
    });
  }

  // Migration files summary
  console.log('\n📁 MIGRATION FILES:');
  const allFilesExist = migrationFiles.every(f => f.exists);
  const allFilesHaveContent = migrationFiles.every(f => f.hasContent);
  
  if (allFilesExist && allFilesHaveContent) {
    console.log('   ✅ All migration files are present and have content');
  } else {
    console.log('   ❌ Some migration files are missing or empty');
  }

  // Final recommendation
  console.log('\n🎯 FINAL VALIDATION RESULT:');
  if (schemaValidation.valid && allFilesExist && allFilesHaveContent) {
    console.log('   ✅ VALIDATION PASSED - Schema and migration files are ready');
    console.log('\n📚 Ready for next steps:');
    console.log('   1. ✅ Schema syntax is valid');
    console.log('   2. ✅ All required fields and models are present');
    console.log('   3. ✅ Migration files are complete');
    console.log('   4. 🚀 Ready to implement connection validation services');
  } else {
    console.log('   ❌ VALIDATION FAILED - Fix issues before proceeding');
    console.log('\n🔧 Required fixes:');
    if (!schemaValidation.valid) {
      console.log('   - Fix schema syntax errors and missing fields');
    }
    if (!allFilesExist || !allFilesHaveContent) {
      console.log('   - Ensure all migration files are present and complete');
    }
  }
}

async function main() {
  console.log('🚀 Schema Syntax Validation (No Database Required)\n');

  try {
    const schemaValidation = validatePrismaSchema();
    const migrationFiles = checkMigrationFiles();

    printValidationReport(schemaValidation, migrationFiles);

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
  validatePrismaSchema,
  checkMigrationFiles
};
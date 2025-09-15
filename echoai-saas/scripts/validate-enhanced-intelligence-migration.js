#!/usr/bin/env node

/**
 * Validation script for Enhanced Chatbot Intelligence Migration
 * This script validates that all new tables and indexes are created correctly
 */

const { PrismaClient } = require('@prisma/client');

async function validateEnhancedIntelligenceMigration() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Validating Enhanced Chatbot Intelligence Migration...\n');

    // Test 1: Validate enum types exist
    console.log('1. Checking enum types...');
    const enumQueries = [
      "SELECT 1 FROM pg_type WHERE typname = 'InstructionType'",
      "SELECT 1 FROM pg_type WHERE typname = 'CollectionStrategy'",
      "SELECT 1 FROM pg_type WHERE typname = 'LeadPriority'",
      "SELECT 1 FROM pg_type WHERE typname = 'LeadStatus'",
      "SELECT 1 FROM pg_type WHERE typname = 'EscalationType'",
      "SELECT 1 FROM pg_type WHERE typname = 'EscalationStatus'",
      "SELECT 1 FROM pg_type WHERE typname = 'UrgencyLevel'"
    ];

    for (const query of enumQueries) {
      const result = await prisma.$queryRawUnsafe(query);
      if (result.length === 0) {
        throw new Error(`Enum type validation failed for query: ${query}`);
      }
    }
    console.log('✅ All enum types created successfully');

    // Test 2: Validate tables exist
    console.log('\n2. Checking table existence...');
    const tables = [
      'TrainingInstruction',
      'ConversationIntelligence', 
      'EnhancedLead',
      'EscalationRequest'
    ];

    for (const table of tables) {
      const result = await prisma.$queryRawUnsafe(
        `SELECT table_name FROM information_schema.tables WHERE table_name = '${table}' AND table_schema = 'public'`
      );
      if (result.length === 0) {
        throw new Error(`Table ${table} does not exist`);
      }
    }
    console.log('✅ All tables created successfully');

    // Test 3: Validate indexes exist
    console.log('\n3. Checking indexes...');
    const indexes = [
      'TrainingInstruction_chatbotId_idx',
      'TrainingInstruction_type_idx',
      'TrainingInstruction_isActive_idx',
      'TrainingInstruction_priority_idx',
      'ConversationIntelligence_chatbotId_idx',
      'ConversationIntelligence_userId_idx',
      'ConversationIntelligence_createdAt_idx',
      'EnhancedLead_chatbotId_idx',
      'EnhancedLead_status_idx',
      'EnhancedLead_priority_idx',
      'EnhancedLead_leadScore_idx',
      'EnhancedLead_createdAt_idx',
      'EscalationRequest_chatbotId_idx',
      'EscalationRequest_status_idx',
      'EscalationRequest_escalationType_idx',
      'EscalationRequest_urgencyLevel_idx',
      'EscalationRequest_createdAt_idx'
    ];

    for (const index of indexes) {
      const result = await prisma.$queryRawUnsafe(
        `SELECT indexname FROM pg_indexes WHERE indexname = '${index}'`
      );
      if (result.length === 0) {
        throw new Error(`Index ${index} does not exist`);
      }
    }
    console.log('✅ All indexes created successfully');

    // Test 4: Validate unique constraints
    console.log('\n4. Checking unique constraints...');
    const uniqueConstraints = [
      'ConversationIntelligence_conversationId_key',
      'EnhancedLead_conversationId_key',
      'EscalationRequest_conversationId_key'
    ];

    for (const constraint of uniqueConstraints) {
      const result = await prisma.$queryRawUnsafe(
        `SELECT conname FROM pg_constraint WHERE conname = '${constraint}'`
      );
      if (result.length === 0) {
        throw new Error(`Unique constraint ${constraint} does not exist`);
      }
    }
    console.log('✅ All unique constraints created successfully');

    // Test 5: Validate foreign key constraints
    console.log('\n5. Checking foreign key constraints...');
    const foreignKeys = [
      'TrainingInstruction_chatbotId_fkey',
      'ConversationIntelligence_conversationId_fkey',
      'ConversationIntelligence_chatbotId_fkey',
      'EnhancedLead_conversationId_fkey',
      'EnhancedLead_chatbotId_fkey',
      'EscalationRequest_conversationId_fkey',
      'EscalationRequest_chatbotId_fkey'
    ];

    for (const fk of foreignKeys) {
      const result = await prisma.$queryRawUnsafe(
        `SELECT conname FROM pg_constraint WHERE conname = '${fk}' AND contype = 'f'`
      );
      if (result.length === 0) {
        throw new Error(`Foreign key constraint ${fk} does not exist`);
      }
    }
    console.log('✅ All foreign key constraints created successfully');

    // Test 6: Test basic CRUD operations
    console.log('\n6. Testing basic CRUD operations...');
    
    // Note: This would require existing chatbot and conversation data
    // For now, we'll just validate the schema structure
    const trainingInstructionColumns = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'TrainingInstruction' 
      ORDER BY ordinal_position
    `);
    
    const expectedColumns = [
      'id', 'chatbotId', 'type', 'title', 'content', 
      'priority', 'isActive', 'embedding', 'createdAt', 'updatedAt'
    ];
    
    const actualColumns = trainingInstructionColumns.map(col => col.column_name);
    for (const expectedCol of expectedColumns) {
      if (!actualColumns.includes(expectedCol)) {
        throw new Error(`Missing column ${expectedCol} in TrainingInstruction table`);
      }
    }
    console.log('✅ Table schema validation successful');

    console.log('\n🎉 Enhanced Chatbot Intelligence Migration validation completed successfully!');
    console.log('\nSummary:');
    console.log('- 7 enum types created');
    console.log('- 4 new tables created');
    console.log('- 17 performance indexes created');
    console.log('- 3 unique constraints created');
    console.log('- 7 foreign key constraints created');
    console.log('- Schema structure validated');

  } catch (error) {
    console.error('❌ Migration validation failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  validateEnhancedIntelligenceMigration();
}

module.exports = { validateEnhancedIntelligenceMigration };
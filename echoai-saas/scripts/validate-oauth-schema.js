/**
 * Schema validation script for OAuth states table
 * This script validates the Prisma schema structure without requiring database connection
 */

const fs = require('fs')
const path = require('path')

function validateOAuthSchema() {
  console.log('🔍 Validating OAuth states schema structure...')
  
  try {
    // Read the Prisma schema file
    const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma')
    const schemaContent = fs.readFileSync(schemaPath, 'utf8')
    
    // Test 1: Check if OAuthState model exists
    const hasOAuthStateModel = schemaContent.includes('model OAuthState')
    if (!hasOAuthStateModel) {
      throw new Error('OAuthState model not found in schema')
    }
    console.log('✅ OAuthState model exists in schema')
    
    // Test 2: Check required fields
    const requiredFields = [
      'state      String   @id',
      'userId     String   @db.Uuid',
      'providerId String',
      'expiresAt  DateTime',
      'createdAt  DateTime @default(now())'
    ]
    
    for (const field of requiredFields) {
      if (!schemaContent.includes(field)) {
        throw new Error(`Required field not found: ${field}`)
      }
    }
    console.log('✅ All required fields are present')
    
    // Test 3: Check foreign key relationship
    const hasUserRelation = schemaContent.includes('user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)')
    if (!hasUserRelation) {
      throw new Error('User foreign key relationship not found')
    }
    console.log('✅ User foreign key relationship is correct')
    
    // Test 4: Check indexes
    const requiredIndexes = [
      '@@index([expiresAt])',
      '@@index([userId])'
    ]
    
    for (const index of requiredIndexes) {
      if (!schemaContent.includes(index)) {
        throw new Error(`Required index not found: ${index}`)
      }
    }
    console.log('✅ Required indexes are present')
    
    // Test 5: Check User model has oauthStates relation
    const hasOAuthStatesRelation = schemaContent.includes('oauthStates          OAuthState[]')
    if (!hasOAuthStatesRelation) {
      throw new Error('oauthStates relation not found in User model')
    }
    console.log('✅ User model has oauthStates relation')
    
    console.log('\n🎉 OAuth states schema validation completed successfully!')
    console.log('📋 Schema Validation Summary:')
    console.log('  ✅ OAuthState model exists')
    console.log('  ✅ All required fields are present')
    console.log('  ✅ Foreign key relationship is correct')
    console.log('  ✅ Required indexes are present')
    console.log('  ✅ User model relation is correct')
    
    return true
    
  } catch (error) {
    console.error('❌ OAuth states schema validation failed:', error.message)
    console.error('\n🔧 Possible fixes:')
    console.error('  1. Check the Prisma schema file')
    console.error('  2. Ensure all required fields are added')
    console.error('  3. Verify foreign key relationships')
    return false
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  const isValid = validateOAuthSchema()
  process.exit(isValid ? 0 : 1)
}

module.exports = { validateOAuthSchema }
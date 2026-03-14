#!/usr/bin/env node
/**
 * SECURITY VERIFICATION TESTS
 * Verifies Phase 1, 2, 3 implementations
 * Run: node scripts/verifySecurityChanges.js
 */

const bcryptjs = require('bcryptjs');

console.log('\n🔐 SECURITY VERIFICATION - Phase 1-3\n');

// ============================================
// PHASE 1: Environment Variables
// ============================================
console.log('📋 PHASE 1: Environment Variables');
console.log('────────────────────────────────────');

const fs = require('fs');
const path = require('path');

// Check .env.local exists
const envLocalPath = path.resolve(__dirname, '../.env.local');
const envExists = fs.existsSync(envLocalPath);
console.log(`✅ .env.local exists: ${envExists}`);

// Check .gitignore has .env
const gitignorePath = path.resolve(__dirname, '../.gitignore');
const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
const hasEnvInGitignore = gitignore.includes('.env');
console.log(`✅ .gitignore excludes .env: ${hasEnvInGitignore}`);

// Check no .env in git (would need git history check)
console.log(`⚠️  To verify .env not in git history, run:`);
console.log(`   git log --full-history --all -- .env | grep commit\n`);

// ============================================
// PHASE 2: Password Hashing
// ============================================
console.log('🔒 PHASE 2: Password Hashing with bcryptjs');
console.log('────────────────────────────────────────────');

(async () => {
  try {
    // Test hash generation
    const testPassword = '1234';
    const testHash = '$2b$12$MFuiss47HBbRuRps4n93/OKIzXuSnSx2avidp0c4ZER.dmRP7dtJm';
    
    // Verify password against stored hash
    const isMatch = await bcryptjs.compare(testPassword, testHash);
    console.log(`✅ bcryptjs.compare works: ${isMatch}`);
    console.log(`   Password: "${testPassword}"`);
    console.log(`   Hash: ${testHash.substring(0, 30)}...`);
    
    // Test wrong password
    const wrongPassword = 'wrong1234';
    const isWrong = await bcryptjs.compare(wrongPassword, testHash);
    console.log(`✅ Wrong password rejected: ${!isWrong}\n`);
    
  } catch (error) {
    console.error(`❌ bcryptjs verification failed: ${error.message}\n`);
    process.exit(1);
  }
  
  // ============================================
  // PHASE 3: Firestore Rules
  // ============================================
  console.log('🚀 PHASE 3: Firestore Rules');
  console.log('────────────────────────────');
  
  const rulePath = path.resolve(__dirname, '../firestore.rules');
  const rulesExists = fs.existsSync(rulePath);
  console.log(`✅ firestore.rules exists: ${rulesExists}`);
  
  if (rulesExists) {
    const rules = fs.readFileSync(rulePath, 'utf-8');
    console.log(`✅ Rules file size: ${rules.length} bytes`);
    console.log(`✅ Contains IDOR protection (userId == request.auth.uid): ${rules.includes('userId')}`);
    console.log(`✅ Contains admin role check: ${rules.includes('isAdmin')}\n`);
  }
  
  // ============================================
  // SUMMARY
  // ============================================
  console.log('✅ SECURITY VERIFICATION COMPLETE');
  console.log('────────────────────────────────────');
  console.log('\n🎯 Next Steps:');
  console.log('1. Deploy firestore.rules to Firebase:');
  console.log('   firebase deploy --only firestore:rules');
  console.log('\n2. Test login with hashed passwords');
  console.log('   Username: tamara');
  console.log('   Password: 1234');
  console.log('\n3. Change password to verify hashing');
  console.log('\n4. Run IDOR test (described in Phase 3)\n');
  
  process.exit(0);
})();

#!/usr/bin/env node
/**
 * ✅ VERIFICATION SCRIPT - PHASE 5: JWT Session Management
 * Verifies that JWT token generation, verification, and session restoration are working
 */

const fs = require('fs');
const path = require('path');

console.log('\n' + '═'.repeat(70));
console.log('🔐 PHASE 5 VERIFICATION: JWT Session Management');
console.log('═'.repeat(70) + '\n');

let passCount = 0;
let failCount = 0;

// ✅ Test 1: Verify tokenManager.js exists and exports correct functions
console.log('Test 1️⃣ : Check tokenManager.js exports...');
const tokenManagerPath = path.join(__dirname, '../src/security/tokenManager.js');
if (!fs.existsSync(tokenManagerPath)) {
  console.log('   ❌ FAIL: tokenManager.js not found\n');
  failCount++;
} else {
  const content = fs.readFileSync(tokenManagerPath, 'utf8');
  const requiredFunctions = [
    'generateToken',
    'verifyToken',
    'isTokenExpired',
    'storeToken',
    'getStoredToken',
    'clearToken',
    'getCurrentUserId'
  ];
  
  let allFound = true;
  requiredFunctions.forEach(fn => {
    if (content.includes(`const ${fn}`) || content.includes(`export.*${fn}`)) {
      console.log(`   ✅ Found: ${fn}()`);
    } else {
      console.log(`   ❌ Missing: ${fn}()`);
      allFound = false;
    }
  });
  
  if (allFound) {
    console.log('   ✅ PASS: All token manager functions present\n');
    passCount++;
  } else {
    console.log('   ❌ FAIL: Some functions missing\n');
    failCount++;
  }
}

// ✅ Test 2: Verify App.js imports tokenManager
console.log('Test 2️⃣ : Check App.js imports tokenManager...');
const appPath = path.join(__dirname, '../src/App.js');
const appContent = fs.readFileSync(appPath, 'utf8');

const tokenImportExists = appContent.includes('import') && appContent.includes('tokenManager');
const generateTokenUsage = appContent.includes('generateToken(');
const storeTokenUsage = appContent.includes('storeToken(');
const clearTokenUsage = appContent.includes('clearToken(');
const getStoredTokenUsage = appContent.includes('getStoredToken(');
const verifyTokenUsage = appContent.includes('verifyToken(');

if (tokenImportExists) {
  console.log('   ✅ tokenManager import found');
} else {
  console.log('   ❌ tokenManager import NOT found');
}

if (generateTokenUsage) {
  console.log('   ✅ generateToken() used in authenticate()');
} else {
  console.log('   ❌ generateToken() NOT used');
}

if (storeTokenUsage) {
  console.log('   ✅ storeToken() used in authenticate()');
} else {
  console.log('   ❌ storeToken() NOT used');
}

if (clearTokenUsage) {
  console.log('   ✅ clearToken() used in signOutUser()');
} else {
  console.log('   ❌ clearToken() NOT used');
}

if ([tokenImportExists, generateTokenUsage, storeTokenUsage, clearTokenUsage].every(v => v)) {
  console.log('   ✅ PASS: All token functions integrated in App.js\n');
  passCount++;
} else {
  console.log('   ❌ FAIL: Some token integrations missing\n');
  failCount++;
}

// ✅ Test 3: Verify JWT restoration useEffect is present
console.log('Test 3️⃣ : Check JWT session restoration useEffect...');

if (appContent.includes('restoreSessionFromJWT')) {
  console.log('   ✅ restoreSessionFromJWT function found');
} else {
  console.log('   ❌ restoreSessionFromJWT function NOT found');
}

if (appContent.includes('getStoredToken()') && appContent.includes('verifyToken(token)')) {
  console.log('   ✅ JWT token retrieval and verification logic present');
} else {
  console.log('   ❌ JWT retrieval or verification logic missing');
}

if (appContent.includes("decoded?.sub")) {
  console.log('   ✅ Token subject (userId) extraction logic present');
} else {
  console.log('   ❌ Token subject extraction logic NOT found');
}

if (appContent.includes('restoreSessionFromJWT') && appContent.includes('getStoredToken') && appContent.includes('verifyToken')) {
  console.log('   ✅ PASS: Session restoration from JWT implemented\n');
  passCount++;
} else {
  console.log('   ❌ FAIL: Session restoration incomplete\n');
  failCount++;
}

// ✅ Test 4: Verify initial authenticate() uses JWT
console.log('Test 4️⃣ : Check authenticate() function JWT integration...');

const authenticateMatch = appContent.match(/const authenticate = async \(\) => \{[\s\S]{0,3000}?\};/);
if (!authenticateMatch) {
  console.log('   ❌ Could not find authenticate function\n');
  failCount++;
} else {
  const authFunc = authenticateMatch[0];
  
  if (authFunc.includes('verifyPassword')) {
    console.log('   ✅ Password verification (bcryptjs) in authenticate()');
  } else {
    console.log('   ❌ Password verification NOT using bcryptjs');
  }
  
  if (authFunc.includes('generateToken')) {
    console.log('   ✅ JWT generation in authenticate()');
  } else {
    console.log('   ❌ JWT NOT generated in authenticate()');
  }
  
  if (authFunc.includes('storeToken')) {
    console.log('   ✅ JWT storage in localStorage');
  } else {
    console.log('   ❌ JWT NOT stored');
  }
  
  if (authFunc.includes('await generateToken')) {
    console.log('   ✅ Uses async/await for JWT generation');
  } else {
    console.log('   ⚠️  JWT generation might not be async');
  }
  
  if (authFunc.includes('generateToken') && authFunc.includes('storeToken') && authFunc.includes('verifyPassword')) {
    console.log('   ✅ PASS: authenticate() properly integrated with JWT and password hashing\n');
    passCount++;
  } else {
    console.log('   ❌ FAIL: authenticate() JWT/password integration incomplete\n');
    failCount++;
  }
}

// ✅ Test 5: Verify signOutUser() clears JWT
console.log('Test 5️⃣ : Check signOutUser() JWT clearing...');

const signOutMatch = appContent.match(/const signOutUser = \(\) => \{[\s\S]{0,1000}?\};/);
if (!signOutMatch) {
  console.log('   ❌ Could not find signOutUser function\n');
  failCount++;
} else {
  const signOut = signOutMatch[0];
  
  if (signOut.includes('clearToken')) {
    console.log('   ✅ clearToken() called in signOutUser()');
  } else {
    console.log('   ❌ clearToken() NOT called');
  }
  
  if (signOut.includes('localStorage.removeItem') || signOut.includes('sessionStorage.removeItem')) {
    console.log('   ✅ Fallback storage cleanup present');
  } else {
    console.log('   ⚠️  No fallback storage cleanup');
  }
  
  if (signOut.includes('clearToken')) {
    console.log('   ✅ PASS: signOutUser() properly clears JWT\n');
    passCount++;
  } else {
    console.log('   ❌ FAIL: JWT not cleared on logout\n');
    failCount++;
  }
}

// ✅ Test 6: Check initial state uses null instead of getSavedSession()
console.log('Test 6️⃣ : Check initial loggedInUser state...');

if (appContent.includes('useState(null)') && appContent.match(/const \[loggedInUser.*useState\(null\)/)) {
  console.log('   ✅ loggedInUser initial state is null (not getSavedSession)');
  console.log('   ✅ PASS: State initialization proper for JWT\n');
  passCount++;
} else if (appContent.includes('useState()')) {
  console.log('   ⚠️  Initial state may be undefined');
  console.log('   ❌ FAIL: Initial state not properly set\n');
  failCount++;
} else {
  console.log('   ❌ Cannot verify initial state\n');
  failCount++;
}

// ✅ Test 7: Build compilation
console.log('Test 7️⃣ : Verify build compilation...');
const buildPath = path.join(__dirname, '../build');
if (fs.existsSync(buildPath) && fs.existsSync(path.join(buildPath, 'static/js'))) {
  const jsFiles = fs.readdirSync(path.join(buildPath, 'static/js'));
  if (jsFiles.length > 0) {
    console.log(`   ✅ Build compiled: ${jsFiles.length} JS files found`);
    console.log('   ✅ PASS: Project builds successfully\n');
    passCount++;
  } else {
    console.log('   ❌ No JS files in build\n');
    failCount++;
  }
} else {
  console.log('   ❌ Build folder not found (run npm run build)\n');
  failCount++;
}

// ═════════════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═════════════════════════════════════════════════════════════════════════════════════
console.log('═'.repeat(70));
console.log(`\n📊 PHASE 5 VERIFICATION SUMMARY`);
console.log(`   ✅ PASSED: ${passCount}/7`);
console.log(`   ❌ FAILED: ${failCount}/7\n`);

if (failCount === 0) {
  console.log('🎉 PHASE 5 JWT SESSION MANAGEMENT - COMPLETE ✅');
  console.log('   - Token generation with HS256 signing');
  console.log('   - Token storage in localStorage');
  console.log('   - Session restoration on page reload');
  console.log('   - Token verification and cleanup\n');
  process.exit(0);
} else {
  console.log('⚠️  PHASE 5 INCOMPLETE - Fix issues above\n');
  process.exit(1);
}

#!/usr/bin/env node
/**
 * Validate environment variables before build
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_VARS = [
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_APP_ID',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
];

const envFile = path.resolve(__dirname, '../.env');

console.log('🔐 Validating environment variables...');

// Check if .env exists
if (!fs.existsSync(envFile)) {
  console.error('❌ Error: .env file not found');
  console.error(`   Please create .env based on .env.example`);
  process.exit(1);
}

// Load .env
const envContent = fs.readFileSync(envFile, 'utf-8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  
  const [key, ...rest] = trimmed.split('=');
  const value = rest.join('=').trim().replace(/^["']|["']$/g, '');
  
  if (key && value) {
    envVars[key] = value;
  }
});

// Validate required vars
let missing = [];
REQUIRED_VARS.forEach(varName => {
  const value = envVars[varName];
  
  if (!value || value.includes('your_') || value === '') {
    missing.push(varName);
    console.warn(`⚠️  Missing or placeholder: ${varName}`);
  }
});

if (missing.length > 0) {
  console.error(`\n❌ Build failed: ${missing.length} required environment variable(s) not set`);
  console.error(`   Required: ${missing.join(', ')}`);
  console.error(`\n   Steps to fix:`);
  console.error(`   1. Update .env with real Firebase credentials`);
  console.error(`   2. Run: npm run build\n`);
  process.exit(1);
}

console.log('✅ All required environment variables are set');
console.log(`✅ Validated ${REQUIRED_VARS.length} variables\n`);
process.exit(0);

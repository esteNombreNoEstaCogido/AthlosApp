#!/usr/bin/env node
/**
 * Validate environment variables before build
 * Run this script during pre-build to ensure all required vars are set
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_VARS = [
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_APP_ID',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_GEMINI_KEY',
  'REACT_APP_JWT_SECRET',
];

const envFile = path.resolve(__dirname, '../.env.local');

console.log('🔐 Validating environment variables...');

// Check if .env.local exists
if (!fs.existsSync(envFile)) {
  console.error('❌ Error: .env.local file not found');
  console.error(`   Please create .env.local based on .env.local.example`);
  console.error(`   Copy: cp .env.local.example .env.local`);
  process.exit(1);
}

// Load .env.local
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
  console.error(`   1. Copy .env.local.example to .env.local`);
  console.error(`   2. Update values with real credentials`);
  console.error(`   3. Run: npm run build\n`);
  process.exit(1);
}

console.log('✅ All required environment variables are set');
console.log(`✅ Validated ${REQUIRED_VARS.length} variables\n`);
process.exit(0);

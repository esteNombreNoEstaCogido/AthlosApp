#!/usr/bin/env node
/**
 * Validate environment variables before build
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_JWT_SECRET',
];

const envFile = path.resolve(__dirname, '../.env');

console.log('🔐 Validating environment variables...');

// Load from .env file if it exists, otherwise rely on process.env (Vercel, CI, etc.)
const envVars = {};

if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    
    const [key, ...rest] = trimmed.split('=');
    const value = rest.join('=').trim().replace(/^["']|["']$/g, '');
    
    if (key && value) {
      envVars[key] = value;
    }
  });
} else {
  console.log('ℹ️  No .env file found, checking process.env (CI/Vercel mode)');
}

// Validate required vars (check .env first, then process.env as fallback)
let missing = [];
REQUIRED_VARS.forEach(varName => {
  const value = envVars[varName] || process.env[varName];
  
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

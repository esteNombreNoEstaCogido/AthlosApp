# 🚀 AthlosApp Deployment Guide

## Pre-Launch Checklist

### Phase 1: Security Configuration ✅

- [x] Environment variables configured (.env.local)
- [x] Firebase project created and configured
- [x] Firestore database initialized
- [x] API keys restricted to authorized domains
- [x] CORS configured for your domain
- [x] Authentication enabled in Firebase

### Phase 2: Code Security ✅

- [x] Password hashing implemented (bcryptjs)
- [x] Input validation configured (AJV)
- [x] XSS prevention active (sanitization)
- [x] JWT token management enabled (HS256)
- [x] Rate limiting configured (5 attempts, 5 min)
- [x] No hardcoded secrets in code

### Phase 3: Firestore Security ✅

- [x] Firestore Rules created (firestore.rules)
- [x] IDOR protection implemented (userId == request.auth.uid)
- [x] Deny-by-default security model
- [x] Data validation in rules

### Phase 4: Testing ✅

- [x] Security tests passing (10/10)
- [x] JWT verification working
- [x] Build compilation successful
- [x] No console errors or warnings

### Phase 5: Deployment Ready

- [x] Firebase Rules deployed
- [x] Hosting configured (firebase.json)
- [x] Build optimized for production

---

## Deployment Steps

### Step 1: Prerequisites

```bash
# Install Node.js 16+ and npm
node --version    # Should be v16.0.0 or higher
npm --version     # Should be v7.0.0 or higher

# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Verify Firebase CLI
firebase --version
```

### Step 2: Environment Setup

```bash
# Copy .env.local.example to .env (for production server)
cp .env.local.example .env.production

# Update .env.production with production values:
# - Real Firebase API key from Firebase Console
# - Real project ID (athlos-5dcc5)
# - Production Gemini API key
# - Secure JWT secret (32+ char random string)
```

**Environment Variables Required**:
```
REACT_APP_FIREBASE_API_KEY=<your_firebase_key>
REACT_APP_FIREBASE_PROJECT_ID=athlos-5dcc5
REACT_APP_FIREBASE_APP_ID=<your_firebase_app_id>
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=<your_sender_id>
REACT_APP_GEMINI_KEY=<your_gemini_api_key>
REACT_APP_JWT_SECRET=<32+_char_random_string>
```

**Generate Secure JWT Secret**:
```bash
# On macOS/Linux:
openssl rand -hex 32

# On Windows PowerShell:
$bytes = [System.Byte[]]::new(32)
$rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
$rng.GetBytes($bytes)
[System.BitConverter]::ToString($bytes).Replace('-','').ToLower()
```

### Step 3: Build for Production

```bash
# Install dependencies
npm install

# Validate environment variables
npm run build

# This will:
# - Validate all 6 required env vars
# - Compile React app for production
# - Optimize bundle size
# - Create build/ folder

# Expected output:
# ✅ Build successful
# ✅ ~475 kB gzipped (main bundle)
```

### Step 4: Deploy Firestore Rules (CRITICAL)

```bash
# Make sure you're authenticated with Firebase
firebase login

# Verify project is configured
firebase projects:list

# Deploy ONLY Firestore Rules (this is critical for security!)
firebase deploy --only firestore:rules

# Expected output:
# ✅ firestore: rules file firestore.rules compiled successfully
# ✅ firestore: released rules firestore.rules to cloud.firestore
```

**⚠️ CRITICAL**: Without this step, IDOR vulnerability persists!

### Step 5: Deploy to Firebase Hosting

```bash
# Option A: Deploy everything (Firestore + Hosting)
firebase deploy

# Option B: Deploy only hosting (if rules already deployed)
firebase deploy --only hosting

# Expected output:
# ✅ Deploy complete!
# ✅ Project Console: https://console.firebase.google.com/project/athlos-5dcc5/overview
```

### Step 6: Verify Deployment

```bash
# Check Firestore Rules are live
firebase rules:describe firestore

# Expected output:
# - Rules version 2
# - IDOR protection active
# - Deny-by-default model

# Test the app
open https://athlos-5dcc5.web.app
# or visit your custom domain
```

---

## Post-Deployment Verification

### 1. Test Authentication Flow

```javascript
// 1. Login with test user
// Username: coach
// Password: (from .env.local)

// 2. Verify session loads (should see dashboard)

// 3. Check browser console (no JWT errors)

// 4. Reload page (session should persist) ✅ Phase 5

// 5. Logout (JWT should be cleared)

// 6. Login again (new JWT should be generated)
```

### 2. Test Security Features

```bash
# Run security tests
npm run test:security

# Expected: 10/10 tests passing
```

### 3. Monitor Firebase Console

```
Firebase Console → Project → Realtime Database
├─ Firestore Rules tab
│  └─ Verify rules are deployed and green
├─ Authentication tab
│  └─ Verify user authentication working
├─ Hosting tab
│  └─ Verify deployment status
└─ Cloud Functions (future)
```

### 4. Check SSL Certificate

```bash
# Verify HTTPS is active
curl -I https://athlos-5dcc5.web.app

# Expected:
# HTTP/2 200
# content-type: text/html
```

---

## Scaling & Optimization

### Firebase Quotas (Free Tier)

| Resource | Free Limit | Production |
|----------|-----------|------------|
| Firestore Reads | 50K/day | Upgrade needed |
| Firestore Writes | 20K/day | Upgrade needed |
| Storage | 1 GB | Upgrade needed |
| Functions | 2M calls/month | Upgrade needed |

**When to Upgrade**:
- > 1000 active daily users
- > 10K read operations/day
- > 2K write operations/day

### Performance Recommendations

1. **Enable Firestore Caching**
   ```javascript
   // Client-side caching (built-in)
   firebase.firestore().settings({ 
     cacheSizeBytes: 100 * 1024 * 1024  // 100MB
   });
   ```

2. **Implement Pagination**
   - Current: Loads all users on login
   - Future: Paginate user lists (50 per page)

3. **Add Cloud Functions**
   - Serverless functions for complex operations
   - Rate limiting at backend
   - Data processing/validation

4. **Use CDN**
   - Firebase Hosting uses CDN by default
   - Consider Cloudflare for additional DDoS protection

---

## Troubleshooting

### Issue: "Failed to authenticate, have you run firebase login?"

**Solution**:
```bash
firebase login
# Select your Google account in the browser
# Grant permissions
firebase deploy --only firestore:rules
```

### Issue: "Rules compiled successfully" but not deployed

**Solution**:
```bash
# Verify rules syntax
firebase rules:list firestore

# Try uploading again with verbose logging
firebase deploy --only firestore:rules --debug
```

### Issue: "Build failed: REACT_APP_JWT_SECRET not found"

**Solution**:
```bash
# Check .env.local exists and has all 6 vars
cat .env.local

# Ensure all these exist:
REACT_APP_FIREBASE_API_KEY
REACT_APP_FIREBASE_PROJECT_ID
REACT_APP_FIREBASE_APP_ID
REACT_APP_FIREBASE_MESSAGING_SENDER_ID
REACT_APP_GEMINI_KEY
REACT_APP_JWT_SECRET
```

### Issue: "CORS error when accessing Firestore"

**Solution**:
```
Firebase Console → Project Settings → Authorized Domains
├─ Add your domain (e.g., athlosapp.com)
└─ Wait 5 minutes for changes to propagate
```

### Issue: "Users can see other users' data (IDOR)"

**Solution**:
```bash
# This means Firestore Rules not deployed!
firebase deploy --only firestore:rules

# Verify rule deployment
firebase rules:describe firestore
# Should show: "request.auth.uid == userId"
```

---

## Rollback Procedures

### If Firestore Rules Break Everything

```bash
# Option 1: Allow all (temporary)
echo 'service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}' > firestore.rules
firebase deploy --only firestore:rules

# Option 2: Revert to previous rules
git checkout HEAD~1 firestore.rules
firebase deploy --only firestore:rules
```

### If Hosting Deployment Breaks App

```bash
# List previous hosted versions
firebase hosting:versions:list

# Rollback to previous version
firebase hosting:releases:create

# Check which version is current
firebase hosting:channels:list
```

---

## Monitoring & Maintenance

### Regular Checks

**Weekly**:
- [ ] Check Firebase console for errors
- [ ] Review authentication logs
- [ ] Monitor Firestore reads/writes quota

**Monthly**:
- [ ] Run security tests: `npm run test:security`
- [ ] Check for npm package updates: `npm outdated`
- [ ] Review Firestore data backups

**Quarterly**:
- [ ] Security audit
- [ ] Performance optimization
- [ ] Update dependencies: `npm update`

### Logs to Monitor

```
Firebase Console → Logs
├─ Functions Logs
├─ Cloud Firestore Rules Logs
├─ Authentication Logs
└─ Hosting Logs
```

---

## Common Commands Reference

```bash
# Build for production
npm run build

# Test security
npm run test:security

# Verify JWT
npm run test:jwt

# Deploy everything
firebase deploy

# Deploy only Firestore Rules
firebase deploy --only firestore:rules

# Deploy only Hosting
firebase deploy --only hosting

# View logs
firebase functions:log

# Delete Firebase project (danger!)
firebase projects:delete athlos-5dcc5
```

---

## Support & Resources

- **Firebase Documentation**: https://firebase.google.com/docs
- **Firestore Rules**: https://firebase.google.com/docs/firestore/security/get-started
- **React + Firebase**: https://firebase.google.com/docs/firestore/client/libraries#web_v9
- **Security Best Practices**: https://cheatsheetseries.owasp.org/

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-03-14 | Initial deployment guide with Firestore Rules |

---

**Last Updated**: 2024-03-14
**Status**: ✅ Ready for Production Deployment

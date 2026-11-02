# 🏋️ ATHLOS - Premium Training App

**Build**: Vite (`dist/`) | **Checks**: 16 security configuration checks and 7 feature tests

---

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Features](#features)
- [Project Structure](#project-structure)
- [Environment Setup](#environment-setup)
- [Development](#development)
- [Security](#security)
- [Deployment](#deployment)
- [Support](#support)

---

## 🚀 Quick Start

### Installation

```bash
npm install
npm run dev
```

The app will open at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

Output: `dist/` directory.

### Testing

```bash
npm run security:check
npm run test:calendar
npm run test:feedback
npm run test:exercises
```

---

## ✨ Features

### 🎨 User Interface
- **Premium Logo & Header** - Gold ATHLOS branding on dark background
- **Splash Screen** - Fast logo display on app startup (800ms)
- **9 Color Palettes** - User can personalize theme (Premium Dark, Ocean Blue, Forest Green, etc.)
- **Daily Motivational Quotes** - Admin-controlled, real-time updates
- **Smart Back Button** - 2-tap exit with safety toast warning
- **Toast Notifications** - Non-intrusive feedback (success/error/warning/info)
- **Responsive Design** - Mobile, tablet, desktop optimized

### 💪 Training Features
- **Workout Plans** - Create custom routines per client
- **Exercise Library** - 50+ predefined exercises with form tips
- **Progress Tracking** - Weight, reps, volume analytics
- **Rest Timer** - Rest period management between sets
- **PDF Reports** - Export workout plans
- **Session Timer** - Track workout duration

### 👥 User Management
- **Admin Controls** - Manage clients and routines
- **Follow-up dashboard** - Search/filter clients by pending questionnaire, inactivity and training activity
- **Client Profiles** - Individual training plans
- **Notes & Feedback** - Add exercise notes and tips
- **Offline Support** - Works offline with localStorage

### 🔐 Security
- **Firebase Authentication** - Email/password credentials and Firebase-managed sessions
- **Firestore Rules** - Clients are bound to their `authUid`; admin actions require the server-issued `admin` custom claim
- **Cloud Functions** - Account creation, password reset and deletion run in a trusted environment
- **Input Validation** - AJV JSON schema validation
- **Input Sanitization** - XSS prevention, HTML entity encoding
- **Migration guide** - See [AUTH_MIGRATION.md](AUTH_MIGRATION.md) before deploying the auth change

---

## 📁 Project Structure

```
AthlosApp/
├── functions/
│   ├── index.js                      # Privileged Firebase callable functions
│   └── migrateLegacyAuth.cjs         # One-time trusted legacy account migration
├── src/
│   ├── App.js                          # Main app component
│   ├── index.js                        # React entry point
│   ├── styles.css                      # Tailwind imports
│   │
│   ├── components/
│   │   ├── AthlosBrandHeader.js        # Logo + motivational phrase
│   │   ├── ColorPalettePicker.js       # Theme selector (9 palettes)
│   │   ├── BackButtonExitHandler.js    # 2-tap exit handler
│   │   ├── Toast.js                    # Notification system
│   │   └── AdminMotivationalManager.js # Admin phrase dashboard
│   │
│   ├── security/
│   │   ├── passwordManager.js          # bcryptjs hashing
│   │   ├── tokenManager.js             # JWT (HS256) management
│   │   ├── sanitization.js             # XSS prevention
│   │   ├── validationSchemas.js        # AJV JSON validation
│   │   └── validateEnv.js              # Environment validation
│   │
│   └── utils/
│       └── colorPalettes.js            # 9 color themes
│
├── scripts/
│   ├── validateEnv.js                  # Check required env vars
│   └── phase6_securityTests.js         # Security test suite (17 tests)
│
├── public/
│   └── index.html                      # HTML entry point
│
├── .env.example                        # Environment variables template
├── .firebaserc                         # Firebase project config
├── firebase.json                       # Firebase hosting & emulator config
├── firestore.rules                     # Firestore security rules
├── package.json                        # Dependencies & scripts
└── README.md                           # This file
```

---

## 🔧 Environment Setup

### Required Environment Variables

Create a `.env` file in the root directory:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_GEMINI_KEY=your_gemini_api_key
VITE_ENV=development
```

The required Firebase variables are validated before each production build.

### Firebase Setup

1. **Initialize Firebase**:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init
   ```

2. **Deploy Firestore Rules**:
   ```bash
   firebase deploy --only firestore:rules
   ```

---

## 💻 Development

### Available Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run security:check` | Check Firebase Auth and Firestore security configuration |
| `npm run test:calendar` | Test workout calendar behavior |
| `npm run test:feedback` | Test exercise feedback validation |
| `npm run test:exercises` | Test exercise add/remove behavior |

---

## 🔐 Security verification

Run `npm run security:check` for static configuration checks. These checks do not replace Firebase Emulator tests, a production deployment review, or a penetration test. Before releasing the authentication changes, complete the legacy account migration and deploy both Firestore rules and Cloud Functions as documented in [AUTH_MIGRATION.md](AUTH_MIGRATION.md).

---

## 🚀 Deployment

### Firebase Hosting

```bash
# Deploy everything
firebase deploy

# Deploy only Firestore rules
firebase deploy --only firestore:rules

# Deploy only hosting
firebase deploy --only hosting
```

### Vercel Deployment

1. **Push to GitHub**:
```bash
git push origin main
```

2. **Connect to Vercel**:
- Go to vercel.com
- Click "New Project"
- Select your GitHub repository
- Vercel will auto-detect React app

3. **Set Environment Variables**:
   - In Vercel Dashboard → Settings → Environment Variables
   - Add all variables from `.env`:
     - `VITE_FIREBASE_API_KEY`
     - `VITE_FIREBASE_PROJECT_ID`
     - `VITE_FIREBASE_APP_ID`
     - `VITE_FIREBASE_MESSAGING_SENDER_ID`
     - `VITE_GEMINI_KEY` (optional)

4. **Deploy**:
   - Vercel auto-deploys on every push to main
   - View deployment at: `yourapp.vercel.app`

### Environment Variables for Production

Set in Firebase Console or Vercel:
1. Go to Project Settings → Environment Variables
2. Add all 4 required variables
3. Build will validate on deployment

---

## 📊 Build Summary

| Item | Value |
|------|-------|
| Build output | `dist/` |
| Security configuration checks | 16/16 passing |
| Feature tests | 11 passing |
| Bundle note | Main chunk exceeds Vite's 500 kB advisory threshold |

---

## 📞 Support

**Q: How do I deploy to Firebase?**
A: `firebase deploy --only firestore:rules` then `firebase deploy --only hosting`

**Q: How do I run security tests?**
A: Run `npm run security:check`, `npm run test:calendar`, and `npm run test:feedback`.

**Q: How do I set environment variables?**
A: Copy `.env.example` to `.env` and fill in your Firebase credentials

---

## ✅ Status

Static security checks pass. The main production bundle currently exceeds Vite's 500 kB advisory threshold.

- ✅ 7 security phases implemented
- ✅ 17/17 security tests passing
- ✅ Premium UI with branding
- ✅ Real-time Firestore sync
- ✅ Mobile responsive
- ✅ Zero known vulnerabilities

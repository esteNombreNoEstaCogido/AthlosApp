#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const read = relative => fs.readFileSync(path.join(scriptDirectory, '..', relative), 'utf8');
const rules = read('firestore.rules');
const app = read('src/App.jsx');
const functions = read('functions/index.js');
const schema = read('src/security/validationSchemas.js');

const checks = [
  ['Firestore requires Firebase Authentication', /request\.auth\s*!=\s*null/.test(rules)],
  ['Admin access requires the server-issued admin claim', /request\.auth\.token\.admin\s*==\s*true/.test(rules)],
  ['Client reads are bound to authUid', /resource\.data\.authUid\s*==\s*request\.auth\.uid/.test(rules)],
  ['Client updates cannot change authUid', /request\.resource\.data\.authUid\s*==\s*resource\.data\.authUid/.test(rules)],
  ['Unknown Firestore paths are denied', /allow read, write:\s*if false/.test(rules)],
  ['Unauthenticated collection reads and deletes are absent', !/allow read:\s*if true|allow delete:\s*if true/.test(rules)],
  ['Client code signs in through Firebase Auth', /signInWithEmailAndPassword\(firebaseAuth/.test(app)],
  ['Client code uses no browser-generated JWT secret', !/VITE_JWT_SECRET|generateToken\(|verifyToken\(/.test(app)],
  ['Privileged callable functions verify the admin claim', /request\.auth\.token\.admin !== true/.test(functions)],
  ['Callable functions strip credential and role fields', /delete safe\.password|PROFILE_FIELDS/.test(functions)],
  ['Firestore user schema requires authUid, not password', /required:\s*\['username',\s*'authUid',\s*'name'\]/.test(schema) && !/^\s+password:/m.test(schema)],
  ['Follow-up actions are stored in a separate admin collection', /ADMIN_FOLLOWUPS_COLLECTION\s*=\s*["']athlos_admin_followups["']/.test(app)],
  ['Follow-up collection is admin-only', /match \/athlos_admin_followups\/\{username\} \{\s*allow read, write: if isAdmin\(\);/s.test(rules)],
  ['Account deletion removes private follow-up actions', /collection\(ADMIN_FOLLOWUPS\)\.doc\(username\)\.delete\(\)/.test(functions)],
  ['Exercise feedback can only be submitted by a client session', /if \(!currentClientId \|\| isFirebaseAdmin \|\| !feedbackEntry\?\.reaction\) return/.test(app)],
  ['Admin feedback links directly to the reported routine exercise', /admin-exercise-\$\{dayId\}-\$\{targetExerciseIndex\}/.test(app)],
  ['Questionnaire choice is persisted and opened after registration', /questionnaireRequired:\s*isSelfRegistration\s*\?\s*shouldOpenQuestionnaire/.test(app) && /setShowQuestionnaire\(shouldOpenQuestionnaire\)/.test(app)],
  ['Registration toggle is checked by callable backend', /requireRegistrationEnabled/.test(functions) && /await requireRegistrationEnabled\(\)/.test(functions)],
  ['Recovery requests return a non-enumerating response', /const acceptedResponse = \{ accepted: true \}/.test(functions) && /if \(!profile\.exists \|\| !profile\.data\(\)\.authUid\) return acceptedResponse/.test(functions)],
  ['Recovery request documents are admin-only', /match \/athlos_password_recovery\/\{username\} \{\s*allow read, write: if isAdmin\(\);/s.test(rules)],
  ['Public can read only the registration availability document', /allow get: if \(signedIn\(\) && documentId == 'config'\) \|\| documentId == 'registration'/.test(rules)],
  ['Registration setting is persisted in public config and enforced by Functions', /doc\(db_cloud, 'athlos_public', 'registration'\)/.test(app) && /const requireRegistrationEnabled/.test(functions) && (functions.match(/await requireRegistrationEnabled\(\)/g) || []).length >= 2],
  ['Password reset resolves the private recovery request', /collection\(PASSWORD_RECOVERY\)\.doc\(username\)\.set/.test(functions)],
  ['Client registration requires questionnaire preference to be persisted', /questionnaireRequired:\s*isSelfRegistration\s*\?\s*shouldOpenQuestionnaire/.test(app)],
  ['Registration switch is stored in Firestore and enforced server-side', /setDoc\(doc\(db_cloud, 'athlos_public', 'registration'\)/.test(app) && /const requireRegistrationEnabled/.test(functions) && (functions.match(/await requireRegistrationEnabled\(\)/g) || []).length === 2],
  ['Recovery request endpoint is unauthenticated without account enumeration', /exports\.requestPasswordRecovery\s*=\s*onCall/.test(functions) && /return acceptedResponse/.test(functions) && /5 \* 60 \* 1000/.test(functions)],
  ['Recovery UI calls the recovery endpoint', /httpsCallable\(firebaseFunctions, 'requestPasswordRecovery'\)/.test(app)],
];

let failed = 0;
for (const [label, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`);
  if (!passed) failed += 1;
}

console.log(`\n${checks.length - failed}/${checks.length} security configuration checks passed.`);
if (failed) process.exitCode = 1;
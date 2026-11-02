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
];

let failed = 0;
for (const [label, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`);
  if (!passed) failed += 1;
}

console.log(`\n${checks.length - failed}/${checks.length} security configuration checks passed.`);
if (failed) process.exitCode = 1;
const { applicationDefault, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
const adminUsername = (process.env.ATHLOS_ADMIN_USERNAME || 'entrenador').toLowerCase();
const emailDomain = '@athlos.app';

if (!projectId) {
  console.error('Set FIREBASE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS before running migration.');
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth();
const firestore = getFirestore();

const getOrCreateAuthUser = async (username, profile) => {
  const email = `${username}${emailDomain}`;
  let existing = null;
  try {
    existing = await auth.getUser(username);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
  }

  if (existing) {
    if (existing.email !== email) {
      throw new Error(`UID ${username} is already assigned to another email address.`);
    }
    return existing;
  }

  const password = profile.password;
  if (typeof password !== 'string' || !password) {
    throw new Error(`Profile ${username} has no password and no migrated Auth account.`);
  }

  if (/^\$2[aby]\$/.test(password)) {
    const normalizedHash = password.startsWith('$2b$') ? `$2a$${password.slice(4)}` : password;
    const imported = await auth.importUsers([{
      uid: username,
      email,
      displayName: String(profile.name || username).slice(0, 100),
      passwordHash: Buffer.from(normalizedHash),
      emailVerified: true,
      disabled: false
    }], { hash: { algorithm: 'BCRYPT', rounds: Number(password.slice(4, 6)) || 12 } });

    if (imported.failureCount) {
      const reasons = imported.errors.map(item => item.error?.message || 'unknown import error').join('; ');
      throw new Error(`Could not import ${username}: ${reasons}`);
    }
    return auth.getUser(username);
  }

  return auth.createUser({
    uid: username,
    email,
    displayName: String(profile.name || username).slice(0, 100),
    password,
    emailVerified: true,
    disabled: false
  });
};

const migrate = async () => {
  const snapshot = await firestore.collection('athlos_clients').get();
  const profiles = snapshot.docs.filter(item => item.id !== '_deleted_users');
  if (!profiles.length) throw new Error('No legacy profiles found in athlos_clients. Nothing was changed.');
  if (!profiles.some(item => item.id === adminUsername)) {
    throw new Error(`Admin profile "${adminUsername}" was not found. No profile passwords were removed.`);
  }

  let migrated = 0;
  for (const item of profiles) {
    const username = item.id.toLowerCase();
    if (!/^[a-z0-9_-]{3,50}$/.test(username)) {
      throw new Error(`Invalid legacy username/document ID: ${item.id}`);
    }

    const profile = item.data();
    let account;
    if (profile.authUid) {
      account = await auth.getUser(profile.authUid);
      if (account.email !== `${username}${emailDomain}`) {
        throw new Error(`Auth email mismatch for ${username}; refusing to modify this profile.`);
      }
    } else {
      account = await getOrCreateAuthUser(username, profile);
    }

    const claims = { ...(account.customClaims || {}) };
    if (username === adminUsername) claims.admin = true;
    else delete claims.admin;
    await auth.setCustomUserClaims(account.uid, claims);

    const update = {
      username,
      authUid: account.uid,
      authMigratedAt: new Date().toISOString()
    };
    if (Object.prototype.hasOwnProperty.call(profile, 'password')) {
      update.password = FieldValue.delete();
    }
    await item.ref.set(update, { merge: true });
    migrated += 1;
    console.log(`Migrated ${username} -> ${account.uid}${username === adminUsername ? ' (admin claim)' : ''}`);
  }

  console.log(`Completed: ${migrated} profile(s). Verify Firebase Auth users and deploy firestore.rules before reopening the app.`);
};

migrate().catch(error => {
  console.error('Migration aborted:', error.message);
  process.exitCode = 1;
});
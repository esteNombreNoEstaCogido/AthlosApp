const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();

const auth = getAuth();
const firestore = getFirestore();
const CLIENTS = 'athlos_clients';
const ADMIN_FOLLOWUPS = 'athlos_admin_followups';
const EMAIL_DOMAIN = '@athlos.app';
const REGION = 'us-central1';
const USERNAME_PATTERN = /^[a-z0-9_-]{3,50}$/;

const requireAdmin = (request) => {
  if (!request.auth || request.auth.token.admin !== true) {
    throw new HttpsError('permission-denied', 'Se requiere rol de administrador.');
  }
};

const validateUsername = (username) => {
  if (typeof username !== 'string' || !USERNAME_PATTERN.test(username)
      || ['entrenador', 'coach', '_deleted_users'].includes(username)) {
    throw new HttpsError('invalid-argument', 'Nombre de usuario no válido.');
  }
};

const validatePassword = (password) => {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128
      || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)
      || /^\s|\s$/.test(password)) {
    throw new HttpsError('invalid-argument', 'La contraseña debe tener al menos 8 caracteres, una letra y un número.');
  }
};

const PROFILE_FIELDS = new Set([
  'username', 'name', 'color', 'subtitle', 'advice', 'logs', 'notes', 'questionnaire',
  'questionnaireRequired', 'questionnaireSubmittedAt', 'questionnaireUpdatedAt', 'questionnaireVersion',
  'createdAt', 'workoutData', 'lastActivityAt', 'userStats', 'progressPhotos', 'exerciseNotes',
  'preferredPaletteId', 'avatar'
]);

const cleanProfile = (profile, username, name, uid) => {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new HttpsError('invalid-argument', 'Perfil no válido.');
  }
  if (Buffer.byteLength(JSON.stringify(profile), 'utf8') > 700_000) {
    throw new HttpsError('invalid-argument', 'El perfil supera el tamaño permitido.');
  }
  const safe = Object.fromEntries(Object.entries(profile).filter(([key]) => PROFILE_FIELDS.has(key)));
  safe.username = username;
  safe.name = name;
  safe.authUid = uid;
  return safe;
};

const createClientAccount = async ({ username, name, password, profile }, adminCreated = false) => {
  validateUsername(username);
  validatePassword(password);
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
    throw new HttpsError('invalid-argument', 'Nombre no válido.');
  }

  const profileRef = firestore.collection(CLIENTS).doc(username);
  if ((await profileRef.get()).exists) {
    throw new HttpsError('already-exists', 'Ese nombre de usuario ya existe.');
  }

  let account;
  try {
    account = await auth.createUser({
      email: `${username}${EMAIL_DOMAIN}`,
      password,
      displayName: name.trim(),
      emailVerified: true
    });
    const clientProfile = adminCreated ? profile : {
      color: 'from-blue-600 to-indigo-500',
      subtitle: 'Nuevo usuario',
      advice: 'A darlo todo.',
      logs: {},
      notes: [],
      questionnaire: {},
      questionnaireRequired: requestQuestionnaire(profile),
      questionnaireSubmittedAt: null,
      questionnaireUpdatedAt: null,
      createdAt: new Date().toISOString(),
      workoutData: { days: [] }
    };
    await profileRef.create(cleanProfile(clientProfile, username, name.trim(), account.uid));
    return account;
  } catch (error) {
    if (account) await auth.deleteUser(account.uid).catch(() => {});
    if (error instanceof HttpsError) throw error;
    if (error.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'Ese nombre de usuario ya existe.');
    }
    console.error('Could not create client account:', error);
    throw new HttpsError('internal', 'No se pudo crear la cuenta.');
  }
};

const requestQuestionnaire = (profile) => profile?.questionnaireRequired === true;

exports.registerClient = onCall({ region: REGION }, async (request) => {
  const account = await createClientAccount(request.data || {});
  const customToken = await auth.createCustomToken(account.uid);
  return { uid: account.uid, customToken };
});

exports.adminCreateClient = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const account = await createClientAccount(request.data || {}, true);
  return { uid: account.uid };
});

exports.adminResetClientPassword = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const { username, password } = request.data || {};
  validateUsername(username);
  validatePassword(password);
  if (username === 'entrenador') {
    throw new HttpsError('failed-precondition', 'No se puede restablecer desde aquí la contraseña del administrador.');
  }
  const profile = await firestore.collection(CLIENTS).doc(username).get();
  if (!profile.exists || !profile.data().authUid) {
    throw new HttpsError('not-found', 'No se encontró la cuenta del cliente.');
  }
  const user = await auth.getUser(profile.data().authUid);
  if (user.customClaims?.admin === true) {
    throw new HttpsError('failed-precondition', 'La contraseña de una cuenta administradora no se puede cambiar desde el panel de clientes.');
  }
  await auth.updateUser(user.uid, { password });
  return { success: true };
});

exports.adminDeleteClient = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const { username } = request.data || {};
  validateUsername(username);
  const profileRef = firestore.collection(CLIENTS).doc(username);
  const profile = await profileRef.get();
  if (!profile.exists) throw new HttpsError('not-found', 'No se encontró el cliente.');
  const uid = profile.data().authUid;
  if (uid === request.auth.uid) {
    throw new HttpsError('failed-precondition', 'No se puede eliminar la sesión administradora actual.');
  }
  if (uid) await auth.deleteUser(uid).catch(error => {
    if (error.code !== 'auth/user-not-found') throw error;
  });
  await firestore.collection(ADMIN_FOLLOWUPS).doc(username).delete();
  await profileRef.delete();
  return { success: true };
});

exports.deleteOwnClientAccount = onCall({ region: REGION }, async (request) => {
  if (!request.auth || request.auth.token.admin === true) {
    throw new HttpsError('permission-denied', 'Esta operación solo está disponible para cuentas de cliente.');
  }
  const username = String(request.auth.token.email || '').split('@')[0].toLowerCase();
  validateUsername(username);
  const profileRef = firestore.collection(CLIENTS).doc(username);
  const profile = await profileRef.get();
  if (!profile.exists || profile.data().authUid !== request.auth.uid) {
    throw new HttpsError('not-found', 'No se encontró el perfil asociado.');
  }
  await firestore.collection(ADMIN_FOLLOWUPS).doc(username).delete();
  await profileRef.delete();
  await auth.deleteUser(request.auth.uid);
  return { success: true };
});
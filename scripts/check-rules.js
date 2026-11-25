import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '../src');

let errorsFound = false;

function scanDirectory(dir) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      scanDirectory(filePath);
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.jsx') || filePath.endsWith('.js')) {
      checkFileContent(filePath);
    }
  });
}

function checkFileContent(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);

  // Verify profile images are uploaded to Storage before their URLs enter Firestore.
  if (path.basename(filePath) === 'App.jsx') {
    const avatarStorageFlow = /profile-avatars\/\$\{targetUserId\}\/avatar\.jpg/.test(content)
      && /uploadBytes\(avatarRef/.test(content)
      && /avatar:\s*avatarUrl/.test(content);
    const progressPhotoStorageFlow = /progress-photos\/\$\{currentClientId\}\/\$\{entry\.id\}\/\$\{angle\}\.jpg/.test(content)
      && /uploadString\(photoRef/.test(content)
      && /uploadedEntry\[angle\]\s*=\s*await getDownloadURL\(photoRef\)/.test(content);
    const directBase64ProfileWrite = /\bavatar\s*:\s*(?:base64|data:image\/)/i.test(content)
      || /\bprogressPhotos\s*:\s*\[[^\]]*(?:base64|data:image\/)/i.test(content);

    if (!avatarStorageFlow || !progressPhotoStorageFlow || directBase64ProfileWrite) {
      console.error(`❌ [ERROR]: Las imágenes de perfil o progreso deben subirse a Firebase Storage en: ${relativePath}`);
      errorsFound = true;
    }
  }

  // 2. Detección de reactividad onSnapshot sin desuscripción en useEffect
  if (content.includes('onSnapshot') && content.includes('useEffect')) {
    if (!content.includes('return () =>') && !content.includes('return unsubscribe')) {
      console.warn(`⚠️ [ADVERTENCIA]: Posible fuga de memoria/bucle. Verifica que onSnapshot devuelva la limpieza en useEffect en: ${relativePath}`);
    }
  }

}

console.log('🔍 Analizando código fuente en busca de infracciones de rendimiento y seguridad...');
scanDirectory(srcDir);

if (errorsFound) {
  console.error('\n🛑 Se encontraron infracciones graves. Revisa los errores anteriores antes de desplegar.');
  process.exit(1);
} else {
  console.log('✅ El código cumple con las normas de rendimiento y cuota gratuita de Firestore.');
}

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

  // 1. Detección de imágenes en Base64 escritas en Firestore/código
  if (content.includes('data:image/') && (content.includes('setDoc') || content.includes('updateDoc') || content.includes('addDoc'))) {
    console.error(`❌ [ERROR]: Detección de Base64 guardándose en Firestore en: ${relativePath}`);
    errorsFound = true;
  }

  // 2. Detección de reactividad onSnapshot sin desuscripción en useEffect
  if (content.includes('onSnapshot') && content.includes('useEffect')) {
    if (!content.includes('return () =>') && !content.includes('return unsubscribe')) {
      console.warn(`⚠️ [ADVERTENCIA]: Posible fuga de memoria/bucle. Verifica que onSnapshot devuelva la limpieza en useEffect en: ${relativePath}`);
    }
  }

  // 3. Intento de reintroducir el campo 'password' en operaciones de Firestore
  if ((content.includes('setDoc') || content.includes('updateDoc')) && /password\s*:/i.test(content)) {
    console.error(`❌ [ERROR CRÍTICO]: Se está intentando guardar el campo 'password' en Firestore en: ${relativePath}. Utiliza Firebase Auth.`);
    errorsFound = true;
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

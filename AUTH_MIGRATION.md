# Migración a Firebase Authentication

## Qué va a cambiar

La app dejará de comprobar contraseñas dentro del navegador. Se autenticará con Firebase Authentication y accederá a Firestore con la identidad verificada. El usuario seguirá escribiendo su nombre habitual; Firebase usa internamente `nombre@athlos.app`. Ese alias no es un buzón y no recibe correo.

El proyecto Firebase configurado en este repositorio es `athlos-5dcc5` y la región de Cloud Functions es `us-central1`. Comprueba en Firebase Console que ese es el proyecto correcto antes de continuar.

## 1. Preparar una copia de seguridad

1. Abre [Firebase Console](https://console.firebase.google.com/) y selecciona `athlos-5dcc5`.
2. Ve a **Firestore Database → Import/Export** y exporta la base de datos a un bucket de Cloud Storage. Si tu consola no ofrece esa opción, usa Google Cloud Console → Firestore → Import/Export o pide a quien administre el proyecto una exportación.
3. En **Firestore Database → Data**, abre la colección `athlos_clients` y confirma que existe `entrenador` y que aparecen los perfiles que quieres conservar.
4. No continúes si falta el perfil administrador, hay perfiles duplicados/inconsistentes o la copia de seguridad no terminó correctamente.

La migración elimina `password` de cada documento después de migrar esa cuenta a Authentication. Es intencional e irreversible desde el frontend; la copia de seguridad es necesaria para poder recuperar los datos legacy si algo falla.

## 2. Activar el proveedor de acceso

1. En Firebase Console, abre **Authentication → Get started** si aún no está inicializado.
2. En **Authentication → Sign-in method** (o **Providers**), abre **Email/Password**.
3. Activa **Email/Password** y guarda. No hace falta activar **Email link/passwordless**.
4. No crees los usuarios manualmente: el script de migración importa las cuentas existentes conservando sus contraseñas.

## 3. Preparar permisos y herramientas en Windows

Instala o verifica Firebase CLI y Google Cloud CLI. Después, abre PowerShell en la carpeta del proyecto:

```powershell
Set-Location C:\Users\G513\Desktop\AthlosApp
firebase login
firebase use athlos-5dcc5
firebase use
gcloud auth application-default login
$env:FIREBASE_PROJECT_ID = "athlos-5dcc5"
$env:ATHLOS_ADMIN_USERNAME = "entrenador"
npm --prefix functions install
```

La salida de `firebase use` debe mostrar `athlos-5dcc5`. La cuenta de Google usada por `gcloud auth application-default login` necesita permiso temporal para administrar Firebase Authentication y leer/escribir Firestore, por ejemplo los roles **Firebase Authentication Admin** y **Cloud Datastore User**. Pídele estos permisos al administrador de Google Cloud si no los tienes. Retíralos cuando finalice la migración si no deben ser permanentes.

También se puede usar una cuenta de servicio, pero guarda el JSON fuera del repositorio y no lo compartas con otra IA:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\ruta-segura\athlos-migration-service-account.json"
$env:FIREBASE_PROJECT_ID = "athlos-5dcc5"
$env:ATHLOS_ADMIN_USERNAME = "entrenador"
```

El username de administrador debe coincidir exactamente con el **ID del documento** administrador en `athlos_clients`. En la configuración actual es `entrenador`.

## 4. Ejecutar la migración de cuentas

Desde la raíz del proyecto y con las variables/permisos del paso anterior:

```powershell
npm --prefix functions run migrate:legacy-auth
```

El script:

- Crea un usuario de Firebase Authentication por cada documento legacy, con email interno `id-del-documento@athlos.app`. Los usuarios legacy importados usan el ID del documento como UID; las cuentas nuevas reciben el UID de Firebase, que queda guardado en `authUid`.
- Importa hashes bcrypt compatibles cuando existen; si un perfil conserva una contraseña legacy en texto plano, la importa como contraseña de Firebase Auth. No imprime contraseñas.
- Asigna el custom claim `admin: true` solo a `ATHLOS_ADMIN_USERNAME` y lo retira de los demás perfiles.
- Escribe `authUid` en cada perfil y elimina `password` de ese perfil solo después de comprobar la cuenta Auth.

No tiene modo de simulación. Si se detiene a mitad, **no borres ni recrees usuarios a ciegas**: algunas cuentas pueden estar ya migradas. Corrige el error y vuelve a ejecutar el script; reconoce perfiles con `authUid` y verifica que el email corresponda antes de continuar. Si el mismo email ya existe con otro UID, requiere reconciliación manual segura.

## 5. Comprobar la migración antes del despliegue

En Firebase Console:

1. En **Authentication → Users**, comprueba que las cuentas esperadas aparecen como `usuario@athlos.app`.
2. En **Firestore Database → Data → athlos_clients**, abre `entrenador` y varios clientes: cada uno debe tener `authUid` y ninguno debe conservar `password`.
3. Revisa el resultado de PowerShell: debe terminar con `Completed: N profile(s)` y mostrar `entrenador ... (admin claim)`.
4. Conserva la exportación de Firestore hasta probar los accesos de entrenador y cliente. Firebase Console no siempre muestra los custom claims en la tabla de usuarios; el claim admin se valida al iniciar sesión y cargar la lista de clientes.

## 6. Desplegar reglas, funciones y app en este orden

Primero se publica la seguridad/backend y enseguida el frontend nuevo. Al desplegar las reglas, las versiones antiguas de la app ya no podrán leer Firestore. Coordina el cambio como una ventana breve de mantenimiento.

```powershell
firebase deploy --only firestore:rules,functions
npm run security:check
npm run build
firebase deploy --only hosting
```

La configuración de Hosting de este repositorio publica `dist`, que es el directorio de salida de Vite. El plan de Firebase debe permitir desplegar Cloud Functions (normalmente plan Blaze). No publiques el frontend si falla el despliegue de reglas o Functions.

## 7. Probar los dos roles

1. Abre la app publicada en una ventana privada e inicia sesión como `entrenador` con su contraseña actual.
2. Confirma que aparece el panel y la lista de clientes. La app fuerza la renovación del token para cargar el claim admin.
3. Inicia sesión con un cliente: debe cargar solo su perfil, rutina, métricas y feedback propio.
4. Comprueba que crear cliente, restablecer contraseña, borrar cliente y borrar cuenta funcionan desde la app. Son operaciones de Cloud Functions.
5. Si un cliente no puede entrar, verifica Authentication → Users, el campo `authUid` del perfil y que el email interno corresponda al username.

Las reglas dan lectura de `athlos_clients/{username}` al admin o al UID propietario; el listado de colección y todas las escrituras administrativas requieren `request.auth.token.admin == true`. Las acciones privadas del entrenador viven en `athlos_admin_followups` y son admin-only. La frase pública está en `athlos_public/config`. Todo lo demás se deniega.

La contraseña olvidada se cambia desde el panel del entrenador mediante Cloud Functions; el email sintético no permite recuperación por correo. No pegues contraseñas, claves privadas ni JSON de cuentas de servicio en chats o herramientas de IA.

## Resumen breve para otra IA

```text
Proyecto AthlosApp: React 19 + Vite + Firebase Auth/Firestore; Firebase project `athlos-5dcc5`. Login usa `username@athlos.app`. Perfiles en `athlos_clients/{username}`; el UID Auth está en `authUid` (legacy importado: UID=username; cuentas nuevas: UID generado por Firebase). Las reglas dan acceso al perfil solo al propietario o al custom claim admin; admin es `entrenador`. Migración: `functions/migrateLegacyAuth.cjs`; requiere ADC, `FIREBASE_PROJECT_ID` y `ATHLOS_ADMIN_USERNAME`. Cloud Functions v2/Node 22 en `us-central1`: registro, altas/reset/bajas. Deploy: `firebase deploy --only firestore:rules,functions`, luego build y Hosting. Nunca abrir reglas ni compartir claves; backup obligatorio antes de migrar.
```
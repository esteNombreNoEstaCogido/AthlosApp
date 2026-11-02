# Normas de Rendimiento, Seguridad y Optimización de Firestore — Proyecto Athlos

Cualquier código de TypeScript/React o Cloud Functions generado o modificado debe cumplir estrictamente las siguientes directivas para garantizar el plan gratuito y la seguridad en Firebase:

## 1. Prevención de Bucles Infinitos en React (`useEffect`)
- NUNCA realices llamadas directas a Firestore (`getDoc`, `getDocs`, `onSnapshot`) dentro de un `useEffect` sin una lista de dependencias definida y estable.
- NUNCA incluyas funciones generadas en el cuerpo del componente como dependencias sin envolverlas en `useCallback`.
- Si utilizas suscripciones en tiempo real (`onSnapshot`), DEBES retornar siempre la función de limpieza (`unsubscribe`) en el `return` del `useEffect`.

```tsx
// Ejemplo correcto
useEffect(() => {
  if (!user?.uid) return;
  const unsubscribe = onSnapshot(doc(db, 'athlos_clients', user.uid), (docSnap) => {
    setClientData(docSnap.data());
  });
  return () => unsubscribe();
}, [user?.uid]);
```

## 2. Optimización de Consultas a Firestore

- NUNCA solicites colecciones enteras si solo necesitas un documento específico.
- Implementa paginación (`limit()`) en consultas de listados extensos.
- Trae solo los campos necesarios y evita re-renders innecesarios guardando referencias directas a IDs o valores primarios.

## 3. Manejo de Multimedia e Imágenes

- Queda ESTRICTAMENTE PROHIBIDO almacenar imágenes en base64 dentro de los documentos de Firestore.
- Las imágenes de progreso, perfil o avatar deben subirse siempre a Firebase Storage (donde disponemos de 5 GB gratuitos).
- En Firestore solo se permite almacenar la cadena URL pública resultante (`https://firebasestorage.googleapis.com/...`).

## 4. Reglas de Autenticación y Seguridad

- Toda consulta privada a un documento de cliente debe filtrarse por el `authUid` autenticado.
- Las operaciones administrativas (creación de usuarios, reseteo de claves, eliminación de cuentas) deben invocarse exclusivamente a través de las Cloud Functions de `us-central1` validadas con el custom claim `admin`.
- NUNCA incluyas o vuelvas a escribir el campo `password` en los documentos de la colección `athlos_clients`.

## 5. Sistema de Diseño y Rediseño UI
- Fondo general: `bg-zinc-950` o `bg-black`.
- Tarjetas: `bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-md rounded-2xl`.
- Acentos principales: ámbar y dorado (`from-amber-500 to-yellow-400`, `text-amber-400`, `border-amber-500/20`).
- No uses fondos azul eléctrico en tarjetas de perfil; mantén la identidad oscura y dorada.
- La pantalla principal debe conservar espacio inferior suficiente (`pb-28` o `pb-32`) para que la navegación flotante no tape contenido.
- Muestra el estado online como una cápsula suave con `bg-emerald-500/10 text-emerald-400 border border-emerald-500/20`, padding compacto y `rounded-full`.
- Usa Framer Motion para transiciones de tarjetas y barras de progreso, respetando accesibilidad y evitando animaciones innecesarias.
- El proyecto usa React con JSX; conserva ese formato en los componentes existentes salvo que una migración a TypeScript sea parte explícita de la tarea.

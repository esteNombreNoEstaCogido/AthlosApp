import React, { useState, useEffect, useCallback, memo, useRef, useMemo } from "react";
import html2pdf from "html2pdf.js";
import { hashPassword, verifyPassword, validatePassword } from "./security/passwordManager.js";
import { 
  sanitizeInput, sanitizeUrl, safeJSONParse, escapeHtml 
} from "./security/sanitization.js";
import {
  safeParseWeight, safeParseReps, safeParseSerries,
  validateWorkoutLogData as validateLogAJV
} from "./security/validationSchemas.js";
import {
  generateToken, verifyToken, storeToken, getStoredToken, clearToken
} from "./security/tokenManager.js";
import { AthlosSplashScreen } from "./components/SplashScreen.jsx";
import { AthlosBrandHeader } from "./components/AthlosBrandHeader.jsx";
import { ColorPalettePicker } from "./components/ColorPalettePicker.jsx";
import { BackButtonExitHandler } from "./components/BackButtonExitHandler.jsx";
import { Toast, useToast } from "./components/Toast.jsx";
import { AdminMotivationalManager } from "./components/AdminMotivationalManager.jsx";
import { ExerciseImageManager } from "./components/ExerciseImageManager.jsx";
import { ProgressTracker } from "./components/ProgressTracker.jsx";
import { PhotoComparator } from "./components/PhotoComparator.jsx";
import { COLOR_PALETTES, getPaletteById } from "./utils/colorPalettes.js";
// Importaciones de Firebase
import { initializeApp } from "firebase/app";
import { 
  initializeFirestore, persistentLocalCache, persistentSingleTabManager,
  getFirestore, doc, setDoc, getDoc, getDocFromServer, getDocs, collection, onSnapshot, deleteDoc,
  enableNetwork 
} from "firebase/firestore";
import {
  Dumbbell, Flame, Info, ChevronRight, ArrowLeft, User, Heart, Youtube, 
  PlusCircle, History, Trash2, Clock, MessageSquareHeart, X, Zap, Users, 
  Settings, Plus, Edit3, TrendingUp, Trophy, Crown, LayoutDashboard, 
  PlayCircle, Calculator, Brain, Loader2, LogOut, Key, CheckCircle2, Sparkles,
  Camera, Eye, Download, TrendingDown, Scale, Image, RefreshCw, Database,
  Swords, Target, Shield, Bike, Footprints, Mountain, Timer, Activity,
  HeartPulse, GripVertical, Search, CalendarDays
} from "lucide-react";

// Iconos predefinidos para días de entrenamiento (admin puede elegir)
const DAY_ICON_OPTIONS = [
  { id: "dumbbell", label: "Mancuerna", icon: Dumbbell },
  { id: "flame", label: "Fuego", icon: Flame },
  { id: "zap", label: "Rayo", icon: Zap },
  { id: "trophy", label: "Trofeo", icon: Trophy },
  { id: "crown", label: "Corona", icon: Crown },
  { id: "target", label: "Diana", icon: Target },
  { id: "swords", label: "Espadas", icon: Swords },
  { id: "shield", label: "Escudo", icon: Shield },
  { id: "heart", label: "Corazón", icon: Heart },
  { id: "heartpulse", label: "Pulso", icon: HeartPulse },
  { id: "brain", label: "Cerebro", icon: Brain },
  { id: "bike", label: "Bici", icon: Bike },
  { id: "footprints", label: "Pasos", icon: Footprints },
  { id: "mountain", label: "Montaña", icon: Mountain },
  { id: "timer", label: "Cronómetro", icon: Timer },
  { id: "activity", label: "Actividad", icon: Activity },
  { id: "sparkles", label: "Estrellas", icon: Sparkles },
  { id: "calculator", label: "Calculadora", icon: Calculator },
];

const getDayIcon = (iconId) => {
  const found = DAY_ICON_OPTIONS.find(o => o.id === iconId);
  return found ? found.icon : Dumbbell;
};

// ==========================================
// CONFIGURACIÓN FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const APP_VERSION = "2.4.4";
const COLLECTION_NAME = "athlos_clients";
const __DEV__ = import.meta.env.MODE === 'development';
const log = (...args) => { if (__DEV__) console.log(...args); };
const warn = (...args) => { if (__DEV__) console.warn(...args); };
const err = (...args) => { console.error(...args); };

let app, db_cloud;
try {
  app = initializeApp(firebaseConfig);
  // Usar persistentSingleTabManager (compatible con Android WebView)
  // persistentMultipleTabManager usa BroadcastChannel que no existe en WebViews
  try {
    db_cloud = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({ forceOwnership: true }) })
    });
    log("✅ Firestore offline persistence enabled (singleTab)");
  } catch (persistErr) {
    warn("⚠️ Persistence init failed, trying without cache config:", persistErr.message);
    try {
      db_cloud = getFirestore(app);
      log("✅ Firestore initialized (memory cache)");
    } catch (fallbackErr) {
      err("❌ Firestore fallback also failed:", fallbackErr.message);
    }
  }
} catch (e) {
  err("Firebase init failed:", e.message);
}
if (!db_cloud) {
  err("⛔ Firestore not initialized — app will run in offline-only mode");
}

// Constantes de configuración
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_BASE_MS = 5 * 60 * 1000; // 5 minutos base
const MAX_LOG_ENTRIES = 15;
const TOKEN_HOURS_DEFAULT = 24;
const TOKEN_HOURS_KEEP = 720; // 30 días

// ==========================================
// UTILIDADES BLINDADAS
// ==========================================
// ✅ sanitizeInput, sanitizeUrl imported from src/security/sanitization.js
// Uses HTML entity escaping for XSS prevention
// Blocks data: URIs in URLs (prevents XSS via data URLs)

const getSavedSession = () => {
  try {
    const local = localStorage.getItem("athlos_session_final");
    if (local && local !== "undefined") return JSON.parse(local);
    const session = sessionStorage.getItem("athlos_session_final");
    if (session && session !== "undefined") return JSON.parse(session);
  } catch (e) { return null; }
  return null;
};

const callGeminiAPI = async (prompt) => {
  const geminiKey = import.meta.env.VITE_GEMINI_KEY;
  if (!geminiKey || geminiKey === "tu_api_key_aqui") {
    warn("⚠️ Gemini API key no configurada");
    return "Coach AI en descanso. ¡Sigue así! 💪";
  }
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiKey}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Coach AI en descanso. ¡Sigue así! 💪";
  } catch { return "Coach AI en descanso. ¡Sigue así! 💪"; }
};

// ==========================================
// SEGURIDAD & UTILITIES
// ==========================================
// ✅ Secure password functions imported from passwordManager.js
// hashPassword, validatePassword are now bcryptjs-backed

const generatePDFReport = (client, days) => {
  const esc = escapeHtml;
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
      <h1 style="color: #1a1a1a; border-bottom: 3px solid #f59e0b; padding-bottom: 10px;">📋 PLAN DE ENTRENAMIENTO</h1>
      <h2 style="color: #666;">${esc(client.name)}</h2>
      <p style="color: #999; font-style: italic;">${esc(client.subtitle || '')}</p>
      <p style="color: #999; margin-bottom: 30px;"><strong>Generado:</strong> ${new Date().toLocaleDateString('es-ES')}</p>
      
      ${days.map(day => `
        <div style="background: white; padding: 15px; margin-bottom: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
          <h3 style="color: #1a1a1a; margin: 0 0 10px 0;">${esc(day.title)}</h3>
          <p style="color: #666; margin: 5px 0;"><strong>Enfoque:</strong> ${esc(day.focus || 'General')}</p>
          <h4 style="color: #888; margin-top: 10px;">Ejercicios:</h4>
          <ul style="color: #666; padding-left: 20px;">
            ${(day.exercises || []).map(ex => `
              <li style="margin: 8px 0;">
                <strong>${esc(ex.name)}</strong> - ${esc(String(ex.s))} series x ${esc(String(ex.r))} reps
                <br/><small style="color: #999;">Grupo: ${esc(ex.mus)} ${ex.tip ? '| Tip: ' + esc(ex.tip) : ''}</small>
              </li>
            `).join('')}
          </ul>
        </div>
      `).join('')}
      
      <div style="margin-top: 30px; padding: 15px; background: #fff3cd; border-radius: 8px;">
        <p style="color: #666;"><strong>💡 Consejo del Coach:</strong> ${esc(client.advice || 'Mantén la consistencia y disfruta el proceso.')}</p>
      </div>
    </div>
  `;
  
  const opt = {
    margin: 10,
    filename: `${client.name}_Plan_Entrenamiento_${new Date().toISOString().split('T')[0]}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
  };
  
  html2pdf().set(opt).from(html).save();
};

// ==========================================
// DATOS INICIALES - EJERCICIOS
// ==========================================
const GRUPOS_MUSCULARES = ['Pecho', 'Espalda', 'Hombros', 'Brazos', 'Piernas', 'Glúteo', 'Core', 'Cuádriceps', 'Isquios', 'Cardio', 'Movilidad'];
const GRUPO_EMOJI = { Pecho: '🫁', Espalda: '🔙', Hombros: '🏋️', Brazos: '💪', Piernas: '🦵', 'Glúteo': '🍑', Core: '🎯', 'Cuádriceps': '🦿', Isquios: '🦵', Cardio: '❤️‍🔥', Movilidad: '🧘' };

const EJERCICIOS_PREDEFINIDOS = [
  // PECHO
  { name: "Press de Banca", mus: "Pecho", img: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=press+de+banca" },
  { name: "Flexiones", mus: "Pecho", img: "https://images.unsplash.com/photo-1608805622529-4f3cec3d7c5a?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=flexiones+perfectas" },
  { name: "Cruce de Poleas", mus: "Pecho", img: "https://images.unsplash.com/photo-1590239926044-23927693630f?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=cruce+poleas" },
  { name: "Floor Press (Suelo)", mus: "Pecho", img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=floor+press" },
  { name: "Press Inclinado", mus: "Pecho", img: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=press+inclinado" },
  { name: "Press Declinado", mus: "Pecho", img: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=press+declinado" },
  { name: "Aperturas con Mancuernas", mus: "Pecho", img: "https://images.unsplash.com/photo-1590239926044-23927693630f?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=aperturas+mancuernas+pecho" },
  { name: "Aperturas en Peck Deck", mus: "Pecho", img: "https://images.unsplash.com/photo-1590239926044-23927693630f?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=aperturas+peck+deck" },
  { name: "Press con Mancuernas", mus: "Pecho", img: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=press+mancuernas+pecho" },
  { name: "Press Convergente en Máquina", mus: "Pecho", img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=press+convergente+maquina+pecho" },
  { name: "Dips (Fondos en Paralelas)", mus: "Pecho", img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=fondos+paralelas+pecho" },
  
  // ESPALDA
  { name: "Remo", mus: "Espalda", img: "https://images.unsplash.com/photo-1574519338703-46cc396c01db?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=remo+tecnica" },
  { name: "Remo con goma", mus: "Espalda", img: "https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=remo+banda+elastica" },
  { name: "Dominadas", mus: "Espalda", img: "https://images.unsplash.com/photo-1597124514420-c6391dd34e97?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=dominadas+tecnica" },
  { name: "Pull-over", mus: "Espalda", img: "https://images.unsplash.com/photo-1591940742878-13aba4b7a35e?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=pullover" },
  { name: "Jalón al Pecho", mus: "Espalda", img: "https://images.unsplash.com/photo-1605296867304-46d5465a13f1?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=jalon+al+pecho" },
  { name: "Remo con Barra", mus: "Espalda", img: "https://images.unsplash.com/photo-1574519338703-46cc396c01db?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=remo+barra" },
  { name: "Remo con Mancuerna", mus: "Espalda", img: "https://images.unsplash.com/photo-1574519338703-46cc396c01db?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=remo+mancuerna+un+brazo" },
  { name: "Jalón Agarre Cerrado", mus: "Espalda", img: "https://images.unsplash.com/photo-1605296867304-46d5465a13f1?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=jalon+agarre+cerrado" },
  { name: "Remo en Polea Baja", mus: "Espalda", img: "https://images.unsplash.com/photo-1605296867304-46d5465a13f1?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=remo+polea+baja" },
  { name: "Peso Muerto Convencional", mus: "Espalda", img: "https://images.unsplash.com/photo-1633626773746-25284de532af?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=peso+muerto+convencional" },
  
  // HOMBROS
  { name: "Press Militar", mus: "Hombros", img: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=press+militar" },
  { name: "Abducción Hombro", mus: "Hombros", img: "https://images.unsplash.com/photo-1590239926044-23927693630f?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=abduccion+hombro" },
  { name: "Elevaciones Laterales", mus: "Hombros", img: "https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=elevaciones+laterales" },
  { name: "Face Pulls", mus: "Hombros", img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=face+pulls" },
  { name: "Retracción Escapular", mus: "Hombros", img: "https://images.unsplash.com/photo-1549576528-b0f2f33aafc5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=retraccion+escapular" },
  { name: "Pájaros (Rear Delt Fly)", mus: "Hombros", img: "https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=pajaros+hombro+posterior" },
  { name: "Press Arnold", mus: "Hombros", img: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=press+arnold" },
  { name: "Elevaciones Frontales", mus: "Hombros", img: "https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=elevaciones+frontales" },
  { name: "Encogimientos (Shrugs)", mus: "Hombros", img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=encogimientos+trapecio" },
  
  // BRAZOS
  { name: "Curl de Bíceps", mus: "Brazos", img: "https://images.unsplash.com/photo-1567059884314-1812253f72c5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=curl+biceps" },
  { name: "Extensiones Tríceps", mus: "Brazos", img: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=extensiones+triceps" },
  { name: "Curl Martillo", mus: "Brazos", img: "https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=curl+martillo" },
  { name: "Fondos en Banco", mus: "Brazos", img: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=fondos+en+banco" },
  { name: "Curl Concentrado", mus: "Brazos", img: "https://images.unsplash.com/photo-1567059884314-1812253f72c5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=curl+concentrado" },
  { name: "Curl con Barra Z", mus: "Brazos", img: "https://images.unsplash.com/photo-1567059884314-1812253f72c5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=curl+barra+z" },
  { name: "Press Francés", mus: "Brazos", img: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=press+frances+triceps" },
  { name: "Extensión Tríceps Polea", mus: "Brazos", img: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=extension+triceps+polea" },
  { name: "Curl Predicador", mus: "Brazos", img: "https://images.unsplash.com/photo-1567059884314-1812253f72c5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=curl+predicador" },
  { name: "Patada de Tríceps", mus: "Brazos", img: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=patada+triceps" },
  
  // PIERNAS
  { name: "Sentadilla Normal", mus: "Piernas", img: "https://images.unsplash.com/photo-1595078519480-bc102f8aa565?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=sentadilla+tecnica" },
  { name: "Prensa de Piernas", mus: "Piernas", img: "https://images.unsplash.com/photo-1576556356529-3f0f8c9346d5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=prensa+piernas" },
  { name: "Box Squat (Silla)", mus: "Piernas", img: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=box+squat" },
  { name: "Sentadilla Búlgara", mus: "Piernas", img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=sentadilla+bulgara" },
  { name: "Zancada", mus: "Piernas", img: "https://images.unsplash.com/photo-1595078519480-bc102f8aa565?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=zancada" },
  { name: "Peso Muerto Sumo", mus: "Piernas", img: "https://images.unsplash.com/photo-1633626773746-25284de532af?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=peso+muerto+sumo" },
  { name: "Sentadilla Goblet", mus: "Piernas", img: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=sentadilla+goblet" },
  { name: "Step Up (Subida al Cajón)", mus: "Piernas", img: "https://images.unsplash.com/photo-1595078519480-bc102f8aa565?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=step+up+cajon" },
  { name: "Elevación de Gemelos", mus: "Piernas", img: "https://images.unsplash.com/photo-1576556356529-3f0f8c9346d5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=elevacion+gemelos" },
  
  // GLÚTEO
  { name: "Hip Thrust", mus: "Glúteo", img: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=hip+thrust" },
  { name: "Glute Bridge", mus: "Glúteo", img: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=glute+bridge" },
  { name: "Patada de Glúteo", mus: "Glúteo", img: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=patada+gluteo" },
  { name: "Abducción Máquina", mus: "Glúteo", img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=abduccion+gluteo" },
  { name: "Abducciones en Polea", mus: "Glúteo", img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=abducciones+en+polea+gluteo" },
  { name: "Hiperextensiones", mus: "Glúteo", img: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=hiperextensiones+gluteo" },
  { name: "Step Up", mus: "Glúteo", img: "https://images.unsplash.com/photo-1595078519480-bc102f8aa565?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=step+up+gluteo" },
  { name: "Peso Muerto Rumano (Glúteo)", mus: "Glúteo", img: "https://images.unsplash.com/photo-1633626773746-25284de532af?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=peso+muerto+rumano+gluteo" },
  { name: "Zancada (Glúteo)", mus: "Glúteo", img: "https://images.unsplash.com/photo-1595078519480-bc102f8aa565?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=zancada+gluteo" },
  { name: "Prensa Alta", mus: "Glúteo", img: "https://images.unsplash.com/photo-1576556356529-3f0f8c9346d5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=prensa+alta+gluteo" },
  { name: "Sentadilla Sumo", mus: "Glúteo", img: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=sentadilla+sumo+gluteo" },
  { name: "Kickback en Polea", mus: "Glúteo", img: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=kickback+polea+gluteo" },
  { name: "Buenos Días (Good Morning)", mus: "Glúteo", img: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=buenos+dias+ejercicio" },
  
  // CORE
  { name: "Plank (Plancha)", mus: "Core", img: "https://images.unsplash.com/photo-1608805755619-8d716c7ab49f?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=plank+perfecto" },
  { name: "Crunch", mus: "Core", img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=crunch" },
  { name: "Deadbug (Bicho Muerto)", mus: "Core", img: "https://images.unsplash.com/photo-1608805755619-8d716c7ab49f?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=deadbug" },
  { name: "Rueda Abdominal", mus: "Core", img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=rueda+abdominal" },
  { name: "Mountain Climbers", mus: "Core", img: "https://images.unsplash.com/photo-1608805755619-8d716c7ab49f?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=mountain+climbers" },
  { name: "Elevación de Piernas", mus: "Core", img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=elevacion+piernas+abdominales" },
  { name: "Pallof Press", mus: "Core", img: "https://images.unsplash.com/photo-1608805755619-8d716c7ab49f?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=pallof+press" },
  { name: "Plancha Lateral", mus: "Core", img: "https://images.unsplash.com/photo-1608805755619-8d716c7ab49f?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=plancha+lateral" },
  { name: "Russian Twist", mus: "Core", img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=russian+twist" },
  
  // CUÁDRICEPS
  { name: "Extensión Cuádriceps", mus: "Cuádriceps", img: "https://images.unsplash.com/photo-1584735175097-24340077ad18?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=extension+cuadriceps" },
  { name: "Leg Press", mus: "Cuádriceps", img: "https://images.unsplash.com/photo-1576556356529-3f0f8c9346d5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=leg+press" },
  { name: "Sentadilla Frontal", mus: "Cuádriceps", img: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=sentadilla+frontal" },
  { name: "Hack Squat", mus: "Cuádriceps", img: "https://images.unsplash.com/photo-1576556356529-3f0f8c9346d5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=hack+squat" },
  { name: "Sissy Squat", mus: "Cuádriceps", img: "https://images.unsplash.com/photo-1595078519480-bc102f8aa565?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=sissy+squat" },
  
  // ISQUIOS
  { name: "Peso Muerto Rumano", mus: "Isquios", img: "https://images.unsplash.com/photo-1633626773746-25284de532af?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=peso+muerto+rumano" },
  { name: "Leg Curl", mus: "Isquios", img: "https://images.unsplash.com/photo-1598971457747-9b61f4981e91?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=leg+curl" },
  { name: "Curl Femoral Sentado", mus: "Isquios", img: "https://images.unsplash.com/photo-1598971457747-9b61f4981e91?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=curl+femoral" },
  { name: "Peso Muerto con Barra", mus: "Isquios", img: "https://images.unsplash.com/photo-1633626773746-25284de532af?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=peso+muerto+barra+isquios" },
  { name: "Buenos Días con Barra", mus: "Isquios", img: "https://images.unsplash.com/photo-1598971457747-9b61f4981e91?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=good+morning+barra" },
  
  // CARDIO
  { name: "Burpees", mus: "Cardio", img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=burpees+tecnica" },
  { name: "Jumping Jacks", mus: "Cardio", img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=jumping+jacks" },
  { name: "Salto a Cajón (Box Jump)", mus: "Cardio", img: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=box+jump" },
  { name: "Sprint en Cinta", mus: "Cardio", img: "https://images.unsplash.com/photo-1576556356529-3f0f8c9346d5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=sprint+cinta" },
  { name: "Saltar la Cuerda", mus: "Cardio", img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=saltar+cuerda" },
  { name: "Remo en Máquina (Cardio)", mus: "Cardio", img: "https://images.unsplash.com/photo-1574519338703-46cc396c01db?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=remo+maquina+cardio" },
  { name: "Bicicleta Estática", mus: "Cardio", img: "https://images.unsplash.com/photo-1576556356529-3f0f8c9346d5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=bicicleta+estatica" },
  
  // MOVILIDAD
  { name: "Cat-Cow (Gato-Camello)", mus: "Movilidad", img: "https://images.unsplash.com/photo-1544367567-0d5fccc6678d?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=cat+cow+movilidad" },
  { name: "Estiramiento de Cadera", mus: "Movilidad", img: "https://images.unsplash.com/photo-1544367567-0d5fccc6678d?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=estiramiento+cadera" },
  { name: "Rotación Torácica", mus: "Movilidad", img: "https://images.unsplash.com/photo-1544367567-0d5fccc6678d?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=rotacion+toracica" },
  { name: "Estiramiento de Hombro", mus: "Movilidad", img: "https://images.unsplash.com/photo-1544367567-0d5fccc6678d?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=estiramiento+hombro" },
  { name: "Foam Rolling", mus: "Movilidad", img: "https://images.unsplash.com/photo-1544367567-0d5fccc6678d?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=foam+rolling" },
  { name: "Sentadilla Profunda (Movilidad)", mus: "Movilidad", img: "https://images.unsplash.com/photo-1544367567-0d5fccc6678d?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=sentadilla+profunda+movilidad" },
];

const ATHLOS_FORGE_EXERCISES = [
  // CALENTAMIENTO Y ACTIVACIÓN
  { name: "Cat-Cow (Gato-Camello)", mus: "Movilidad", img: "https://images.unsplash.com/photo-1544367567-0d5fccc6678d?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60", yt: "https://www.youtube.com/results?search_query=cat+cow+yoga", coaching: "10 reps muy lentas" },
  { name: "Bird-Dog (Pajaro-Perro)", mus: "Core", img: "https://images.unsplash.com/photo-1609899753861-25c1a3a74324?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60", yt: "https://www.youtube.com/results?search_query=bird+dog+exercise", coaching: "3 series x 10 reps alternas" },
  { name: "Glute Bridge (Puente de gluteo)", mus: "Glúteo", img: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60", yt: "https://www.youtube.com/results?search_query=glute+bridge", coaching: "2 series x 12 reps (sin peso)" },
  // TABLA PRINCIPAL
  { name: "Box Squat (Silla)", mus: "Piernas", img: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=box+squat+form", coaching: "Bajar lento, tocar silla y subir" },
  { name: "Remo con goma", mus: "Espalda", img: "https://images.unsplash.com/photo-1574519338703-46cc396c01db?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=remo+banda+elastica", coaching: "Sentada/Pie. Juntar escapulas atras" },
  { name: "Floor Press (Suelo)", mus: "Pecho", img: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=floor+press+dumbbells", coaching: "Mancuernas. Protege hombro operado" },
  { name: "P. Muerto Rumano", mus: "Isquios", img: "https://images.unsplash.com/photo-1633626773746-25284de532af?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=peso+muerto+rumano", coaching: "Mancuernas ligeras. Espalda recta" },
  { name: "Deadbug (Bicho Muerto)", mus: "Core", img: "https://images.unsplash.com/photo-1608805755619-8d716c7ab49f?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=deadbug+core", coaching: "Espalda baja pegada al suelo" },
  // PECHO
  { name: "Press Inclinado Mancuernas", mus: "Pecho", img: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=press+inclinado+mancuernas", coaching: "RIR 1. Más seguro para hombro" },
  { name: "Press Pecho Máquina Convergente", mus: "Pecho", img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=press+maquina+pecho", coaching: "RIR 0 en última serie" },
  { name: "Cruce Poleas Pecho", mus: "Pecho", img: "https://images.unsplash.com/photo-1590239926044-23927693630f?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=cruce+poleas+pecho", coaching: "Abajo-Arriba. Máximo bombeo" },
  // ESPALDA
  { name: "Dominadas", mus: "Espalda", img: "https://images.unsplash.com/photo-1597124514420-c6391dd34e97?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=dominadas+tecnica", coaching: "Control en bajada. RIR 1" },
  { name: "Remo Polea Baja Neutro", mus: "Espalda", img: "https://images.unsplash.com/photo-1605296867304-46d5465a13f1?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=remo+polea+baja", coaching: "Contrae escápulas atrás" },
  { name: "Pull-over Polea Alta", mus: "Espalda", img: "https://images.unsplash.com/photo-1591940742878-13aba4b7a35e?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=pullover+polea", coaching: "Cuerda. Máximo estiramiento" },
  // HOMBROS
  { name: "Press Militar Sentado", mus: "Hombros", img: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=press+militar+sentado", coaching: "Espalda apoyada. Control" },
  { name: "Elevaciones Laterales", mus: "Hombros", img: "https://images.unsplash.com/photo-1590239926044-23927693630f?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=elevaciones+laterales", coaching: "Brazo atrás de espalda" },
  { name: "Face Pulls", mus: "Hombros", img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=face+pulls", coaching: "Salud hombro. Squeeze posterior" },
  // BRAZOS
  { name: "Curl de Bíceps Barra Z", mus: "Brazos", img: "https://images.unsplash.com/photo-1567059884314-1812253f72c5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=curl+barra+z", coaching: "Sin balanceos. Control" },
  { name: "Extensiones Tríceps Polea", mus: "Brazos", img: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=extensiones+triceps+polea", coaching: "Cuerda. Contracción máxima" },
  // PIERNAS
  { name: "Prensa de Piernas", mus: "Piernas", img: "https://images.unsplash.com/photo-1576556356529-3f0f8c9346d5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=prensa+piernas", coaching: "Rango completo. Dropset final" },
  { name: "Extensión Cuádriceps", mus: "Piernas", img: "https://images.unsplash.com/photo-1584735175097-24340077ad18?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=extension+cuadriceps", coaching: "Pausa en contracción" },
  { name: "Curl Femoral Sentado", mus: "Piernas", img: "https://images.unsplash.com/photo-1591940742878-13aba4b7a35e?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=curl+femoral", coaching: "Aguanta 2s contracción" },
  // GLÚTEO
  { name: "Hip Thrust Pesado", mus: "Glúteo", img: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=hip+thrust", coaching: "Pausa 2s arriba. Máxima carga" },
  { name: "Abducción Máquina", mus: "Glúteo", img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=abduccion+gluteo", coaching: "Rango completo. Control" },
  // CORE
  { name: "Plank (Plancha)", mus: "Core", img: "https://images.unsplash.com/photo-1608805755619-8d716c7ab49f?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=plank+perfecto", coaching: "Cuerpo recto. Glúteo contraído" },
];

const RUTINA_TAMARA_OFICIAL = [
  { id: 101, title: "DÍA 1: Glúteo Máximo", focus: "Fuerza", warmupType: "warmupAthlos", exercises: [
    { name: "Hip Thrust", s: 4, r: "8-10", tip: "Pausa 2\" arriba.", mus: "Glúteo", img: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/watch?v=zsRrjH2z0N8" },
    { name: "Peso Muerto Rumano", s: 3, r: "10", tip: "Bajada lenta.", mus: "Isquios", img: "https://images.unsplash.com/photo-1613210915490-b0c0e1f30e4f?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/watch?v=jEy_czNkF2o" },
    { name: "Sentadilla Búlgara", s: 3, r: "12", tip: "Rodilla atrás.", mus: "Glúteo", img: "https://images.unsplash.com/photo-1535544546519-1563b80b5e4e?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/watch?v=2z7xSJUzVII" }
  ]},
  { id: 102, title: "DÍA 2: Glúteo Volumen", focus: "Hipertrofia", warmupType: "warmupLower", exercises: [
    { name: "Sentadilla", s: 4, r: "10-12", tip: "Profundidad máxima.", mus: "Glúteo", img: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/watch?v=yjhz0VwpJ8E" },
    { name: "Prensa Pierna", s: 3, r: "12-15", tip: "Rango completo.", mus: "Glúteo", img: "https://images.unsplash.com/photo-1600673748286-d24e97f884f7?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/watch?v=0q-FGrPCEf8" },
    { name: "Máquina Glúteo", s: 3, r: "15", tip: "Contracción máxima.", mus: "Glúteo", img: "https://images.unsplash.com/photo-1608805755822-13715af581f7?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/watch?v=gvdJHG9DL58" }
  ]},
  { id: 103, title: "DÍA 3: Postura & Core", focus: "Estabilidad", warmupType: "warmupUpper", exercises: [
    { name: "Remo a Peso", s: 3, r: "10-12", tip: "Retrae escápula.", mus: "Espalda", img: "https://images.unsplash.com/photo-1525338419e00-a06b8ecf7a90?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/watch?v=4L9N_AvdZMA" },
    { name: "Dead Bug", s: 3, r: "12", tip: "Abdomen contraído.", mus: "Core", img: "https://images.unsplash.com/photo-1608805755619-8d716c7ab49f?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/watch?v=JB2oyqG50KI" },
    { name: "Face Pulls", s: 3, r: "15", tip: "Squeeze posterior.", mus: "Hombro", img: "https://images.unsplash.com/photo-1609899753861-25c1a3a74324?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/watch?v=rep-qVOkqgk" }
  ]},
  { id: 104, title: "DÍA 4: Glúteo Densidad", focus: "Fuerza Relativa", warmupType: "warmupAthlos", exercises: [
    { name: "Peso Muerto Clásico", s: 3, r: "5-6", tip: "Carga máxima.", mus: "Glúteo", img: "https://images.unsplash.com/photo-1574680178050-55c6a6a96e0a?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/watch?v=op9kVnSso6Q" },
    { name: "Step Up Pesado", s: 3, r: "6-8", tip: "Impulsa arriba.", mus: "Glúteo", img: "https://images.unsplash.com/photo-1595910519046-61622f7a19cd?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/watch?v=lqKZZuApVI0" },
    { name: "Puente Cadera", s: 3, r: "15", tip: "Pausa 1\" arriba.", mus: "Glúteo", img: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/watch?v=wPM8ic32RhI" }
  ]}
];

const INITIAL_DB = {
  entrenador: { username: "coach", password: "$2b$12$MFuiss47HBbRuRps4n93/OKIzXuSnSx2avidp0c4ZER.dmRP7dtJm", name: "Coach Jhon", color: "from-zinc-800 to-zinc-900", subtitle: "Panel de Control", advice: "Calidad técnica.", logs: {}, notes: [], templates: [{ id: "tmpl_tamara", name: "Plantilla Tamara", days: RUTINA_TAMARA_OFICIAL }], workoutData: { days: [] } },
  tamara: { username: "tamara", password: "$2b$12$MFuiss47HBbRuRps4n93/OKIzXuSnSx2avidp0c4ZER.dmRP7dtJm", name: "Tamara", color: "from-blue-600 to-indigo-500", subtitle: "Glúteo & Postura", advice: "Estira cada hora.", logs: {}, notes: [], workoutData: { days: RUTINA_TAMARA_OFICIAL } },
  pivon: { username: "pivon", password: "$2b$12$MFuiss47HBbRuRps4n93/OKIzXuSnSx2avidp0c4ZER.dmRP7dtJm", name: "Novia Pivón", color: "from-pink-500 to-rose-400", subtitle: "Glúteos de acero y espalda sana", advice: "Técnica perfecta por tu escoliosis.", logs: {}, notes: [], workoutData: { days: [
    { id: 201, title: "Día 1: Glúteos e Isquios", focus: "Fuerza", warmupType: "warmupLower", isCircuit: false, exercises: [
      { name: "Hip Thrust", s: 4, r: "6-8", tip: "Bajada 3s.", mus: "Glúteo", img: "https://images.unsplash.com/photo-1590239926044-23927693630f?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=tecnica+hip+thrust" },
      { name: "Peso Muerto Rumano", s: 3, r: "10-12", tip: "Barra pegada.", mus: "Isquios", img: "https://images.unsplash.com/photo-1594737625785-a2bad9931c60?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=peso+muerto+rumano" },
      { name: "Abducción en Polea", s: 3, r: "15", tip: "Torso inclinado.", mus: "Glúteo", img: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=abduccion+polea" },
      { name: "Curl Femoral", s: 3, r: "12", tip: "Espalda estable.", mus: "Isquios", img: "https://images.unsplash.com/photo-1591940742878-13aba4b7a35e?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=curl+femoral" }
    ]},
    { id: 202, title: "Día 2: Espalda y Core", focus: "Postura", warmupType: "warmupUpper", isCircuit: false, exercises: [
      { name: "Jalón Pecho Neutro", s: 3, r: "6-8", tip: "Hacia ombligo.", mus: "Dorsal", img: "https://images.unsplash.com/photo-1591940742878-13aba4b7a35e?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=jalon+pecho+neutro" },
      { name: "Remo Polea Baja", s: 3, r: "12", tip: "Control escapular.", mus: "Espalda", img: "https://images.unsplash.com/photo-1605296867304-46d5465a13f1?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=remo+polea+baja" },
      { name: "Facepulls", s: 3, r: "15", tip: "Salud hombro.", mus: "Hombro", img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=facepull+polea" },
      { name: "Deadbug", s: 3, r: "1 min", tip: "Lumbar al suelo.", mus: "Core", img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=deadbug" }
    ]},
    { id: 203, title: "Día 3: Glúteo Unilateral", focus: "Hipertrofia", warmupType: "warmupLower", isCircuit: false, exercises: [
      { name: "Zancada Búlgara", s: 3, r: "10", tip: "Torso adelante.", mus: "Glúteo", img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=zancada+bulgara" },
      { name: "Prensa (Pies altos)", s: 3, r: "12", tip: "Con talones.", mus: "Piernas", img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=prensa+pies+altos" },
      { name: "Extensión Cuádriceps", s: 3, r: "10 Fallo", tip: "Stop arriba.", mus: "Cuádriceps", img: "https://images.unsplash.com/photo-1574673139055-520448d31705?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=extension+cuadriceps" },
      { name: "Step-Up (Cajón)", s: 3, r: "10", tip: "Sin impulso.", mus: "Glúteo", img: "https://images.unsplash.com/photo-1597452485669-2c7bb5fef90d?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=step+up+gluteo" },
      { name: "Patada Glúteo Polea", s: 3, r: "15", tip: "Bombeo final.", mus: "Glúteo", img: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=patada+gluteo" }
    ]},
    { id: 204, title: "Día 4: Tren Superior", focus: "Estabilidad", warmupType: "warmupUpper", isCircuit: false, exercises: [
      { name: "Press Militar Sentado", s: 3, r: "12", tip: "Espalda neutra.", mus: "Hombros", img: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=press+militar+sentado" },
      { name: "Press Pecho Máquina", s: 3, r: "12", tip: "Control total.", mus: "Pecho", img: "https://images.unsplash.com/photo-1605296867304-46d5465a13f1?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=press+pecho+maquina" },
      { name: "Monster Walk", s: 3, r: "20", tip: "Con banda.", mus: "Glúteo", img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=monster+walk" }
    ]}
  ]} },
  sebas: { username: "sebas", password: "$2b$12$TCfcu2SZmVZKwRsqJl5rx.UTqoNSbFMQw86DYvi2TzKIN8xYuRPgC", name: "Sebas Coach", color: "from-blue-600 to-indigo-500", subtitle: "Nuevo Plan", advice: "A darlo todo.", logs: {}, notes: [], workoutData: { days: [
    { id: 11, title: "LUNES: PUSH", focus: "Pectoral Superior + Tríceps", warmupType: "warmupUpper", isCircuit: false, exercises: [
      { name: "Press Inclinado Mancuernas", s: 3, r: "8-10", tip: "RIR 1. Más seguro para el hombro.", mus: "Pecho Sup", img: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=press+inclinado+mancuernas+tecnica" },
      { name: "Press Pecho Máquina Convergente", s: 3, r: "10-12", tip: "RIR 0 en la última serie.", mus: "Pecho", img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=press+maquina+convergente+pecho" },
      { name: "Cruce Poleas (Abajo-Arriba)", s: 3, r: "15", tip: "Clave para 'cerrar' el pecho por arriba.", mus: "Pecho Sup", img: "https://images.unsplash.com/photo-1590239926044-23927693630f?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=cruce+poleas+ascendente" },
      { name: "Extensiones Tríceps Polea", s: 3, r: "12-15", tip: "Cuerda. Superserie con fondos.", mus: "Tríceps", img: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=extensiones+triceps+polea+cuerda" }
    ]},
    { id: 12, title: "MARTES: PULL", focus: "Espalda + Bíceps", warmupType: "warmupUpper", isCircuit: false, exercises: [
      { name: "Dominadas", s: 3, r: "Fallo", tip: "RIR 1. Controla el descenso.", mus: "Espalda", img: "https://images.unsplash.com/photo-1598971639058-aba3c72e9c73?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=tecnica+dominadas+espalda" },
      { name: "Remo Polea Baja (Neutro)", s: 3, r: "10", tip: "Aprieta escápulas al final.", mus: "Espalda Media", img: "https://images.unsplash.com/photo-1605296867304-46d5465a13f1?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=remo+polea+baja+neutro" },
      { name: "Pull-over Polea Alta", s: 3, r: "15", tip: "Cuerda. Máximo estiramiento.", mus: "Dorsal", img: "https://images.unsplash.com/photo-1591940742878-13aba4b7a35e?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=pullover+polea+alta+cuerda" },
      { name: "Facepulls", s: 3, r: "20", tip: "Crucial para postura y hombro.", mus: "Hombro Post", img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=facepull+tecnica" },
      { name: "Curl Barra Z", s: 3, r: "12", tip: "Sin balanceos.", mus: "Bíceps", img: "https://images.unsplash.com/photo-1590239926044-23927693630f?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=curl+barra+z" }
    ]},
    { id: 13, title: "MIÉRCOLES: LEGS", focus: "Pierna Completa", warmupType: "warmupLower", isCircuit: false, exercises: [
      { name: "Prensa de Piernas", s: 4, r: "12-15", tip: "Dropset al fallo en la última.", mus: "Piernas", img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=prensa+piernas+tecnica" },
      { name: "Extensiones Cuádriceps", s: 3, r: "10+10", tip: "10 lentas + 10 explosivas.", mus: "Cuádriceps", img: "https://images.unsplash.com/photo-1574673139055-520448d31705?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=extensiones+cuadriceps" },
      { name: "Curl Femoral Sentado", s: 3, r: "12", tip: "Aguanta 2s contracción.", mus: "Isquios", img: "https://images.unsplash.com/photo-1591940742878-13aba4b7a35e?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=curl+femoral+sentado" },
      { name: "Gemelo en Prensa", s: 4, r: "15", tip: "Estira 2s abajo.", mus: "Gemelos", img: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=gemelo+prensa" }
    ]},
    { id: 14, title: "JUEVES: PUSH B", focus: "Hombro + Pecho Sup", warmupType: "warmupUpper", isCircuit: false, exercises: [
      { name: "Press Militar Mancuernas", s: 3, r: "8-10", tip: "Sentado, espalda apoyada.", mus: "Hombros", img: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=press+militar+sentado+mancuernas" },
      { name: "Elevaciones Laterales Polea", s: 4, r: "15", tip: "Brazo por detrás de espalda.", mus: "Hombro Lat", img: "https://images.unsplash.com/photo-1590239926044-23927693630f?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=elevaciones+laterales+polea+detras" },
      { name: "Press Inclinado Multipower", s: 3, r: "12", tip: "Controla la bajada lenta.", mus: "Pecho Sup", img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=press+inclinado+multipower" },
      { name: "Cruces en Polea Media", s: 3, r: "15", tip: "Máximo bombeo.", mus: "Pecho", img: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=cruce+poleas+pecho+medio" }
    ]},
    { id: 15, title: "VIERNES: PULL B", focus: "Espalda + Abdomen", warmupType: "warmupUpper", isCircuit: false, exercises: [
      { name: "Jalón al Pecho", s: 3, r: "10-12", tip: "Agarre ancho.", mus: "Dorsales", img: "https://images.unsplash.com/photo-1591940742878-13aba4b7a35e?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=jalon+al+pecho+ancho" },
      { name: "Remo Mancuerna", s: 3, r: "12", tip: "A una mano.", mus: "Espalda", img: "https://images.unsplash.com/photo-1605296867304-46d5465a13f1?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=remo+mancuerna+una+mano" },
      { name: "Remo al Cuello Polea", s: 3, r: "15", tip: "Agarre ancho.", mus: "Hombro", img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=remo+al+cuello+polea+ancho" },
      { name: "Rueda Abdominal", s: 4, r: "Fallo", tip: "Control lumbar.", mus: "Abdomen", img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=rueda+abdominal+tecnica" }
    ]}
  ]} },
  sebas2: { username: "sebas2", password: "$2b$12$MFuiss47HBbRuRps4n93/OKIzXuSnSx2avidp0c4ZER.dmRP7dtJm", name: "Sebas 2", color: "from-cyan-600 to-blue-500", subtitle: "Strength", advice: "Sé consistente.", logs: {}, notes: [], workoutData: { days: [
    { id: 404, title: "Lower Strength", focus: "Fuerza", warmupType: "warmupLower", exercises: [
      { name: "Sentadilla Pesada", s: 5, r: "5", tip: "Máxima carga.", mus: "Glúteo", img: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/watch?v=yjhz0VwpJ8E" },
      { name: "Peso Muerto", s: 3, r: "5", tip: "Carga máxima.", mus: "Espalda", img: "https://images.unsplash.com/photo-1574680178050-55c6a6a96e0a?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/watch?v=op9kVnSso6Q" }
    ]}
  ]} },
  claudia: { username: "claudia", password: "$2b$12$MFuiss47HBbRuRps4n93/OKIzXuSnSx2avidp0c4ZER.dmRP7dtJm", name: "Claudia", color: "from-rose-600 to-pink-500", subtitle: "Nuevo Plan", advice: "Dale todo.", logs: {}, notes: [], workoutData: { days: [
    { id: 405, title: "Cardio & Core", focus: "Resistencia", warmupType: "warmupAthlos", exercises: [
      { name: "Burpees", s: 3, r: "15", tip: "Ritmo constante.", mus: "Full Body", img: "https://images.unsplash.com/photo-1517836357463-d25ddfcbf042?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/watch?v=vcorNYUfH30" },
      { name: "Plancha", s: 3, r: "45s", tip: "Cuerpo recto.", mus: "Core", img: "https://images.unsplash.com/photo-1608805755619-8d716c7ab49f?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/watch?v=JB2oyqG50KI" }
    ]}
  ]} },
  blanca: { username: "blanca", password: "$2b$12$MFuiss47HBbRuRps4n93/OKIzXuSnSx2avidp0c4ZER.dmRP7dtJm", name: "Blanca Aguero", color: "from-purple-600 to-pink-500", subtitle: "PLAN DE ENTRENAMIENTO - BLANCA AGUERO (V2)", advice: "Respiración: No bloquees aire. Exhala al subir. Hombro: Sube sin dolor. Explosividad: Bajada controlada, subida rápida. Seguridad: Cerca de pared o silla. Calidad: Si dobla la espalda, serie termina.", logs: {}, notes: [], workoutData: { days: [
    { id: 501, title: "CALENTAMIENTO Y MOVILIDAD", focus: "Preparación (10 min)", warmupType: "warmupAthlos", exercises: [
      { name: "Cat-Cow", s: 1, r: "10", tip: "Lentas. Movilidad columna", mus: "Movilidad", img: "https://images.unsplash.com/photo-1544367567-0d5fccc6678d?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60", yt: "https://www.youtube.com/results?search_query=cat+cow" },
      { name: "Retracción Escapular", s: 1, r: "12", tip: "Juntar hombros atrás y abajo", mus: "Hombros", img: "https://images.unsplash.com/photo-1549576528-b0f2f33aafc5?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=retraccion+escapular" },
      { name: "Glute Bridge", s: 2, r: "12", tip: "Activar glúteos para proteger lumbar", mus: "Glúteo", img: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=glute+bridge" },
      { name: "Movilidad de Hombro", s: 1, r: "15", tip: "Círculos suaves adelante/atrás", mus: "Hombros", img: "https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=movilidad+hombro" }
    ]},
    { id: 502, title: "TABLA FULL BODY - FUERZA Y PROTECCION (DIA 1-2)", focus: "Salud, Masa Muscular y Espalda Protegida", warmupType: "warmupAthlos", exercises: [
      { name: "Sentadilla Normal", s: 3, r: "10-12", tip: "Bajar lento, pausa 1s abajo, subida explosiva", mus: "Piernas", img: "https://images.unsplash.com/photo-1595078519480-bc102f8aa565?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=sentadilla+tecnica" },
      { name: "Remo con goma", s: 3, r: "12", tip: "Codos pegados. Aprieta espalda", mus: "Espalda", img: "https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=remo+banda" },
      { name: "Floor Press (Suelo)", s: 3, r: "10-12", tip: "Mancuernas. Codos tocan suelo y suben", mus: "Pecho", img: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=floor+press" },
      { name: "P. Muerto Rumano", s: 3, r: "10", tip: "Bisagra de cadera. Espalda recta", mus: "Isquios", img: "https://images.unsplash.com/photo-1633626773746-25284de532af?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=peso+muerto+rumano" },
      { name: "Abducción Hombro", s: 3, r: "12", tip: "Codo 90 grados. Eleva hasta hombro", mus: "Hombros", img: "https://images.unsplash.com/photo-1590239926044-23927693630f?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=abduccion+hombro" },
      { name: "Deadbug (Bicho)", s: 3, r: "45s", tip: "Abdomen duro. Espalda baja al suelo", mus: "Core", img: "https://images.unsplash.com/photo-1608805755619-8d716c7ab49f?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=deadbug" }
    ]},
    { id: 503, title: "TABLA ALT - HIPERTROFIA Y ESTABILIDAD (DIA 3)", focus: "Complementario", warmupType: "warmupAthlos", exercises: [
      { name: "Hip Thrust", s: 3, r: "12", tip: "Pausa 1s arriba. Glúteo máximo", mus: "Glúteo", img: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=hip+thrust" },
      { name: "Remo Polea Baja", s: 3, r: "12", tip: "Contrae escápulas atrás", mus: "Espalda", img: "https://images.unsplash.com/photo-1605296867304-46d5465a13f1?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=remo+polea" },
      { name: "Flexiones", s: 3, r: "8-10", tip: "Cuerpo recto. Control", mus: "Pecho", img: "https://images.unsplash.com/photo-1608805622529-4f3cec3d7c5a?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=flexiones+perfectas" },
      { name: "Extensión Cuádriceps", s: 3, r: "12", tip: "Pausa en contracción", mus: "Cuádriceps", img: "https://images.unsplash.com/photo-1584735175097-24340077ad18?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=extension+cuadriceps" },
      { name: "Face Pulls", s: 3, r: "15", tip: "Salud hombro. Squeeze posterior", mus: "Hombros", img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=face+pulls" },
      { name: "Plank (Plancha)", s: 3, r: "45s", tip: "Cuerpo recto. Glúteo contraído", mus: "Core", img: "https://images.unsplash.com/photo-1608805755619-8d716c7ab49f?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/results?search_query=plank" }
    ]}
  ]} }
};

const warmupData = {
  warmupLower: { 
    title: "Calentamiento Inferior", 
    description: "Preparación para piernas, glúteos e isquios",
    steps: [
      { name: "Círculos de cadera", detail: "15 por cada lado" },
      { name: "Sentadilla sin peso", detail: "10 reps lentas" },
      { name: "Estiramiento de cuádriceps", detail: "20s por pierna" },
      { name: "Puente de glúteo", detail: "10 reps (activación)" },
      { name: "Zancada con giro", detail: "8 por lado" }
    ] 
  },
  warmupUpper: { 
    title: "Calentamiento Superior", 
    description: "Preparación para pecho, espalda, hombros y brazos",
    steps: [
      { name: "Rotaciones de hombro", detail: "10 por cada lado" },
      { name: "Retracción escapular", detail: "12 reps" },
      { name: "Círculos de muñeca", detail: "10 por lado" },
      { name: "Band pull-apart / Abrir brazos", detail: "12 reps" },
      { name: "Flexiones en pared", detail: "10 reps (activación)" }
    ] 
  },
  warmupAthlos: { 
    title: "Calentamiento Athlos", 
    description: "Calentamiento completo full-body con movilidad y core",
    steps: [
      { name: "Hip Flow (Movilidad cadera)", detail: "10 reps" },
      { name: "Cat-Cow (Gato-Camello)", detail: "10 reps lentas" },
      { name: "Sentadillas sin peso", detail: "15 reps" },
      { name: "Bird-Dog", detail: "8 por lado" },
      { name: "Rotaciones torácicas", detail: "8 por lado" },
      { name: "Jumping Jacks o Skip", detail: "30 segundos" }
    ] 
  }
};

// ==========================================
// COMPONENTES DE INTERFAZ
// ==========================================

const PlateDisplay = ({ weight }) => {
  const target = parseFloat(weight) || 0;
  if (target < 20) return <p className="text-[10px] text-zinc-500 mt-2 font-bold text-center italic">Mancuerna / Máquina</p>;
  const calculatePlates = (w) => {
    let side = (w - 20) / 2;
    let res = [];
    for (let p of [25, 20, 15, 10, 5, 2.5, 1.25]) { while (side >= p) { res.push(p); side = Math.round((side - p) * 100) / 100; } }
    return res;
  };
  const plates = calculatePlates(target);
  const colors = { 25: 'bg-red-500 text-white', 20: 'bg-blue-600 text-white', 15: 'bg-yellow-500 text-black', 10: 'bg-green-600 text-white', 5: 'bg-gray-100 text-black border', 2.5: 'bg-gray-800 text-white', 1.25: 'bg-zinc-400 text-black' };
  if (plates.length === 0) return <p className="text-[10px] text-zinc-500 mt-2 font-bold text-center">Barra olímpica (20kg)</p>;
  return (
    <div className="mt-3 bg-zinc-50 rounded-xl p-3 border border-zinc-100 flex flex-col items-center">
      <p className="text-[9px] font-black uppercase text-zinc-400 mb-2">Discos por lado (Barra 20kg)</p>
      <div className="flex items-center justify-center gap-0.5">
        <div className="w-10 h-1.5 bg-zinc-300 rounded-l-full" /><div className="w-1.5 h-3 bg-zinc-400 rounded-sm" />
        {plates.map((p, i) => <div key={i} className={`flex items-center justify-center font-black text-[8px] w-4 ${p >= 15 ? 'h-10' : 'h-7'} rounded-sm shadow-sm ${colors[p]}`}>{p}</div>)}
      </div>
    </div>
  );
};

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400';
const imgError = (e) => { e.target.src = FALLBACK_IMG; };

const MiniProgressChart = memo(({ data, color, isAdmin, mode, exSets }) => {
  const safeData = Array.isArray(data) ? data : [];
  if (safeData.length < 2) return null;
  const getVal = (d) => {
    const w = parseFloat(d.weight) || 0;
    return mode === 'volume' ? w * (parseInt(d.reps) || 10) * (parseInt(exSets) || 3) : w;
  };
  const vals = safeData.map(getVal).reverse();
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const range = max - min || 10;
  const points = vals.map((v, i) => `${(i / (vals.length - 1)) * 100},${100 - ((v - (min - (range * 0.1))) / (range * 1.2)) * 100}`).join(" ");
  const strokeColor = isAdmin ? "#fbbf24" : String(color || "").includes("blue") ? "#3b82f6" : "#10b981";
  return (
    <div className="w-full h-16 mt-4 opacity-80">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full"><polyline fill="none" stroke={strokeColor} strokeWidth="3" points={points} /></svg>
    </div>
  );
});

const ProgressBar = ({ label, current, previous, color = "#f59e0b" }) => {
  const maxVal = Math.max(current, previous, 1);
  const currentPercent = (current / maxVal) * 100;
  const prevPercent = (previous / maxVal) * 100;
  const change = previous ? (((current - previous) / previous) * 100).toFixed(1) : 0;
  const isGain = change > 0;
  
  return (
    <div className="space-y-4 mb-4">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-black text-white uppercase">{label}</span>
        <span className={`text-[9px] font-bold ${isGain ? 'text-green-500' : 'text-red-500'}`}>
          {isGain ? '↑' : '↓'} {Math.abs(change)}%
        </span>
      </div>
      <div className="relative h-6 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
        <div style={{ width: `${prevPercent}%` }} className="absolute h-full bg-zinc-600 opacity-40"></div>
        <div style={{ width: `${currentPercent}%`, backgroundColor: color }} className="absolute h-full transition-all"></div>
        <div className="relative h-full flex items-center px-2">
          <span className="text-white text-[9px] font-black">{current}kg</span>
        </div>
      </div>
    </div>
  );
};

const GlobalRestTimer = ({ initialSeconds, onCancel }) => {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);
  const m = Math.floor(timeLeft / 60); const s = timeLeft % 60;
  return (
    <div className="sticky top-2 z-50 flex justify-center pointer-events-none mb-4">
      <div className={`pointer-events-auto shadow-2xl flex items-center gap-3 px-6 py-3 rounded-full font-black text-sm transition-all transform scale-110 border-2 border-white ${timeLeft > 0 ? 'bg-orange-500 text-white animate-pulse' : 'bg-green-500 text-white'}`}>
        <Clock size={18} /> 
        <span>{timeLeft > 0 ? `DESCANSO: ${m}:${s.toString().padStart(2, '0')}` : "¡A POR OTRA! 🔥"}</span>
        <button onClick={onCancel} className="ml-2 bg-black/10 hover:bg-black/20 rounded-full p-1"><X size={14} /></button>
      </div>
    </div>
  );
};

const getTargetReps = (repString) => {
  const match = repString.toString().match(/\d+/g);
  if (!match) return 10;
  if (match.length > 1) return Math.floor((parseInt(match[0]) + parseInt(match[1])) / 2);
  return parseInt(match[0]);
};

const calculate1RM = (weight, reps) => {
  const w = parseFloat(weight);
  if (isNaN(w)) return 0;
  return w * (1 + (parseInt(reps) || 1) / 30);
};

// Date format helpers (dd/mm/yy with backward compat for dd/mm)
const formatDateLog = (d = new Date()) => {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
};
const parseDateLog = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('/').map(Number);
  if (parts.length === 3) return new Date(2000 + parts[2], parts[1] - 1, parts[0]);
  if (parts.length === 2) return new Date(new Date().getFullYear(), parts[1] - 1, parts[0]);
  return null;
};
const isSameDayStr = (logDate, refDate) => {
  if (!logDate) return false;
  const ref = formatDateLog(refDate);
  if (logDate === ref) return true;
  // Backward compat: dd/mm matches dd/mm/yy if same day/month
  if (logDate.length <= 5) return ref.startsWith(logDate);
  return false;
};

// Helper: check if a workout day has logs from today
const isDayCompletedToday = (day, workoutLogs) => {
  const today = new Date();
  const exercises = Array.isArray(day.exercises) ? day.exercises : [];
  return exercises.some(ex => {
    const logs = Array.isArray(workoutLogs[ex.name]) ? workoutLogs[ex.name] : [];
    return logs.some(l => isSameDayStr(l.date, today));
  });
};

// Helper: calculate consecutive training days (streak)
const calculateStreak = (workoutLogs) => {
  const allDates = new Set();
  Object.values(workoutLogs).forEach(logs => {
    if (!Array.isArray(logs)) return;
    logs.forEach(l => {
      if (!l.date) return;
      // Normalize old dd/mm to dd/mm/yy for proper comparison
      const parsed = parseDateLog(l.date);
      if (parsed) allDates.add(formatDateLog(parsed));
    });
  });
  if (allDates.size === 0) return 0;
  let streak = 0;
  const check = new Date();
  for (let i = 0; i < 365; i++) {
    const dateStr = formatDateLog(check);
    if (allDates.has(dateStr)) { streak++; check.setDate(check.getDate() - 1); }
    else if (i === 0) { check.setDate(check.getDate() - 1); continue; }
    else break;
  }
  return streak;
};

// Helper: weekly summary stats
const getWeeklySummary = (workoutLogs) => {
  const now = new Date();
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);

  const prevMonday = new Date(monday);
  prevMonday.setDate(monday.getDate() - 7);

  let thisWeekDays = new Set();
  let thisWeekVolume = 0;
  let prevWeekDays = new Set();
  let prevWeekVolume = 0;
  let thisWeekSets = 0;

  Object.values(workoutLogs).forEach(logs => {
    if (!Array.isArray(logs)) return;
    logs.forEach(l => {
      if (!l.date) return;
      const logDate = parseDateLog(l.date);
      if (!logDate) return;

      const vol = (parseFloat(l.weight) || 0) * (parseInt(l.reps) || 0);
      if (logDate >= monday) {
        thisWeekDays.add(l.date);
        thisWeekVolume += vol;
        thisWeekSets++;
      } else if (logDate >= prevMonday && logDate < monday) {
        prevWeekDays.add(l.date);
        prevWeekVolume += vol;
      }
    });
  });

  const volumeChange = prevWeekVolume > 0 ? Math.round(((thisWeekVolume - prevWeekVolume) / prevWeekVolume) * 100) : 0;
  return { daysThisWeek: thisWeekDays.size, totalVolume: Math.round(thisWeekVolume), totalSets: thisWeekSets, volumeChange, prevWeekDays: prevWeekDays.size };
};

// Confetti effect component
const ConfettiEffect = ({ active, onDone }) => {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];
    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * -1,
      w: Math.random() * 8 + 4,
      h: Math.random() * 4 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 4 + 2,
      rot: Math.random() * 360,
      rotV: (Math.random() - 0.5) * 8,
      opacity: 1
    }));
    let frame = 0;
    const maxFrames = 180;
    const animate = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (frame > maxFrames) { onDone?.(); return; }
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.rot += p.rotV;
        if (frame > maxFrames * 0.6) p.opacity = Math.max(0, 1 - (frame - maxFrames * 0.6) / (maxFrames * 0.4));
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      requestAnimationFrame(animate);
    };
    animate();
  }, [active, onDone]);
  if (!active) return null;
  return <canvas ref={canvasRef} className="fixed inset-0 z-[100] pointer-events-none" />;
};

// Expanded stats chart with full history
const ExpandedChart = ({ logs, exName, exSets, mode, color, isAdmin, onClose }) => {
  const safeData = Array.isArray(logs) ? logs : [];
  if (safeData.length < 2) return null;
  const getVal = (d) => {
    const w = parseFloat(d.weight) || 0;
    return mode === 'volume' ? w * (parseInt(d.reps) || 10) * (parseInt(exSets) || 3) : w;
  };
  const vals = safeData.map(getVal).reverse();
  const dates = safeData.map(d => d.date || '').reverse();
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const range = max - min || 10;
  const padMin = min - range * 0.1;
  const padRange = range * 1.2;
  const points = vals.map((v, i) => `${(i / (vals.length - 1)) * 280 + 10},${180 - ((v - padMin) / padRange) * 160}`).join(" ");
  const strokeColor = isAdmin ? "#fbbf24" : String(color || "").includes("blue") ? "#3b82f6" : "#10b981";
  const areaPoints = `10,180 ${points} ${280 + 10},180`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-zinc-900 rounded-3xl border border-zinc-700 p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-white font-black text-base">{exName}</h3>
            <p className="text-zinc-500 text-[10px] font-bold uppercase">{mode === 'volume' ? 'Volumen total' : 'Peso máximo'} · {safeData.length} registros</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-1"><X size={18}/></button>
        </div>
        <svg viewBox="0 0 300 200" className="w-full" style={{ height: 200 }}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const y = 180 - pct * 160;
            const val = Math.round(padMin + pct * padRange);
            return <g key={i}><line x1="10" y1={y} x2="290" y2={y} stroke="#27272a" strokeWidth="0.5" /><text x="4" y={y + 3} fill="#71717a" fontSize="7" textAnchor="end">{val}</text></g>;
          })}
          {/* Area fill */}
          <polygon points={areaPoints} fill={strokeColor} fillOpacity="0.1" />
          {/* Line */}
          <polyline fill="none" stroke={strokeColor} strokeWidth="2" points={points} strokeLinecap="round" strokeLinejoin="round" />
          {/* Data points */}
          {vals.map((v, i) => {
            const x = (i / (vals.length - 1)) * 280 + 10;
            const y = 180 - ((v - padMin) / padRange) * 160;
            return <circle key={i} cx={x} cy={y} r="3" fill={strokeColor} stroke="#18181b" strokeWidth="1.5" />;
          })}
          {/* Date labels (show some) */}
          {dates.map((d, i) => {
            if (vals.length <= 6 || i % Math.ceil(vals.length / 6) === 0 || i === vals.length - 1) {
              const x = (i / (vals.length - 1)) * 280 + 10;
              return <text key={i} x={x} y="196" fill="#71717a" fontSize="6.5" textAnchor="middle">{d}</text>;
            }
            return null;
          })}
        </svg>
        <div className="flex justify-between mt-3 px-1">
          <div className="text-center">
            <p className="text-[9px] text-zinc-500 font-bold">MÍN</p>
            <p className="text-sm font-black text-white">{Math.round(min)}{mode === 'volume' ? '' : 'kg'}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-zinc-500 font-bold">MÁX</p>
            <p className="text-sm font-black" style={{ color: strokeColor }}>{Math.round(max)}{mode === 'volume' ? '' : 'kg'}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-zinc-500 font-bold">ÚLTIMO</p>
            <p className="text-sm font-black text-white">{Math.round(vals[vals.length - 1])}{mode === 'volume' ? '' : 'kg'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const ExerciseCard = memo(({ ex, workoutLogs, onAddLog, onDeleteLog, onStartTimer, isAdmin, onUpdateImage, onOpenImageManager, dayId, accentColor, onAddExerciseNote, exerciseNotes }) => {
  const [localW, setLocalW] = useState("");
  const [localR, setLocalR] = useState("");
  const [showCalc, setShowCalc] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const fileRef = useRef(null);

  const safeColor = String(accentColor || "from-blue-600 to-indigo-500");
  const bgAccent = isAdmin ? "bg-amber-500" : safeColor.includes("blue") ? "bg-blue-500" : safeColor.includes("emerald") ? "bg-emerald-500" : "bg-pink-500";
  const textAccent = isAdmin ? "text-amber-500" : safeColor.includes("blue") ? "text-blue-600" : safeColor.includes("emerald") ? "text-emerald-600" : "text-pink-600";

  const safeName = String(ex?.name || "");
  const safeMus = String(ex?.mus || "Fuerza");
  const safeS = String(ex?.s || "-");
  const safeR = String(ex?.r || "-");
  const safeTip = String(ex?.tip || "");

  const logsRaw = workoutLogs[safeName];
  const logs = Array.isArray(logsRaw) ? logsRaw : [];
  const maxW = logs.length > 0 ? Math.max(...logs.map(l => parseFloat(l.weight) || 0)) : 0;

  const targetRepsCalc = getTargetReps(safeR);
  let suggestedWeight = 0;
  if (logs.length > 0) {
    const max1RM = logs.reduce((max, log) => {
      const rm = calculate1RM(log.weight, log.reps || 10);
      return rm > max ? rm : max;
    }, 0);
    suggestedWeight = Math.round((max1RM / (1 + targetRepsCalc / 30)) * 2) / 2;
  }
  const weightToCalc = parseFloat(localW) || suggestedWeight || 0;

  const handleAdd = () => {
    // Solución del Botón Mágico '+'
    const weightToUse = localW !== "" ? localW : (suggestedWeight || (logs.length > 0 ? logs[0].weight : 10)); 
    const repsToUse = localR !== "" ? localR : (targetRepsCalc || 10);
    onAddLog(safeName, weightToUse, repsToUse);
    setLocalW(""); 
    setLocalR(""); 
    setShowCalc(false);
  };

  return (
    <div className={`${isAdmin ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-100"} rounded-[2.5rem] border shadow-sm overflow-hidden mb-6`}>
      <div className="relative h-52 bg-zinc-800 group">
        <img src={ex?.img || FALLBACK_IMG} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" onError={imgError} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent" />
        {isAdmin && <button onClick={() => onOpenImageManager ? onOpenImageManager(dayId, safeName) : fileRef.current.click()} className="absolute top-4 left-4 bg-black/60 p-2 rounded-xl text-white flex items-center gap-1"><Camera size={18} /><span className="text-[8px] font-bold">Modificar</span><input type="file" ref={fileRef} className="hidden" onChange={e => {
             const file = e.target.files[0];
             const reader = new FileReader();
             reader.onload = (ev) => onUpdateImage(dayId, safeName, ev.target.result);
             if(file) reader.readAsDataURL(file);
           }}/></button>}
        <div className="absolute bottom-4 left-6 text-white">
          <div className="flex items-center gap-2 mb-1">
             <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${bgAccent} ${isAdmin ? "text-black" : "text-white"} inline-block`}>{safeMus}</span>
             {maxW > 0 && <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold"><Trophy size={10} className="inline mb-0.5 text-amber-400"/> {maxW}kg</span>}
          </div>
          <h4 className="text-xl font-black pr-10 leading-tight">{safeName}</h4>
        </div>
        {ex.yt && <a href={ex.yt} target="_blank" rel="noreferrer" className="absolute top-4 right-4 bg-white/20 p-3 rounded-2xl text-white hover:bg-red-500 transition-colors"><Youtube size={22} /></a>}
      </div>
      <div className="p-6">
        <div className="grid grid-cols-2 gap-3 mb-8 text-center">
          <div className={`${isAdmin ? 'bg-zinc-800' : 'bg-gray-50'} p-3 rounded-2xl`}><p className={`text-[9px] font-bold uppercase ${isAdmin ? 'text-zinc-400' : 'text-gray-400'}`}>Series</p><p className={`text-xl font-black ${textAccent}`}>{safeS}</p></div>
          <div className={`${isAdmin ? 'bg-zinc-800' : 'bg-gray-50'} p-3 rounded-2xl`}><p className={`text-[9px] font-bold uppercase ${isAdmin ? 'text-zinc-400' : 'text-gray-400'}`}>Reps</p><p className={`text-xl font-black ${textAccent}`}>{safeR}</p></div>
        </div>
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h5 className={`text-[10px] font-black uppercase tracking-widest ${isAdmin ? 'text-zinc-500' : 'text-gray-400'} flex items-center gap-2`}><History size={14} /> Historial</h5>
            <div className="flex gap-2">
               <button onClick={() => onStartTimer(45)} className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg border transition-all active:scale-90 ${isAdmin ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-orange-50 text-orange-600 border-orange-100"}`}>45s</button>
               <button onClick={() => onStartTimer(60)} className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg border transition-all active:scale-90 ${isAdmin ? "bg-amber-500 text-black border-amber-600" : "bg-orange-100 text-orange-700 border-orange-200"}`}>60s</button>
            </div>
          </div>
          {suggestedWeight > 0 && (
            <div className={`flex items-center gap-2 text-[10px] font-bold p-2 rounded-xl border ${isAdmin ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-indigo-50 text-indigo-600 border-indigo-100"}`}>
              <Brain size={14} className="shrink-0" />
              <span>Sugerencia: <strong>{suggestedWeight}kg</strong> (RM x {targetRepsCalc})</span>
            </div>
          )}
          <div className="flex flex-col gap-2">
            {logs.slice(0, 3).map(l => (
              <div key={String(l.id)} className={`flex justify-between items-center p-2 rounded-xl border animate-in zoom-in ${isAdmin ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-100'}`}>
                <span className={`text-xs font-bold ${textAccent}`}>{String(l.weight)}kg x {String(l.reps)}</span>
                <div className="flex items-center gap-3"><span className={`text-[9px] ${isAdmin ? 'text-zinc-500' : 'text-zinc-400'}`}>{String(l.date)}</span><button onClick={() => { if(window.confirm('¿Borrar esta serie?')) onDeleteLog(safeName, l.id); }} className="text-red-400 opacity-60 hover:opacity-100"><Trash2 size={12}/></button></div>
              </div>
            ))}
          </div>

          {/* NOTAS DE LA MÁQUINA */}
          <div className="pt-4">
            <button onClick={() => setShowNotes(!showNotes)} className={`w-full flex items-center justify-between p-3 rounded-xl border text-[10px] font-black uppercase transition-all ${showNotes ? (isAdmin ? "bg-amber-500/20 border-amber-500/30 text-amber-500" : "bg-blue-50 border-blue-200 text-blue-600") : (isAdmin ? "bg-zinc-800/50 border-zinc-700 text-zinc-400" : "bg-gray-50 border-gray-100 text-gray-400")}`}>
              <div className="flex items-center gap-2"><MessageSquareHeart size={14}/> Notas Máquina</div>
              {(Array.isArray(exerciseNotes) ? exerciseNotes : []).length > 0 && <span className="bg-amber-500 text-black px-2 py-0.5 rounded-full text-[8px] font-bold">{(Array.isArray(exerciseNotes) ? exerciseNotes : []).length}</span>}
            </button>
            {showNotes && (
              <div className={`mt-2 p-4 rounded-xl border space-y-4 animate-in slide-in-from-top-4 ${isAdmin ? "bg-zinc-800/50 border-zinc-700" : "bg-gray-50 border-gray-100"}`}>
                <div className="flex gap-2">
                  <input type="text" placeholder="Altura máquina, ajustes..." className={`flex-1 p-2 rounded-lg text-xs outline-none ${isAdmin ? "bg-zinc-900 border-zinc-700 text-white" : "bg-white border-gray-200 text-gray-900"} border`} maxLength="100" value={noteInput} onChange={e => setNoteInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (noteInput.trim() && (onAddExerciseNote(safeName, noteInput), setNoteInput("")))} />
                  <button onClick={() => { if(noteInput.trim()) { onAddExerciseNote(safeName, noteInput); setNoteInput(""); } }} className={`px-3 rounded-lg font-bold text-[9px] ${isAdmin ? "bg-amber-500 text-black" : "bg-blue-500 text-white"}`}>+</button>
                </div>
                <div className="space-y-1">
                  {(Array.isArray(exerciseNotes) ? exerciseNotes : []).slice(0, 5).map((note, i) => (
                    <div key={i} className={`flex justify-between items-start p-2 rounded-lg text-[9px] ${isAdmin ? "bg-zinc-900/50" : "bg-white"}`}>
                      <span className={isAdmin ? "text-zinc-300" : "text-gray-700"}>{String((note.text || "")).slice(0, 100)}</span>
                      <span className={`text-[8px] ${isAdmin ? "text-zinc-500" : "text-gray-400"}`}>{String(note.date || "")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-6">
            <input type="number" placeholder={suggestedWeight > 0 ? `${suggestedWeight}kg` : logs.length > 0 ? `${logs[0].weight}kg` : "Kg..."} className={`flex-1 min-w-0 border rounded-xl p-3 text-sm font-bold outline-none ${isAdmin ? "bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" : "bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"}`} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} value={localW} onChange={e => setLocalW(e.target.value)} />
            <input type="number" placeholder={logs.length > 0 ? String(logs[0].reps) : "Reps"} className={`w-16 shrink-0 border rounded-xl p-3 text-sm font-bold text-center outline-none ${isAdmin ? "bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" : "bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"}`} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} value={localR} onChange={e => setLocalR(e.target.value)} />
            <button onClick={() => setShowCalc(!showCalc)} className={`px-3 shrink-0 rounded-xl transition-all shadow-md border ${isAdmin ? (showCalc ? "bg-amber-500 text-black border-amber-500" : "bg-zinc-800 text-zinc-400 border-zinc-700") : (showCalc ? "bg-blue-500 text-white border-blue-500" : "bg-white text-gray-400 border-gray-200")}`}><Calculator size={20}/></button>
            <button onClick={handleAdd} className={`px-4 shrink-0 rounded-xl transition-all active:scale-95 shadow-md ${isAdmin ? "bg-amber-500 text-black" : "bg-gray-900 text-white"}`}><PlusCircle size={20}/></button>
          </div>
          {showCalc && <PlateDisplay weight={weightToCalc} />}
        </div>
        {safeTip && (
          <div className={`mx-6 mb-6 p-4 rounded-2xl border flex gap-3 ${isAdmin ? "bg-amber-500/10 border-amber-500/20" : "bg-blue-50 border-blue-100"}`}>
            <Info size={16} className={`${textAccent} shrink-0 mt-0.5`} /><p className={`text-xs italic leading-relaxed ${isAdmin ? 'text-zinc-400' : 'text-gray-700'}`}>"{safeTip}"</p>
          </div>
        )}
      </div>
    </div>
  );
});

// ==========================================
// COMPONENTE APP
// ==========================================
export default function App() {
  const [db, setDb] = useState(() => safeJSONParse("athlos_coach_db_final", INITIAL_DB));
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isForceReloading, setIsForceReloading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const [loggedInUser, setLoggedInUser] = useState(null);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [loginLockedUntil, setLoginLockedUntil] = useState(null);
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);

  // NEW: Color palette and motivational phrases
  const [preferredPaletteId, setPreferredPaletteId] = useState('premium-dark');
  const [dailyMotivationalPhrase, setDailyMotivationalPhrase] = useState('La consistencia es la clave del éxito 💪');
  const [allMotivationalPhrases, setAllMotivationalPhrases] = useState([]);
  const { toasts, showSuccess, showError } = useToast();

  const [activeTab, setActiveTab] = useState("home");
  const [currentClientId, setCurrentClientId] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [sessionStart, setSessionStart] = useState(() => {
    const saved = sessionStorage.getItem('athlos_session_start');
    return saved ? parseInt(saved) : null;
  });
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [exitAttemptTime, setExitAttemptTime] = useState(null);
  
  const [targetDayId, setTargetDayId] = useState("");
  const [editingClientId, setEditingClientId] = useState(null);
  const [editingDayId, setEditingDayId] = useState(null);
  const [draggedDayId, setDraggedDayId] = useState(null);
  const [dragOverDayId, setDragOverDayId] = useState(null);
  const [touchDragState, setTouchDragState] = useState(null);
  const touchTimerRef = useRef(null);
  const [selectedExerciseTemplate, setSelectedExerciseTemplate] = useState("");
  const [selectedMusculoGroup, setSelectedMusculoGroup] = useState("");
  const [newEx, setNewEx] = useState({ name: "", s: 3, r: "12", tip: "", mus: "", yt: "", img: "" });
  const [newDay, setNewDay] = useState({ title: "", focus: "", warmupType: "warmupLower", icon: "dumbbell" });
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", username: "", password: "", sourceTemplate: "" });
  const [isEditingClientRoutine, setIsEditingClientRoutine] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState("");
  const [loadingAiNoteId, setLoadingAiNoteId] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [chartMode, setChartMode] = useState('weight');
  const [showMotivationalModal, setShowMotivationalModal] = useState(false);

  // Biblioteca de ejercicios personalizados del entrenador
  const [customExercises, setCustomExercises] = useState([]);
  const [showCustomLibrary, setShowCustomLibrary] = useState(false);
  const [editingCustomExIdx, setEditingCustomExIdx] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [timerDuration, setTimerDuration] = useState(null);
  const [timerKey, setTimerKey] = useState(0);

  // Admin: client info & password reset
  const [showClientInfoModal, setShowClientInfoModal] = useState(false);
  const [clientInfoTarget, setClientInfoTarget] = useState(null);
  const [adminResetPwd, setAdminResetPwd] = useState("");
  const [adminResetPwdConfirm, setAdminResetPwdConfirm] = useState("");
  const [adminResetError, setAdminResetError] = useState("");
  const [adminResetSuccess, setAdminResetSuccess] = useState("");

  // Client: settings panel
  const [showClientSettings, setShowClientSettings] = useState(false);

  // Image Manager modal
  const [imageManagerOpen, setImageManagerOpen] = useState(false);
  const [imageManagerTarget, setImageManagerTarget] = useState({ dayId: null, exName: '' });
  const [newExImageMode, setNewExImageMode] = useState(false);
  const [addingNewMusGroup, setAddingNewMusGroup] = useState(false);
  const [customExerciseImages, setCustomExerciseImages] = useState({});
  const [showConfetti, setShowConfetti] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [expandedStatsExercise, setExpandedStatsExercise] = useState(null);
  const [daySearchQuery, setDaySearchQuery] = useState("");
  
  // Admin visual editor states
  const [adminEditingExIdx, setAdminEditingExIdx] = useState(null);
  const [showAddExercisePanel, setShowAddExercisePanel] = useState(false);
  const [iconDropdownOpen, setIconDropdownOpen] = useState(null);
  const [newDayIconDropdownOpen, setNewDayIconDropdownOpen] = useState(false);

  const lastBackPress = useRef(0);
  const [showExitToast, setShowExitToast] = useState(false);
  const lastAppliedUpdateRef = useRef({});
  const adminBlurTimerRef = useRef(null);
  const initialSetupDoneRef = useRef(false);

  // RED Y FIREBASE
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, []);

  // 🔄 Forzar reconexión de Firestore cuando la app vuelve a primer plano (iOS Safari)
  useEffect(() => {
    if (!db_cloud) return;
    const forceReconnect = () => {
      if (document.visibilityState === 'visible' && loggedInUser) {
        enableNetwork(db_cloud).catch(() => {});
      }
    };
    const handleOnlineReconnect = () => {
      if (loggedInUser) {
        enableNetwork(db_cloud).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', forceReconnect);
    window.addEventListener('online', handleOnlineReconnect);
    return () => {
      document.removeEventListener('visibilitychange', forceReconnect);
      window.removeEventListener('online', handleOnlineReconnect);
    };
  }, [loggedInUser]);

  // ✅ Restore session from JWT token on app load (Phase 5 - Session Management)
  useEffect(() => {
    const restoreSessionFromJWT = async () => {
      const token = getStoredToken();
      
      if (!token) {
        setLoggedInUser(null);
        setDataLoaded(true);
        return;
      }
      
      const { valid, decoded } = await verifyToken(token);
      if (!valid) {
        warn("JWT token invalid or expired - clearing session");
        clearToken();
        setLoggedInUser(null);
        setDataLoaded(true);
        return;
      }
      
      const userId = decoded?.sub;
      if (userId) {
        log("Session restored from JWT:", userId);
        setLoggedInUser(userId);
      } else {
        warn("JWT token valid but no userId found");
        setLoggedInUser(null);
      }
      
      setDataLoaded(true);
    };
    
    restoreSessionFromJWT();
  }, []);

  const updateUserInCloud = useCallback((userId, modifierFn) => {
    setDb(prev => {
      const current = prev[userId] || INITIAL_DB[userId] || { workoutData: { days: [] }, logs: {}, notes: [] };
      const cloned = structuredClone(current);
      const next = modifierFn(cloned);
      
      // Crear hash simple para detectar si es la misma actualización
      const nextStr = JSON.stringify(next);
      const updateKey = `${userId}-${nextStr}`;
      
      if (lastAppliedUpdateRef.current[userId] !== updateKey) {
        lastAppliedUpdateRef.current[userId] = updateKey;
        // With Firestore persistence, setDoc queues locally offline and syncs when back online
        setIsSyncing(true);
        if (db_cloud) {
          setDoc(doc(db_cloud, COLLECTION_NAME, userId), next).then(() => setIsSyncing(false)).catch((writeErr) => { err('❌ Firestore write error for', userId, ':', writeErr.message); setIsSyncing(false); });
        } else {
          warn('⚠️ Firestore not initialized, data saved locally only');
          setIsSyncing(false);
        }
      }
      
      return { ...prev, [userId]: next };
    });
  }, []);

  // NEW: Save color palette preference to user's profile
  const saveUserColorPreference = useCallback((userId, paletteId) => {
    updateUserInCloud(userId, u => ({
      ...u,
      preferredPaletteId: paletteId
    }));
    localStorage.setItem(`athlos_palette_${userId}`, paletteId);
  }, [updateUserInCloud]);

  // NEW: Save motivational phrase (admin only)
  const saveMotivationalPhrase = useCallback((phraseData) => {
    const newPhrase = {
      text: typeof phraseData === 'string' ? phraseData : (phraseData?.text || String(phraseData)),
      timestamp: new Date().toISOString(),
      active: true
    };
    
    const updated = [newPhrase, ...allMotivationalPhrases].slice(0, 20);
    setAllMotivationalPhrases(updated);
    setDailyMotivationalPhrase(newPhrase.text);
    
    // Save to localStorage and cloud
    localStorage.setItem('athlos_motivational_phrases', JSON.stringify(updated));
    if (loggedInUser === 'entrenador' || loggedInUser === 'coach') {
      updateUserInCloud(loggedInUser, u => ({
        ...u,
        motivationalPhrases: updated,
        currentMotivationalPhrase: newPhrase.text
      }));
    }
    
    showSuccess('Frase motivadora guardada ✨');
  }, [allMotivationalPhrases, loggedInUser, updateUserInCloud, showSuccess]);

  // NEW: Delete motivational phrase
  const deleteMotivationalPhrase = useCallback((idx) => {
    const updated = allMotivationalPhrases.filter((_, i) => i !== idx);
    setAllMotivationalPhrases(updated);
    localStorage.setItem('athlos_motivational_phrases', JSON.stringify(updated));
    showSuccess('Frase eliminada');
  }, [allMotivationalPhrases, showSuccess]);

  // Guardar ejercicio personalizado en la biblioteca del entrenador
  const saveCustomExercise = useCallback((exercise) => {
    const newExercise = {
      name: sanitizeInput(exercise.name || '', 50),
      s: parseInt(exercise.s) || 3,
      r: sanitizeInput(String(exercise.r || '12'), 20),
      tip: sanitizeInput(exercise.tip || '', 200),
      mus: sanitizeInput(exercise.mus || '', 30),
      yt: exercise.yt ? sanitizeUrl(exercise.yt) : '',
      img: exercise.img || '',
      createdAt: new Date().toISOString()
    };
    if (!newExercise.name) return;
    setCustomExercises(prev => {
      const exists = prev.findIndex(e => e.name.toLowerCase() === newExercise.name.toLowerCase());
      let updated;
      if (exists > -1) {
        updated = [...prev];
        updated[exists] = { ...updated[exists], ...newExercise };
      } else {
        updated = [newExercise, ...prev];
      }
      localStorage.setItem('athlos_custom_exercises', JSON.stringify(updated));
      if (loggedInUser === 'entrenador' || loggedInUser === 'coach') {
        updateUserInCloud(loggedInUser, u => ({ ...u, customExercises: updated }));
      }
      showSuccess(exists > -1 ? 'Ejercicio actualizado en tu biblioteca 📚' : 'Ejercicio guardado en tu biblioteca 📚');
      return updated;
    });
  }, [loggedInUser, updateUserInCloud, showSuccess]);

  const deleteCustomExercise = useCallback((idx) => {
    setCustomExercises(prev => {
      const updated = prev.filter((_, i) => i !== idx);
      localStorage.setItem('athlos_custom_exercises', JSON.stringify(updated));
      if (loggedInUser === 'entrenador' || loggedInUser === 'coach') {
        updateUserInCloud(loggedInUser, u => ({ ...u, customExercises: updated }));
      }
      return updated;
    });
    showSuccess('Ejercicio eliminado de la biblioteca');
  }, [loggedInUser, updateUserInCloud, showSuccess]);

  const updateCustomExercise = useCallback((idx, updatedData) => {
    setCustomExercises(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], ...updatedData, name: sanitizeInput(updatedData.name || updated[idx].name, 50) };
      localStorage.setItem('athlos_custom_exercises', JSON.stringify(updated));
      if (loggedInUser === 'entrenador' || loggedInUser === 'coach') {
        updateUserInCloud(loggedInUser, u => ({ ...u, customExercises: updated }));
      }
      return updated;
    });
  }, [loggedInUser, updateUserInCloud]);

  // Liberar bloqueo de login cuando expira
  useEffect(() => {
    if (!loginLockedUntil) return;
    const timer = setInterval(() => {
      if (Date.now() >= loginLockedUntil) {
        setLoginLockedUntil(null);
        setLoginAttempts(0);
        setLoginError("Intenta de nuevo");
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [loginLockedUntil]);

  // CARGA DE DATOS DE FIREBASE
  useEffect(() => {
    if (!loggedInUser) {
      setDataLoaded(true);
      return;
    }
    // Reset dataLoaded para que el check de seguridad espere a onSnapshot
    setDataLoaded(false);
    if (!db_cloud) {
      err('⚠️ Firestore not available, using initial data only');
      setDb(INITIAL_DB);
      setDataLoaded(true);
      return;
    }
    // With Firestore persistence enabled, onSnapshot serves cached data offline
    // IMPORTANTE: snap.metadata.fromCache nos dice si los datos vienen de la caché local
    // o del servidor. NUNCA sobrescribir Firestore con INITIAL_DB si solo tenemos caché vacía,
    // porque al reinstalar el APK la caché está vacía pero el servidor tiene datos reales.
    const unsub = onSnapshot(collection(db_cloud, COLLECTION_NAME), (snap) => {
      const cloud = {};
      snap.forEach(d => { cloud[d.id] = d.data(); });
      
      const isFromCache = snap.metadata.fromCache;
      // Leer lista de usuarios eliminados intencionalmente
      const deletedList = cloud['_deleted_users']?.ids || [];
      // Eliminar el documento meta del estado visible
      delete cloud['_deleted_users'];
      
      if (Object.keys(cloud).length === 0) {
         if (isFromCache) {
           // Caché vacía (ej: APK recién instalado) - NO escribir INITIAL_DB al servidor
           log('⏳ Cache vacía, esperando datos del servidor...');
           setDb(INITIAL_DB);
           setDataLoaded(true);
           return;
         }
         // Servidor confirmó que la colección está vacía - primera vez, poblar con INITIAL_DB
         log('🆕 Colección vacía confirmada por servidor, inicializando...');
         Object.keys(INITIAL_DB).forEach(k => {
           if (!deletedList.includes(k)) {
             setDoc(doc(db_cloud, COLLECTION_NAME, k), INITIAL_DB[k]).catch(syncErr => warn("Sync error:", syncErr));
             cloud[k] = INITIAL_DB[k];
           }
         });
      } else {
         // Cloud tiene datos: agregar SOLO usuarios faltantes que NO fueron eliminados
         if (!isFromCache) {
           Object.keys(INITIAL_DB).forEach(k => {
             if (deletedList.includes(k)) return; // Fue eliminado intencionalmente, NO re-agregar
             if (!cloud[k]) {
               setDoc(doc(db_cloud, COLLECTION_NAME, k), INITIAL_DB[k]).catch(syncErr => warn("Sync missing user error:", syncErr));
               cloud[k] = INITIAL_DB[k];
             } else if (!cloud[k].workoutData || !Array.isArray(cloud[k].workoutData.days)) {
               if (INITIAL_DB[k]) {
                 cloud[k].workoutData = INITIAL_DB[k].workoutData || { days: [] };
                 setDoc(doc(db_cloud, COLLECTION_NAME, k), cloud[k]).catch(syncErr => warn("Sync workout error:", syncErr));
               }
             }
           });
         }
      }
      setDb(cloud);
      setDataLoaded(true);
    }, (snapErr) => {
      warn("Firebase Snapshot Error:", snapErr);
      setDb(INITIAL_DB);
      setDataLoaded(true);
    });

    return () => unsub();
  }, [loggedInUser]);

  // Sync motivacional phrase in real-time for clients (onSnapshot updates db)
  useEffect(() => {
    if (!loggedInUser || loggedInUser === 'entrenador' || loggedInUser === 'coach') return;
    const coachPhrase = db['entrenador']?.currentMotivationalPhrase;
    if (coachPhrase) setDailyMotivationalPhrase(coachPhrase);
  }, [db, loggedInUser]);

  // Resetear estados cuando cambia el día que se edita
  useEffect(() => {
    setNewEx({ name: "", s: 3, r: "12", tip: "", mus: "", yt: "", img: "" });
    setSelectedExerciseTemplate("");
    setSelectedMusculoGroup("");
    setAdminEditingExIdx(null);
    setShowAddExercisePanel(false);
  }, [editingDayId]);

  useEffect(() => {
    if (loggedInUser && db[loggedInUser]) {
      // Solo resetear currentClientId y cargar datos iniciales en el primer load
      // para no sacar al admin del cliente que está editando
      if (!initialSetupDoneRef.current) {
        initialSetupDoneRef.current = true;
        setCurrentClientId(loggedInUser);
        setIsAdminMode(loggedInUser === 'entrenador' || loggedInUser === 'coach');
      
        // Load user's color preference
        const saved = localStorage.getItem(`athlos_palette_${loggedInUser}`);
        if (saved) {
          setPreferredPaletteId(saved);
        } else if (db[loggedInUser]?.preferredPaletteId) {
          setPreferredPaletteId(db[loggedInUser].preferredPaletteId);
        }
      
        // Load motivational phrases
        const isCoach = loggedInUser === 'entrenador' || loggedInUser === 'coach';
        if (isCoach) {
          const savedPhrases = localStorage.getItem('athlos_motivational_phrases');
          if (savedPhrases) {
            try {
              const phrases = JSON.parse(savedPhrases);
              setAllMotivationalPhrases(phrases);
              if (phrases.length > 0) {
                setDailyMotivationalPhrase(phrases[0].text || phrases[0]);
              }
            } catch (e) {
              warn('Failed to parse motivational phrases:', e.message);
            }
          } else if (db[loggedInUser]?.motivationalPhrases) {
            setAllMotivationalPhrases(db[loggedInUser].motivationalPhrases);
            setDailyMotivationalPhrase(db[loggedInUser].currentMotivationalPhrase || 'La consistencia es la clave del éxito 💪');
          }
        } else {
          // Clientes: leer frase del entrenador desde Firestore (tiempo real via onSnapshot)
          const coachData = db['entrenador'];
          if (coachData?.currentMotivationalPhrase) {
            setDailyMotivationalPhrase(coachData.currentMotivationalPhrase);
          }
        }

        // Cargar biblioteca de ejercicios personalizados del entrenador
        if (loggedInUser === 'entrenador' || loggedInUser === 'coach') {
          const savedCustomEx = localStorage.getItem('athlos_custom_exercises');
          if (savedCustomEx) {
            try {
              setCustomExercises(JSON.parse(savedCustomEx));
            } catch (e) {
              warn('Failed to parse custom exercises:', e.message);
            }
          } else if (db[loggedInUser]?.customExercises) {
            setCustomExercises(db[loggedInUser].customExercises);
          }
          // Cargar imágenes personalizadas de ejercicios predefinidos
          const savedImgOverrides = localStorage.getItem('athlos_custom_exercise_images');
          if (savedImgOverrides) {
            try {
              setCustomExerciseImages(JSON.parse(savedImgOverrides));
            } catch (e) {
              warn('Failed to parse custom exercise images:', e.message);
            }
          } else if (db[loggedInUser]?.customExerciseImages) {
            setCustomExerciseImages(db[loggedInUser].customExerciseImages);
          }
        }

        // Onboarding para clientes nuevos (sin logs aún)
        if (loggedInUser !== 'entrenador' && loggedInUser !== 'coach') {
          const clientLogs = db[loggedInUser]?.logs || {};
          const hasAnyLogs = Object.values(clientLogs).some(arr => Array.isArray(arr) && arr.length > 0);
          const onboardingSeen = localStorage.getItem(`athlos_onboarding_${loggedInUser}`);
          if (!hasAnyLogs && !onboardingSeen) {
            setShowOnboarding(true);
          }
        }
      }
    }
  }, [loggedInUser, db]);

  // SOLUCIÓN DE SEGURIDAD CONTRA BUCLES INFINITOS Y PANTALLA EN BLANCO
  // Solo expulsar si onSnapshot ya cargó datos (dataLoaded=true) y el usuario no existe en Firestore
  useEffect(() => {
    if (dataLoaded && loggedInUser && currentClientId) {
      const userExists = Object.prototype.hasOwnProperty.call(db, currentClientId);
      
      // Verificar que db tiene datos de Firestore (no solo INITIAL_DB)
      // Si db tiene más keys que INITIAL_DB o si hay entrenador con datos cloud, los datos ya cargaron
      if (!userExists) {
        // Dar tiempo extra para que onSnapshot cargue en caso de red lenta
        const timer = setTimeout(async () => {
          // Verificar directamente en Firestore antes de expulsar
          let existsInCloud = false;
          if (db_cloud && navigator.onLine) {
            try {
              const snap = await getDoc(doc(db_cloud, COLLECTION_NAME, currentClientId));
              existsInCloud = snap.exists();
            } catch (e) { /* ignore */ }
          }
          if (!existsInCloud && !Object.prototype.hasOwnProperty.call(db, currentClientId)) {
            clearToken();
            initialSetupDoneRef.current = false;
            setLoggedInUser(null);
            setIsAdminMode(false);
            localStorage.removeItem("athlos_session_final");
            sessionStorage.removeItem("athlos_session_final");
            setDataLoaded(false);
          }
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [dataLoaded, db, currentClientId, loggedInUser]);

  const authenticate = async () => {
    if (isAuthenticating) return;
    // Rate limiting: bloquear después de 5 intentos fallidos por 5 minutos
    if (loginLockedUntil && Date.now() < loginLockedUntil) {
      const minutesLeft = Math.ceil((loginLockedUntil - Date.now()) / 60000);
      setLoginError(`Demasiados intentos. Intenta en ${minutesLeft} minuto(s)`);
      return;
    }
    
    setLoginError("");
    const input = loginUser.toLowerCase().trim();
    if (!input) return;
    setIsAuthenticating(true);
    try {
      let user = null;
      // 🔐 Siempre obtener datos más recientes de Firestore al estar online
      // Usar getDocFromServer para evitar datos en caché obsoletos (contraseñas cambiadas)
      if (navigator.onLine && db_cloud) {
         try {
           const snap = await getDocFromServer(doc(db_cloud, COLLECTION_NAME, input));
           if (snap.exists()) user = snap.data();
         } catch (serverErr) {
           // Si falla el servidor, intentar con caché
           warn("Server fetch failed, trying cache:", serverErr.message);
           try {
             const snapCache = await getDoc(doc(db_cloud, COLLECTION_NAME, input));
             if (snapCache.exists()) user = snapCache.data();
           } catch (cacheErr) {
             warn("Cache fetch also failed:", cacheErr.message);
           }
         }
      }
      // Fallback a datos locales si Firestore no disponible
      if (!user) {
        user = db[input] || INITIAL_DB[input];
      }
      
      // 🔐 Secure password verification using bcryptjs
      // Soporta contraseñas en texto plano (legacy) y las auto-migra a bcrypt
      let passwordMatch = false;
      if (user) {
        const isBcryptHash = user.password && user.password.startsWith('$2');
        if (isBcryptHash) {
          passwordMatch = await verifyPassword(loginPass, user.password);
        } else {
          // Contraseña legacy en texto plano — comparar directamente
          passwordMatch = (loginPass === user.password);
          // Auto-migrar a bcrypt si coincide
          if (passwordMatch && db_cloud) {
            try {
              const newHash = await hashPassword(loginPass);
              await setDoc(doc(db_cloud, COLLECTION_NAME, input), { ...user, password: newHash });
              log("🔐 Contraseña migrada a bcrypt para:", input);
            } catch (migrateErr) {
              warn("⚠️ No se pudo migrar contraseña:", migrateErr.message);
            }
          }
        }
      }
      
      if (user && passwordMatch) {
        setLoginAttempts(0);
        setLoginLockedUntil(null);
        // Admin if username is 'entrenador' or loaded from DB with admin role
        const isAdmin = input === 'entrenador';
        setLoggedInUser(input);
        setCurrentClientId(input);
        setIsAdminMode(isAdmin);
        
        // 🔐 Generate and store JWT token
        try {
          const tokenHours = keepLoggedIn ? TOKEN_HOURS_KEEP : TOKEN_HOURS_DEFAULT;
          const token = await generateToken(input, tokenHours);
          storeToken(token, keepLoggedIn);
          setLoginError(""); // Clear any error
        } catch (tokenError) {
          warn("⚠️ Token generation warning:", tokenError.message);
          // Fallback: still allow login even if token fails
        }
      } else { 
        const newAttempts = loginAttempts + 1;
        setLoginAttempts(newAttempts);
        if (newAttempts >= LOGIN_MAX_ATTEMPTS) {
          // Bloqueo exponencial: 5min, 15min, 30min según número de bloqueos consecutivos
          const lockMultiplier = Math.min(Math.pow(2, Math.floor(newAttempts / LOGIN_MAX_ATTEMPTS) - 1), 6);
          const lockDuration = LOGIN_LOCKOUT_BASE_MS * lockMultiplier;
          const lockMinutes = Math.ceil(lockDuration / 60000);
          setLoginLockedUntil(Date.now() + lockDuration);
          setLoginError(`Cuenta bloqueada por ${lockMinutes} minuto(s) tras ${newAttempts} intentos fallidos`);
        } else {
          setLoginError(`Usuario o contraseña incorrectos (${newAttempts}/${LOGIN_MAX_ATTEMPTS})`);
        }
      }
    } catch (e) { setLoginError("Error de red: " + e.message); } finally { setIsAuthenticating(false); }
  };

  const changePassword = async () => {
    // Validar contraseña actual
    if (!pwdCurrent || !pwdNew || !pwdConfirm) {
      setPwdError("Todos los campos son obligatorios");
      return;
    }
    
    // Validar que la nueva contraseña sea fuerte
    if (!validatePassword(pwdNew)) {
      setPwdError("Mínimo 8 caracteres, al menos una letra y un número");
      return;
    }
    
    // Verificar que las contraseñas coincidan
    if (pwdNew !== pwdConfirm) {
      setPwdError("Las contraseñas no coinciden");
      return;
    }
    
    // Verificar contraseña actual 🔐 using bcryptjs
    const currentUser = db[loggedInUser] || INITIAL_DB[loggedInUser];
    if (!currentUser) {
      setPwdError("Usuario no encontrado");
      return;
    }
    
    const isCurrentValid = await verifyPassword(pwdCurrent, currentUser.password);
    if (!isCurrentValid) {
      setPwdError("Contraseña actual incorrecta");
      return;
    }
    
    // Hash nueva contraseña antes de guardar
    try {
      const newHash = await hashPassword(pwdNew);
      // Escribir directamente a Firestore y ESPERAR confirmación
      if (db_cloud && navigator.onLine) {
        const userRef = doc(db_cloud, COLLECTION_NAME, loggedInUser);
        const currentSnap = await getDocFromServer(userRef);
        if (currentSnap.exists()) {
          await setDoc(userRef, { ...currentSnap.data(), password: newHash });
        }
      }
      // Actualizar estado local
      setDb(prev => ({
        ...prev,
        [loggedInUser]: { ...(prev[loggedInUser] || {}), password: newHash }
      }));
      setPwdError("");
      setPwdSuccess("Contraseña actualizada correctamente ✓");
      setTimeout(() => {
        setPwdCurrent("");
        setPwdNew("");
        setPwdConfirm("");
        setPwdSuccess("");
        setShowPasswordModal(false);
      }, 2000);
    } catch (error) {
      err("Error hashing password:", error);
      setPwdError("Error al actualizar contraseña. Intenta de nuevo.");
    }
  };

  // 🔐 Session inactivity timeout (30 min)
  const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
  const inactivityTimerRef = useRef(null);
  useEffect(() => {
    if (!loggedInUser || isAdminMode) return;
    const resetTimer = () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => {
        initialSetupDoneRef.current = false;
        setLoggedInUser(null);
        setIsAdminMode(false);
        clearToken();
        localStorage.removeItem("athlos_session_final");
        sessionStorage.removeItem("athlos_session_final");
        sessionStorage.removeItem("athlos_session_start");
        setDataLoaded(false);
        showError('Sesión cerrada por inactividad');
      }, INACTIVITY_TIMEOUT_MS);
    };
    const events = ['click', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [loggedInUser, isAdminMode]);

  const signOutUser = () => {
    if (!window.confirm('¿Seguro que quieres cerrar sesión?')) return;
    initialSetupDoneRef.current = false;
    setLoggedInUser(null); 
    setIsAdminMode(false); 
    setIsEditingClientRoutine(false);
    setEditingClientId(null);
    setEditingDayId(null);
    setSelectedDay(null);
    setActiveTab("home");
    // 🔐 Clear JWT token instead of plaintext session
    clearToken();
    // Clear ALL user-specific storage
    localStorage.removeItem("athlos_session_final"); 
    sessionStorage.removeItem("athlos_session_final");
    sessionStorage.removeItem("athlos_session_start");
    // Limpiar datos específicos del usuario
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('athlos_palette_') || key.startsWith('athlos_custom_') || key.startsWith('athlos_motivational'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    setDataLoaded(false);
  };

  const modifyDayData = (id, field, val) => {
    const targetClientId = editingClientId || currentClientId;
    updateUserInCloud(targetClientId, u => ({ ...u, workoutData: { ...u.workoutData, days: (Array.isArray(u.workoutData?.days) ? u.workoutData.days : []).map(d => d.id === id ? {...d, [field]: sanitizeInput(val)} : d) } }));
  };
  const modifyClientData = (field, val) => updateUserInCloud(currentClientId, u => ({ ...u, [field]: sanitizeInput(val) }));
  const modifyExerciseData = (dayId, idx, field, val) => {
    const targetClientId = editingClientId || currentClientId;
    updateUserInCloud(targetClientId, u => { 
      const days = [...(Array.isArray(u.workoutData?.days) ? u.workoutData.days : [])]; 
      const dIdx = days.findIndex(d => d.id === dayId); 
      if(dIdx > -1 && Array.isArray(days[dIdx].exercises) && days[dIdx].exercises[idx]) { 
        let sanitized;
        
        // 🔐 Validated sanitization based on field type
        if (field === 'yt') {
          sanitized = sanitizeUrl(val);
        } else if (field === 'img') {
          // Images: validate URL or allow base64 data URLs
          sanitized = (val && (val.startsWith('data:image/') || val.startsWith('http://') || val.startsWith('https://') || val.startsWith('/'))) ? val : '';
        } else if (field === 's') {
          // Series: 1-10 range
          sanitized = safeParseSerries(val);
        } else if (field === 'r') {
          // Reps: validate format (can be "8-10", "12", "Fallo")
          sanitized = sanitizeInput(val, 50);
        } else {
          // Other fields: sanitize as text
          sanitized = sanitizeInput(val, 200);
        }
        
        days[dIdx].exercises[idx] = { ...days[dIdx].exercises[idx], [field]: sanitized }; 
      } 
      return { ...u, workoutData: { ...u.workoutData, days } }; 
    });
  };
  
  const removeExerciseFromDay = (dayId, exIdx) => {
    const targetClientId = editingClientId || currentClientId;
    updateUserInCloud(targetClientId, u => { 
      const days = [...(Array.isArray(u.workoutData?.days) ? u.workoutData.days : [])]; 
      const dIdx = days.findIndex(d => d.id === dayId); 
      if (dIdx > -1) {
        days[dIdx].exercises = (Array.isArray(days[dIdx].exercises) ? days[dIdx].exercises : []).filter((_, i) => i !== exIdx);
      }
      return { ...u, workoutData: { ...u.workoutData, days } }; 
    });
    showSuccess("Ejercicio borrado");
  };

  const removeDayFromRoutine = (dayId) => {
    const targetClientId = editingClientId || currentClientId;
    updateUserInCloud(targetClientId, u => {
      const days = Array.isArray(u.workoutData?.days) ? u.workoutData.days : [];
      const filtered = days.filter(d => d.id !== dayId);
      return { ...u, workoutData: { ...u.workoutData, days: filtered } };
    });
    setEditingDayId(null);
    showSuccess("Día eliminado");
  };

  // Drag & Drop reorder days
  const reorderDays = useCallback((fromId, toId) => {
    if (fromId === toId) return;
    const targetClientId = editingClientId || currentClientId;
    updateUserInCloud(targetClientId, u => {
      const days = [...(Array.isArray(u.workoutData?.days) ? u.workoutData.days : [])];
      const fromIdx = days.findIndex(d => d.id === fromId);
      const toIdx = days.findIndex(d => d.id === toId);
      if (fromIdx === -1 || toIdx === -1) return u;
      const [moved] = days.splice(fromIdx, 1);
      days.splice(toIdx, 0, moved);
      return { ...u, workoutData: { ...u.workoutData, days } };
    });
  }, [editingClientId, currentClientId, updateUserInCloud]);

  const handleDayTouchStart = useCallback((e, dayId) => {
    touchTimerRef.current = setTimeout(() => {
      setTouchDragState(dayId);
      setDraggedDayId(dayId);
      if (navigator.vibrate) navigator.vibrate(30);
    }, 400);
  }, []);

  const handleDayTouchMove = useCallback((e) => {
    if (!touchDragState) return;
    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const dayEl = el?.closest('[data-day-id]');
    if (dayEl) setDragOverDayId(Number(dayEl.dataset.dayId));
  }, [touchDragState]);

  const handleDayTouchEnd = useCallback(() => {
    clearTimeout(touchTimerRef.current);
    if (touchDragState && dragOverDayId && touchDragState !== dragOverDayId) {
      reorderDays(touchDragState, dragOverDayId);
    }
    setTouchDragState(null);
    setDraggedDayId(null);
    setDragOverDayId(null);
  }, [touchDragState, dragOverDayId, reorderDays]);

  const selectExerciseTemplate = (exName, fromAthlos = false) => {
    const source = fromAthlos ? ATHLOS_FORGE_EXERCISES : EJERCICIOS_PREDEFINIDOS;
    const template = source.find(e => e.name === exName);
    if (template) {
      const tip = template.coaching || template.tip || "";
      setNewEx({ name: template.name, s: 3, r: "12", tip: tip, mus: template.mus, yt: template.yt, img: customExerciseImages[template.name] || template.img });
      setSelectedExerciseTemplate(exName);
    }
  };
  
  const getExercisesByMuscleGroup = (group, source = EJERCICIOS_PREDEFINIDOS) => {
    return source.filter(e => e.mus === group).sort((a, b) => a.name.localeCompare(b.name));
  };

  // Registrar usuario como eliminado para que INITIAL_DB no lo re-agregue
  const trackDeletedUser = async (userId) => {
    if (!db_cloud) return;
    try {
      const metaRef = doc(db_cloud, COLLECTION_NAME, '_deleted_users');
      const metaSnap = await getDoc(metaRef);
      const current = metaSnap.exists() ? (metaSnap.data().ids || []) : [];
      if (!current.includes(userId)) {
        await setDoc(metaRef, { ids: [...current, userId] });
      }
    } catch (e) { warn('Error tracking deleted user:', e); }
  };

  const removeClientAccount = async () => {
    if (currentClientId === 'entrenador' || currentClientId === 'coach') return;
    setIsSyncing(true);
    await trackDeletedUser(currentClientId);
    if (db_cloud) await deleteDoc(doc(db_cloud, COLLECTION_NAME, currentClientId)).catch(()=>{});
    setDb(prev => { const n = {...prev}; delete n[currentClientId]; return n; });
    setCurrentClientId('entrenador'); setIsSyncing(false);
    showSuccess("Cliente eliminado");
  };

  const deleteClientFromAdmin = async (clientId) => {
    if (clientId === 'entrenador' || clientId === 'coach') {
      showError("No puedes eliminar el admin");
      return;
    }
    
    setIsSyncing(true);
    try {
      // Si el usuario actual era el eliminado, CAMBIAR PRIMERO a entrenador
      if (currentClientId === clientId) {
        setCurrentClientId('entrenador');
      }
      
      // Si estábamos editando ese cliente, volver al admin
      if (editingClientId === clientId) {
        setEditingClientId(null);
        setIsEditingClientRoutine(false);
      }
      
      // Registrar como eliminado y luego borrar de Firebase
      await trackDeletedUser(clientId);
      if (db_cloud && navigator.onLine) {
        await deleteDoc(doc(db_cloud, COLLECTION_NAME, clientId)).catch(()=>{});
      }
      
      // FINALMENTE eliminar del estado local
      setDb(prev => { 
        const n = {...prev}; 
        delete n[clientId]; 
        return n; 
      });
      
      setIsSyncing(false);
      setShowDeleteConfirmModal(false);
      setClientToDelete(null);
      showSuccess(`${clientId} eliminado permanentemente`);
    } catch (e) {
      setIsSyncing(false);
      showError("Error al eliminar cliente");
    }
  };

  // RESTAURAR DATOS DESDE FIRESTORE (botón de emergencia para el admin)
  const forceReloadFromServer = async () => {
    if (!db_cloud) {
      showError("Firestore no disponible");
      return;
    }
    setIsForceReloading(true);
    try {
      // Forzar reconexión para obtener datos frescos del servidor
      await enableNetwork(db_cloud);
      const snap = await getDocs(collection(db_cloud, COLLECTION_NAME));
      const cloud = {};
      snap.forEach(d => { 
        if (d.id !== '_deleted_users') {
          cloud[d.id] = d.data(); 
        }
      });
      if (Object.keys(cloud).length > 0) {
        setDb(cloud);
        showSuccess(`Datos restaurados del servidor (${Object.keys(cloud).filter(k => k !== 'entrenador').length} clientes)`);
      } else {
        showError("No se encontraron datos en el servidor");
      }
    } catch (e) {
      err('Error al restaurar:', e);
      showError("Error de conexión con el servidor");
    }
    setIsForceReloading(false);
  };

  const addLogRecord = useCallback((exName, weight, reps) => {
    // 🔐 VALIDATE input before storing
    const validatedWeight = safeParseWeight(weight);
    const validatedReps = safeParseReps(reps);
    
    if (validatedWeight === 0 && validatedReps === 0) {
      showError("Peso o reps inválidos");
      return;
    }
    
    const dateStr = formatDateLog();
    const logEntry = { weight: validatedWeight, reps: validatedReps, date: dateStr, id: Date.now() };
    
    // Validate log structure with AJV
    const validation = validateLogAJV(logEntry);
    if (!validation.valid) {
      warn("⚠️ Log validation failed:", validation.errors);
      showError("Datos inválidos");
      return;
    }
    
    updateUserInCloud(currentClientId, (u) => {
      const logs = u.logs || {};
      return { ...u, logs: { ...logs, [sanitizeInput(exName)]: [logEntry, ...(Array.isArray(logs[exName]) ? logs[exName] : [])].slice(0, MAX_LOG_ENTRIES) } };
    });
    showSuccess("Serie registrada");
  }, [currentClientId, updateUserInCloud]);

  const deleteLogRecord = useCallback((exName, logId) => updateUserInCloud(currentClientId, u => ({ ...u, logs: { ...u.logs, [exName]: (Array.isArray(u.logs?.[exName]) ? u.logs[exName] : []).filter(l => l.id !== logId) } })), [currentClientId, updateUserInCloud]);
  
  const addExerciseNote = useCallback((exName, noteText) => {
    const dateStr = formatDateLog();
    const sanitized = sanitizeInput(noteText);
    if (!sanitized.trim()) return;
    updateUserInCloud(currentClientId, (u) => {
      const exNotes = u.exerciseNotes || {};
      return { ...u, exerciseNotes: { ...exNotes, [exName]: [{ text: sanitized, date: dateStr, id: Date.now() }, ...(Array.isArray(exNotes[exName]) ? exNotes[exName] : [])].slice(0, 20) } };
    });
  }, [currentClientId, updateUserInCloud]);
  
  const addNoteRecord = () => {
    if (!noteText || !noteText.trim()) return;
    
    // 🔐 Sanitize and validate note
    const sanitized = sanitizeInput(noteText, 500);
    if (!sanitized.trim()) return;
    
    const dateStr = formatDateLog();
    const noteEntry = { text: sanitized, date: dateStr, id: Date.now() };
    
    updateUserInCloud(currentClientId, (u) => ({ 
      ...u, 
      notes: [noteEntry, ...(Array.isArray(u.notes) ? u.notes : [])].slice(0, 50) 
    }));
    setNoteText("");
  };

  const handleAiCoachReply = async (noteId, text) => {
    setLoadingAiNoteId(noteId);
    const clientName = db[currentClientId]?.name || "Cliente";
    const reply = await callGeminiAPI(`El cliente ${clientName} dice: "${text}". Responde como su entrenador con un mensaje motivador de 2 líneas con algún emoji.`);
    if (reply) {
      updateUserInCloud(currentClientId, (userData) => ({
        ...userData, notes: (Array.isArray(userData.notes) ? userData.notes : []).map(n => n.id === noteId ? { ...n, aiReply: reply.trim() } : n)
      }));
    }
    setLoadingAiNoteId(null);
  };

  const handleChangePassword = changePassword;

  const adminResetClientPassword = async () => {
    if (!clientInfoTarget || !isAdminMode) return;
    if (!adminResetPwd || !adminResetPwdConfirm) {
      setAdminResetError("Todos los campos son obligatorios");
      return;
    }
    if (!validatePassword(adminResetPwd)) {
      setAdminResetError("Mínimo 8 caracteres, al menos una letra y un número");
      return;
    }
    if (adminResetPwd !== adminResetPwdConfirm) {
      setAdminResetError("Las contraseñas no coinciden");
      return;
    }
    try {
      const newHash = await hashPassword(adminResetPwd);
      // Escribir directamente a Firestore y ESPERAR confirmación
      if (db_cloud && navigator.onLine) {
        const userRef = doc(db_cloud, COLLECTION_NAME, clientInfoTarget);
        const currentSnap = await getDocFromServer(userRef);
        if (currentSnap.exists()) {
          await setDoc(userRef, { ...currentSnap.data(), password: newHash });
        } else {
          setAdminResetError("Usuario no encontrado en la base de datos");
          return;
        }
      }
      // Actualizar también el estado local
      setDb(prev => ({
        ...prev,
        [clientInfoTarget]: { ...(prev[clientInfoTarget] || {}), password: newHash }
      }));
      setAdminResetError("");
      setAdminResetSuccess("Contraseña actualizada correctamente ✓");
      setTimeout(() => {
        setAdminResetPwd("");
        setAdminResetPwdConfirm("");
        setAdminResetSuccess("");
      }, 2000);
    } catch (error) {
      err("Error al resetear contraseña:", error);
      setAdminResetError("Error al actualizar contraseña: " + error.message);
    }
  };

  const startTimerHook = useCallback((s) => { setTimerDuration(s); setTimerKey((k) => k + 1); }, []);
  const openImageManagerCb = useCallback((dayId, exName) => { setImageManagerTarget({ dayId, exName }); setImageManagerOpen(true); }, []);
  const navigateTo = (tab, day = null) => { setActiveTab(tab); setSelectedDay(day); setDaySearchQuery(""); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const updateImageHook = useCallback((dayId, exName, newImgBase64) => {
    const targetClientId = editingClientId || currentClientId;
    updateUserInCloud(targetClientId, (u) => {
      const days = [...(Array.isArray(u.workoutData?.days) ? u.workoutData.days : [])];
      const dIdx = days.findIndex(d => d.id === dayId);
      if (dIdx !== -1) {
          const exes = [...(Array.isArray(days[dIdx].exercises) ? days[dIdx].exercises : [])];
          const eIdx = exes.findIndex(e => e.name === exName);
          if (eIdx !== -1) { exes[eIdx] = { ...exes[eIdx], img: newImgBase64 }; days[dIdx] = { ...days[dIdx], exercises: exes }; }
      }
      return { ...u, workoutData: { ...u.workoutData, days } };
    });
    // Persistir imagen custom para ejercicios predefinidos (usar functional update para evitar stale closure)
    const isPredefined = [...EJERCICIOS_PREDEFINIDOS, ...ATHLOS_FORGE_EXERCISES].some(e => e.name === exName);
    if (isPredefined && (loggedInUser === 'entrenador' || loggedInUser === 'coach')) {
      setCustomExerciseImages(prev => {
        const updated = { ...prev, [exName]: newImgBase64 };
        localStorage.setItem('athlos_custom_exercise_images', JSON.stringify(updated));
        updateUserInCloud(loggedInUser, u => ({ ...u, customExerciseImages: updated }));
        return updated;
      });
    }
  }, [editingClientId, currentClientId, updateUserInCloud, loggedInUser]);

  // Body metrics stats (weight, body fat, bone mass)
  const addUserStats = useCallback(async (entry) => {
    updateUserInCloud(currentClientId, u => ({
      ...u,
      userStats: [...(Array.isArray(u.userStats) ? u.userStats : []), entry]
    }));
  }, [currentClientId, updateUserInCloud]);

  // Progress photos (before/after 3 angles)
  const addProgressPhotos = useCallback(async (entry) => {
    updateUserInCloud(currentClientId, u => ({
      ...u,
      progressPhotos: [...(Array.isArray(u.progressPhotos) ? u.progressPhotos : []), entry]
    }));
  }, [currentClientId, updateUserInCloud]);

  const runCreateProfile = async () => {
    if (isCreatingProfile) return;
    const name = sanitizeInput(newClient.name).trim();
    const username = sanitizeInput(newClient.username).trim().toLowerCase();
    const password = newClient.password;
    
    if (!name || !username || !password || !validatePassword(password)) {
      showError("Datos inválidos o contraseña débil (mín. 8 caracteres, letra + número)");
      return;
    }
    setIsCreatingProfile(true);
    
    const id = username.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_");
    let sourceDays = [];
    if (newClient.sourceTemplate.startsWith("tmpl_")) {
      sourceDays = (db.entrenador?.templates || []).find(t => t.id === newClient.sourceTemplate.replace("tmpl_", ""))?.days || [];
    } else if (newClient.sourceTemplate.startsWith("client_")) {
      sourceDays = db[newClient.sourceTemplate.replace("client_", "")]?.workoutData?.days || [];
    }
    try {
      const hashedPassword = await hashPassword(password);
      const newUserData = {
        username: username, password: hashedPassword, name: name, color: "from-blue-600 to-indigo-500", subtitle: "Nuevo Plan", advice: "A darlo todo.", logs: {}, notes: [], workoutData: { days: structuredClone(sourceDays) }
      };
      
      // Escribir DIRECTAMENTE a Firestore y esperar confirmación
      if (db_cloud) {
        setIsSyncing(true);
        await setDoc(doc(db_cloud, COLLECTION_NAME, id), newUserData);
        setIsSyncing(false);
        log("✅ Cliente creado en Firestore:", id);
      }
      // Actualizar estado local también
      setDb(prev => ({ ...prev, [id]: newUserData }));
      setCurrentClientId(id); setShowAddClientModal(false);
      setNewClient({ name: "", username: "", password: "", sourceTemplate: "" });
      showSuccess("Cliente " + name + " creado ✓");
    } catch (error) {
      err("❌ Error creando cliente:", error.message);
      setIsSyncing(false);
      showError("Error al crear cuenta: " + error.message);
    } finally {
      setIsCreatingProfile(false);
    }
  };

  useEffect(() => {
    let interval;
    if (sessionStart) {
      sessionStorage.setItem('athlos_session_start', String(sessionStart));
      interval = setInterval(() => setSessionElapsed(Math.floor((Date.now() - sessionStart) / 1000)), 1000);
    } else {
      sessionStorage.removeItem('athlos_session_start');
      setSessionElapsed(0);
    }
    return () => clearInterval(interval);
  }, [sessionStart]);

  const finishSession = () => { 
    const h = Math.floor(sessionElapsed / 3600), m = Math.floor((sessionElapsed % 3600) / 60);
    setShowConfetti(true);
    showSuccess(`¡COMPLETADO EN ${h>0?h+'h ':''}${m}m! 🎉`);
    setSessionStart(null); navigateTo("home"); 
  };

  // Manejo unificado del botón atrás (web only — native uses BackButtonExitHandler)
  useEffect(() => {
    const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();
    if (isNative) return;

    window.history.replaceState({ tab: "home" }, "");
    const handlePopState = (e) => {
      if (!loggedInUser) return;
      // Si estamos en la vista de un día, volver al home
      if (activeTab === "day") {
        setActiveTab("home");
        setSelectedDay(null);
        window.history.pushState({ tab: "home" }, "");
        return;
      }
      // En home: doble-tap para salir
      const now = Date.now();
      if (now - lastBackPress.current < 2000) {
        window.history.back();
      } else {
        lastBackPress.current = now;
        setShowExitToast(true); 
        setTimeout(() => setShowExitToast(false), 2000);
        window.history.pushState({ tab: "home" }, "");
        setActiveTab("home"); 
        setSelectedDay(null);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [loggedInUser, activeTab]);

  useEffect(() => {
    if (db[currentClientId]?.workoutData?.days?.length > 0) {
      if(!targetDayId || !db[currentClientId].workoutData.days.find(d=>d.id.toString() === targetDayId)) {
        setTargetDayId(db[currentClientId].workoutData.days[0].id.toString());
      }
    } else { setTargetDayId(""); }
  }, [currentClientId, db, targetDayId]);

  // Hooks must be called unconditionally (before any early returns)
  const client = db[currentClientId] || {};
  const workoutLogs = client.logs || {};
  const streakCount = useMemo(() => calculateStreak(workoutLogs), [workoutLogs]);
  const weeklySummary = useMemo(() => getWeeklySummary(workoutLogs), [workoutLogs]);

  // --- UI RENDER ---

  if (!loggedInUser) {
    return (
      <>
        <AthlosSplashScreen />
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-white font-sans">
          <div className="w-full max-w-sm">
            <div className="text-center mb-10">
              <div className="relative mx-auto mb-3 w-56 h-56">
                <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-3xl scale-150" />
                <img src="/athlos-logo.png" alt="Athlos" className="relative w-56 h-56 object-contain drop-shadow-[0_0_40px_rgba(245,158,11,0.5)]" />
              </div>
              <h2 className="text-amber-500 text-lg font-black tracking-tight">Entrenamiento Premium</h2>
              <p className="text-zinc-600 text-[10px] uppercase font-bold tracking-widest">by Sebas</p>
              <p className="text-zinc-700 text-[8px] font-mono mt-1">v{APP_VERSION}</p>
            </div>
          <div className="space-y-4">
            <input type="text" placeholder="Usuario" autoCapitalize="none" autoCorrect="off" className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:outline-none focus:border-amber-500 transition-colors placeholder:text-zinc-600" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} />
            <input type="password" placeholder="Contraseña" className={`w-full bg-zinc-900 border-2 border-zinc-800 rounded-2xl px-5 py-4 text-left text-sm font-bold focus:outline-none focus:border-amber-500 transition-colors ${loginPass ? 'text-amber-500 tracking-[0.5em]' : 'text-zinc-600'}`} value={loginPass} onChange={(e) => setLoginPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && authenticate()} />
            <label className="flex items-center gap-2 text-zinc-400 text-xs font-bold pl-2 cursor-pointer mt-2"><input type="checkbox" checked={keepLoggedIn} onChange={(e) => setKeepLoggedIn(e.target.checked)} className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-amber-500 accent-amber-500" />Mantener sesión iniciada</label>
            {loginError && <p className="text-red-500 text-xs font-bold text-center bg-red-500/10 p-2 rounded-lg">{String(loginError)}</p>}
            <button onClick={authenticate} disabled={isAuthenticating} className={`w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-5 rounded-2xl uppercase text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition-all mt-4 ${isAuthenticating ? 'opacity-60' : ''}`}>{isAuthenticating ? <Loader2 className="animate-spin mx-auto" size={20}/> : 'Acceder'}</button>
          </div>
          <p className="text-center text-zinc-700 text-[9px] mt-10">Desarrollado por Sebas &copy; {new Date().getFullYear()} · v{APP_VERSION}</p>
        </div>
      </div>
      </>
    );
  }

  if (!dataLoaded || !db[currentClientId]) return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white">
      <Loader2 className="animate-spin text-amber-500 mb-4" size={40} />
      <p className="text-sm text-zinc-400">Cargando datos...</p>
    </div>
  );

  const dailyNotes = client.notes || [];
  const validDays = Array.isArray(client.workoutData?.days) ? client.workoutData.days : [];
  const validNotes = Array.isArray(client.notes) ? client.notes : [];
  const palette = !isAdminMode ? getPaletteById(preferredPaletteId) : null;

  return (
    <div className="min-h-screen font-sans transition-colors duration-500" style={!isAdminMode && palette ? { backgroundColor: palette.dark, color: palette.text } : undefined} >
      <BackButtonExitHandler
        isEnabled={!!loggedInUser}
        canGoBack={selectedDay !== null || activeTab !== "home" || isEditingClientRoutine || editingDayId !== null}
        onNavigateBack={() => {
          if (editingDayId !== null) { setEditingDayId(null); setNewEx({ name: "", s: 3, r: "12", tip: "", mus: "", yt: "", img: "" }); setAddingNewMusGroup(false); setSelectedMusculoGroup(""); }
          else if (isEditingClientRoutine) { setIsEditingClientRoutine(false); setEditingClientId(null); setCurrentClientId('entrenador'); setIsAdminMode(true); }
          else if (selectedDay !== null) { setSelectedDay(null); }
          else { navigateTo("home"); }
        }}
        onExit={() => signOutUser()}
      />
      <div className={`max-w-md mx-auto p-6 pb-40 ${isAdminMode ? 'bg-black text-white' : ''}`}>
        <div className="flex justify-between items-center mb-6">
           <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} /><span className="text-[9px] font-black uppercase" style={palette ? { color: `${palette.text}80` } : { color: '#a1a1aa' }}>{isOnline ? 'Online' : 'Offline'}</span></div>
           <div className="flex gap-2">
              {isAdminMode && <button onClick={() => setIsAdminMode(false)} className="bg-blue-500/10 text-blue-500 p-2 rounded-xl text-xs font-bold px-3">Ver como cliente</button>}
              {!isAdminMode && loggedInUser === 'entrenador' && <button onClick={() => setIsAdminMode(true)} className="bg-amber-500/10 text-amber-500 p-2 rounded-xl"><Crown size={18}/></button>}
              {!isAdminMode && loggedInUser !== 'entrenador' && <button onClick={() => setShowClientSettings(true)} className="p-2 rounded-xl transition-all" style={palette ? { backgroundColor: `${palette.accent}20`, color: palette.accent } : {}}><Settings size={18}/></button>}
              <button onClick={signOutUser} className="p-2 rounded-xl border" style={palette ? { backgroundColor: `${palette.card}`, borderColor: `${palette.accent}30`, color: '#ef4444' } : { backgroundColor: '#fef2f2', color: '#ef4444', borderColor: '#fee2e2' }}><LogOut size={18}/></button>
           </div>
        </div>

        {activeTab === "home" && (
          <div className="space-y-8 animate-in fade-in duration-500">
            
            {/* NEW: Athlos Premium Brand Header with Logo & Daily Phrase */}
            <AthlosBrandHeader 
              dailyPhrase={dailyMotivationalPhrase}
              colorPalette={getPaletteById(preferredPaletteId)}
              isAdmin={isAdminMode}
              onAdminEditPhrase={saveMotivationalPhrase}
            />
            
            <div className={`bg-gradient-to-br ${isAdminMode && !isEditingClientRoutine ? "from-zinc-800 to-zinc-900 border border-zinc-700" : String(client.color || "from-blue-600 to-indigo-500")} p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden`}>
              <div className="flex flex-col gap-1 relative z-10">
                 {isAdminMode && !isEditingClientRoutine ? (
                   <>
                     <input defaultValue={String(client.name || "Cliente")} onBlur={e => modifyClientData('name', e.target.value)} className="bg-transparent text-3xl font-black uppercase outline-none w-full" />
                     <input defaultValue={String(client.subtitle || "")} onBlur={e => modifyClientData('subtitle', e.target.value)} className="bg-transparent text-sm font-medium italic opacity-80 outline-none w-full" />
                   </>
                 ) : (
                   <>
                     <h1 className="text-3xl font-black uppercase tracking-tight">{String(client.name || "Cliente")}</h1>
                     <p className="text-sm font-medium italic opacity-80">{String(client.subtitle || "")}</p>
                   </>
                 )}
              </div>
              {isEditingClientRoutine && (
                <div className="absolute top-4 right-4 z-20">
                  <button onClick={() => { setIsEditingClientRoutine(false); setEditingClientId(null); setCurrentClientId('entrenador'); setIsAdminMode(true); }} className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase">← Volver Admin</button>
                </div>
              )}
              <Zap className="absolute -bottom-4 -right-4 w-32 h-32 opacity-10 rotate-12" />
            </div>

            {isAdminMode && (
              <div className="bg-zinc-900 p-6 rounded-[2rem] border border-zinc-800 shadow-2xl space-y-6 mt-8">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-zinc-500"><Users size={14} className="text-amber-500" /> Clientes ({Object.keys(db).filter(id => id !== 'entrenador' && id !== '_deleted_users').length})</div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase">
                    <button onClick={forceReloadFromServer} disabled={isForceReloading} className="bg-zinc-800 text-emerald-500 px-3 py-1.5 rounded-lg active:scale-95 flex items-center gap-1 disabled:opacity-50"><RefreshCw size={12} className={isForceReloading ? 'animate-spin' : ''}/> {isForceReloading ? '...' : 'Sync'}</button>
                    <button onClick={() => setShowAddClientModal(true)} className="bg-amber-500 text-black px-3 py-1.5 rounded-lg active:scale-95 flex items-center gap-1 font-black"><Plus size={12}/> Nuevo</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {Object.keys(db).filter(id => id !== 'entrenador' && id !== '_deleted_users').map(id => {
                    const c = db[id];
                    const isSelected = editingClientId === id;
                    const dayCount = Array.isArray(c.workoutData?.days) ? c.workoutData.days.length : 0;
                    const logCount = Object.values(c.logs || {}).flat().length;
                    return (
                      <button key={id} onClick={() => { setEditingClientId(id); setEditingDayId(null); setCurrentClientId(id); setIsEditingClientRoutine(true); setNewEx({ name: "", s: 3, r: "12", tip: "", mus: "", yt: "", img: "" }); setSelectedExerciseTemplate(""); }}
                        className={`relative p-4 rounded-2xl border text-left transition-all active:scale-[0.97] ${isSelected ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10' : 'border-zinc-800 bg-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-800'}`}>
                        <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${String(c.color || 'from-blue-600 to-indigo-500')} flex items-center justify-center text-white text-xs font-black mb-2`}>
                          {String(c.name || id).charAt(0).toUpperCase()}
                        </div>
                        <p className={`text-sm font-black truncate ${isSelected ? 'text-amber-500' : 'text-white'}`}>{String(c.name || id)}</p>
                        <p className="text-[9px] text-zinc-500 truncate mt-0.5">{String(c.subtitle || '—')}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[8px] text-zinc-600 font-bold">{dayCount} días</span>
                          <span className="text-[8px] text-zinc-600 font-bold">{logCount} logs</span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setClientInfoTarget(id); setShowClientInfoModal(true); setAdminResetPwd(""); setAdminResetPwdConfirm(""); setAdminResetError(""); setAdminResetSuccess(""); }} className="absolute top-3 right-3 text-zinc-600 hover:text-amber-500 transition-colors"><Eye size={14}/></button>
                      </button>
                    );
                  })}
                </div>
                
                {editingClientId && db[editingClientId] && (
                  <div className="border-t border-zinc-800 pt-12 space-y-12 animate-in slide-in-from-top-4 mt-8">
                    {/* HEADER DEL CLIENTE */}
                    <div className={`bg-gradient-to-br ${String(db[editingClientId].color || "from-blue-600")} p-6 rounded-2xl text-white relative`}>
                      <div className="flex justify-end gap-2 mb-5">
                        <button onClick={() => generatePDFReport(db[editingClientId], Array.isArray(db[editingClientId].workoutData?.days) ? db[editingClientId].workoutData.days : [])} className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-all flex items-center gap-1 text-[9px] font-bold uppercase"><Download size={14}/> PDF</button>
                        <button onClick={() => { setShowDeleteConfirmModal(true); setClientToDelete(editingClientId); }} className="bg-red-500/30 hover:bg-red-500/40 text-red-200 p-2 rounded-lg transition-all flex items-center gap-1 text-[9px] font-bold uppercase"><Trash2 size={14}/> Eliminar</button>
                      </div>
                      <div className="space-y-6">
                        <div>
                          <label className="text-[9px] font-black uppercase text-white/60 block mb-2">Nombre</label>
                          <input key={`name-${editingClientId}`} defaultValue={String(db[editingClientId].name || "")} maxLength="50" onBlur={e => { const val = e.target.value; clearTimeout(adminBlurTimerRef.current); adminBlurTimerRef.current = setTimeout(() => updateUserInCloud(editingClientId, u => ({...u, name: sanitizeInput(val)})), 500); }} className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-white font-black text-lg outline-none" />
                        </div>
                        <div>
                          <label className="text-[9px] font-black uppercase text-white/60 block mb-2">Subtítulo</label>
                          <input key={`subtitle-${editingClientId}`} defaultValue={String(db[editingClientId].subtitle || "")} maxLength="60" onBlur={e => { const val = e.target.value; clearTimeout(adminBlurTimerRef.current); adminBlurTimerRef.current = setTimeout(() => updateUserInCloud(editingClientId, u => ({...u, subtitle: sanitizeInput(val)})), 500); }} className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-white font-medium text-sm outline-none" />
                        </div>
                        <div>
                          <label className="text-[9px] font-black uppercase text-white/60 block mb-2">Consejo Coach</label>
                          <textarea key={`advice-${editingClientId}`} defaultValue={String(db[editingClientId].advice || "")} maxLength="150" onBlur={e => { const val = e.target.value; clearTimeout(adminBlurTimerRef.current); adminBlurTimerRef.current = setTimeout(() => updateUserInCloud(editingClientId, u => ({...u, advice: sanitizeInput(val)})), 500); }} className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-white font-medium text-sm outline-none" />
                        </div>
                      </div>
                    </div>

                    {/* SELECTOR DE DÍAS */}
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h4 className="text-[10px] font-black uppercase text-zinc-400">Días de Entrenamiento ({(Array.isArray(db[editingClientId].workoutData?.days) ? db[editingClientId].workoutData.days : []).length})</h4>
                        {editingDayId && <button onClick={() => { setEditingDayId(null); setNewEx({ name: "", s: 3, r: "12", tip: "", mus: "", yt: "", img: "" }); setAddingNewMusGroup(false); setSelectedMusculoGroup(""); }} className="text-amber-500 text-[9px] font-bold">← Volver</button>}
                      </div>
                      
                      {!editingDayId ? (
                        <>
                          <p className="text-[9px] text-zinc-500 italic mb-2">Pulsa un día abajo para editarlo. Crea nuevos días aquí:</p>
                          <div className="space-y-4 bg-zinc-800/30 p-6 rounded-xl border border-zinc-700/50">
                            <input key={`newday-title-${editingClientId}`} type="text" placeholder="Nombre del día..." className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white text-xs outline-none focus:border-amber-500" value={newDay.title} onChange={e => setNewDay({...newDay, title: e.target.value})} />
                            <input key={`newday-focus-${editingClientId}`} type="text" placeholder="Focus (ej: Fuerza, Hipertrofia)..." className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white text-xs outline-none focus:border-amber-500" value={newDay.focus} onChange={e => setNewDay({...newDay, focus: e.target.value})} />
                            <div className="relative">
                              <button type="button" onClick={() => setNewDayIconDropdownOpen(!newDayIconDropdownOpen)} className="flex items-center gap-2 w-full text-left p-3 rounded-xl bg-zinc-800 border border-zinc-700 hover:border-zinc-600 transition-all">
                                {(() => { const SelIcon = getDayIcon(newDay.icon); return <SelIcon size={16} className="text-amber-500" />; })()}
                                <span className="text-[9px] text-zinc-400 font-bold uppercase flex-1">Icono: {DAY_ICON_OPTIONS.find(o => o.id === newDay.icon)?.label || 'Mancuerna'}</span>
                                <ChevronRight size={12} className={`text-zinc-500 transition-transform ${newDayIconDropdownOpen ? 'rotate-90' : ''}`} />
                              </button>
                              {newDayIconDropdownOpen && (
                                <div className="mt-2 p-2 bg-zinc-800 rounded-xl border border-zinc-700 animate-in slide-in-from-top-2 duration-200">
                                  <div className="grid grid-cols-6 gap-2">
                                    {DAY_ICON_OPTIONS.map(opt => {
                                      const NewDayOptIcon = opt.icon;
                                      const isSelected = newDay.icon === opt.id;
                                      return (
                                        <button key={opt.id} type="button" title={opt.label} onClick={() => { setNewDay({...newDay, icon: opt.id}); setNewDayIconDropdownOpen(false); }} className={`p-2 rounded-lg transition-all ${isSelected ? 'bg-amber-500 text-black scale-110' : 'bg-zinc-700/50 text-zinc-400 hover:bg-zinc-600 hover:text-white'}`}>
                                          <NewDayOptIcon size={16} />
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              <select key={`newday-warmup-${editingClientId}`} value={newDay.warmupType} onChange={e => setNewDay({...newDay, warmupType: e.target.value})} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white text-xs outline-none">
                                <option value="warmupLower">🦵 Inferior — Piernas, glúteos, isquios</option>
                                <option value="warmupUpper">💪 Superior — Pecho, espalda, hombros, brazos</option>
                                <option value="warmupAthlos">⚡ Athlos — Full-body, movilidad y core</option>
                              </select>
                              {newDay.warmupType && warmupData[newDay.warmupType] && (
                                <div className="bg-zinc-900/80 rounded-xl p-3 border border-zinc-700/50">
                                  <p className="text-[9px] text-amber-500 font-bold mb-1.5">{warmupData[newDay.warmupType].title}</p>
                                  <p className="text-[8px] text-zinc-400 mb-2">{warmupData[newDay.warmupType].description}</p>
                                  <div className="space-y-1">
                                    {warmupData[newDay.warmupType].steps.map((s, si) => (
                                      <div key={si} className="flex gap-2 text-[8px] text-zinc-500">
                                        <span className="text-amber-500/60">•</span>
                                        <span><strong className="text-zinc-300">{s.name}:</strong> {s.detail}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            <button onClick={() => { if(newDay.title?.trim()) { updateUserInCloud(editingClientId, u => ({ ...u, workoutData: { ...u.workoutData, days: [...(Array.isArray(u.workoutData?.days) ? u.workoutData.days : []), { id: Date.now(), title: sanitizeInput(newDay.title), focus: sanitizeInput(newDay.focus), warmupType: newDay.warmupType, icon: newDay.icon, exercises: [] }] } })); setNewDay({ title: "", focus: "", warmupType: "warmupLower", icon: "dumbbell" }); showSuccess("Día creado ✨"); } }} className="w-full bg-amber-500 text-black font-black py-3 rounded-xl text-[10px] uppercase active:scale-95">+ Crear Día</button>
                          </div>
                        </>
                      ) : (
                        /* VISTA VISUAL DE EJERCICIOS DEL DÍA - Misma vista que el cliente */
                        <div className="space-y-6">
                          {(() => {
                            const day = db[editingClientId].workoutData?.days?.find(d => d.id === editingDayId);
                            const exercises = Array.isArray(day?.exercises) ? day.exercises : [];
                            return (
                              <>
                                {/* Header del día con edición inline */}
                                <div className="bg-zinc-800/80 p-5 rounded-2xl border border-zinc-700 space-y-3">
                                  <input key={`dayedit-title-${editingDayId}`} defaultValue={String(day?.title || "")} onBlur={e => modifyDayData(editingDayId, 'title', e.target.value)} className="w-full bg-transparent text-white text-lg font-black outline-none border-b border-zinc-600 pb-2 focus:border-amber-500 transition-colors" placeholder="Nombre del día..." />
                                  <div className="flex gap-3 items-center">
                                    <input key={`dayedit-focus-${editingDayId}`} defaultValue={String(day?.focus || "")} onBlur={e => modifyDayData(editingDayId, 'focus', e.target.value)} placeholder="Focus..." className="flex-1 bg-zinc-900 px-3 py-2 rounded-xl text-xs text-zinc-300 outline-none border border-zinc-700 focus:border-amber-500" />
                                    <button onClick={() => removeDayFromRoutine(editingDayId)} className="bg-red-500/10 text-red-400 px-3 py-2 rounded-xl text-[9px] font-bold active:scale-95 flex items-center gap-1 border border-red-500/20 hover:bg-red-500/20"><Trash2 size={12}/> Eliminar día</button>
                                  </div>
                                  {/* Icon dropdown */}
                                  <div>
                                    <button onClick={() => setIconDropdownOpen(iconDropdownOpen === editingDayId ? null : editingDayId)} className="flex items-center gap-2 w-full text-left p-2 rounded-lg bg-zinc-700/30 hover:bg-zinc-700/50 transition-all">
                                      {(() => { const EditDayIcon = getDayIcon(day?.icon); return <EditDayIcon size={14} className="text-amber-500" />; })()}
                                      <span className="text-[8px] text-zinc-400 font-bold uppercase flex-1">Cambiar icono</span>
                                      <ChevronRight size={12} className={`text-zinc-500 transition-transform ${iconDropdownOpen === editingDayId ? 'rotate-90' : ''}`} />
                                    </button>
                                    {iconDropdownOpen === editingDayId && (
                                      <div className="mt-2 p-2 bg-zinc-900 rounded-xl border border-zinc-700 animate-in slide-in-from-top-2 duration-200">
                                        <div className="grid grid-cols-6 gap-1.5">
                                          {DAY_ICON_OPTIONS.map(opt => {
                                            const OptIcon = opt.icon;
                                            const isSelected = (day?.icon || "dumbbell") === opt.id;
                                            return (
                                              <button key={opt.id} title={opt.label} onClick={() => { updateUserInCloud(editingClientId, u => { const days = [...(Array.isArray(u.workoutData?.days) ? u.workoutData.days : [])]; const di = days.findIndex(d => d.id === editingDayId); if(di > -1) days[di] = { ...days[di], icon: opt.id }; return { ...u, workoutData: { ...u.workoutData, days } }; }); setIconDropdownOpen(null); }} className={`p-1.5 rounded-lg transition-all ${isSelected ? 'bg-amber-500 text-black scale-110' : 'bg-zinc-700/50 text-zinc-400 hover:bg-zinc-600 hover:text-white'}`}>
                                                <OptIcon size={14} />
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Ejercicios en formato visual (como las ve el cliente) */}
                                <div className="space-y-6">
                                  {exercises.map((ex, idx) => (
                                    <div key={idx} className="bg-zinc-900 rounded-[2rem] border border-zinc-800 overflow-hidden shadow-lg">
                                      {/* Imagen del ejercicio */}
                                      <div className="relative h-44 bg-zinc-800">
                                        <img src={ex.img || FALLBACK_IMG} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" onError={imgError} />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent" />
                                        {/* Controles del ejercicio */}
                                        <div className="absolute top-3 left-3 flex gap-2">
                                          <button onClick={() => { setImageManagerTarget({ dayId: editingDayId, exName: ex.name }); setImageManagerOpen(true); }} className="bg-black/60 backdrop-blur-sm p-2 rounded-xl text-white flex items-center gap-1 active:scale-95"><Camera size={14}/><span className="text-[8px] font-bold">Imagen</span></button>
                                        </div>
                                        <div className="absolute top-3 right-3 flex gap-1.5">
                                          {idx > 0 && <button onClick={() => updateUserInCloud(editingClientId, u => { const days = [...(u.workoutData?.days || [])]; const dIdx = days.findIndex(d => d.id === editingDayId); if(dIdx > -1) { const exes = [...(days[dIdx].exercises || [])]; [exes[idx-1], exes[idx]] = [exes[idx], exes[idx-1]]; days[dIdx].exercises = exes; } return { ...u, workoutData: { ...u.workoutData, days } }; })} className="bg-black/60 backdrop-blur-sm p-2 rounded-xl text-amber-500 active:scale-90"><ArrowLeft size={14}/></button>}
                                          {idx < exercises.length - 1 && <button onClick={() => updateUserInCloud(editingClientId, u => { const days = [...(u.workoutData?.days || [])]; const dIdx = days.findIndex(d => d.id === editingDayId); if(dIdx > -1) { const exes = [...(days[dIdx].exercises || [])]; [exes[idx], exes[idx+1]] = [exes[idx+1], exes[idx]]; days[dIdx].exercises = exes; } return { ...u, workoutData: { ...u.workoutData, days } }; })} className="bg-black/60 backdrop-blur-sm p-2 rounded-xl text-amber-500 active:scale-90"><ChevronRight size={14}/></button>}
                                          <button onClick={() => setAdminEditingExIdx(adminEditingExIdx === idx ? null : idx)} className={`backdrop-blur-sm p-2 rounded-xl active:scale-90 ${adminEditingExIdx === idx ? 'bg-amber-500 text-black' : 'bg-black/60 text-white'}`}><Edit3 size={14}/></button>
                                          <button onClick={() => removeExerciseFromDay(editingDayId, idx)} className="bg-red-500/80 backdrop-blur-sm p-2 rounded-xl text-white active:scale-90"><Trash2 size={14}/></button>
                                        </div>
                                        {/* Info del ejercicio sobre la imagen */}
                                        <div className="absolute bottom-3 left-4 text-white">
                                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-500 text-black inline-block mb-1">{String(ex.mus || "Fuerza")}</span>
                                          <h4 className="text-lg font-black leading-tight">{String(ex.name || "")}</h4>
                                        </div>
                                        {ex.yt && <a href={ex.yt} target="_blank" rel="noreferrer" className="absolute bottom-3 right-4 bg-white/20 p-2.5 rounded-xl text-white hover:bg-red-500 transition-colors"><Youtube size={18}/></a>}
                                      </div>

                                      {/* Info rápida: Series y Reps */}
                                      <div className="p-5">
                                        <div className="grid grid-cols-2 gap-3 mb-4">
                                          <div className="bg-zinc-800 p-3 rounded-xl text-center">
                                            <p className="text-[9px] text-zinc-500 font-bold uppercase">Series</p>
                                            <p className="text-xl font-black text-amber-500">{String(ex.s || 3)}</p>
                                          </div>
                                          <div className="bg-zinc-800 p-3 rounded-xl text-center">
                                            <p className="text-[9px] text-zinc-500 font-bold uppercase">Reps</p>
                                            <p className="text-xl font-black text-amber-500">{String(ex.r || "12")}</p>
                                          </div>
                                        </div>
                                        {ex.tip && (
                                          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex gap-3 mt-4">
                                            <Info size={16} className="text-amber-500 shrink-0 mt-0.5"/>
                                            <p className="text-xs italic text-zinc-400 leading-relaxed">"{String(ex.tip)}"</p>
                                          </div>
                                        )}

                                        {/* Panel de edición expandible */}
                                        {adminEditingExIdx === idx && (
                                          <div className="mt-4 pt-4 border-t border-zinc-700 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                            <div>
                                              <label className="text-[8px] text-amber-500 uppercase font-black block mb-1">Nombre</label>
                                              <input key={`ex-name-${editingDayId}-${idx}`} defaultValue={String(ex.name || "")} onBlur={e => modifyExerciseData(editingDayId, idx, 'name', e.target.value)} className="w-full bg-zinc-800 p-3 rounded-xl font-bold text-white text-sm outline-none border border-zinc-700 focus:border-amber-500" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                              <div>
                                                <label className="text-[8px] text-amber-500 uppercase font-black block mb-1">Series</label>
                                                <input type="number" key={`ex-s-${editingDayId}-${idx}`} defaultValue={String(ex.s || 3)} onBlur={e => modifyExerciseData(editingDayId, idx, 's', e.target.value)} className="w-full bg-zinc-800 p-3 rounded-xl text-white text-sm outline-none border border-zinc-700 focus:border-amber-500" />
                                              </div>
                                              <div>
                                                <label className="text-[8px] text-amber-500 uppercase font-black block mb-1">Reps</label>
                                                <input key={`ex-r-${editingDayId}-${idx}`} defaultValue={String(ex.r || "12")} onBlur={e => modifyExerciseData(editingDayId, idx, 'r', e.target.value)} className="w-full bg-zinc-800 p-3 rounded-xl text-white text-sm outline-none border border-zinc-700 focus:border-amber-500" />
                                              </div>
                                            </div>
                                            <div>
                                              <label className="text-[8px] text-amber-500 uppercase font-black block mb-1">Grupo muscular</label>
                                              <input key={`ex-mus-${editingDayId}-${idx}`} defaultValue={String(ex.mus || "")} onBlur={e => modifyExerciseData(editingDayId, idx, 'mus', e.target.value)} className="w-full bg-zinc-800 p-3 rounded-xl text-white text-xs outline-none border border-zinc-700 focus:border-amber-500" />
                                            </div>
                                            <div>
                                              <label className="text-[8px] text-amber-500 uppercase font-black block mb-1">Link YouTube</label>
                                              <input key={`ex-yt-${editingDayId}-${idx}`} defaultValue={String(ex.yt || "")} onBlur={e => modifyExerciseData(editingDayId, idx, 'yt', e.target.value)} placeholder="https://..." className="w-full bg-zinc-800 p-3 rounded-xl text-white text-xs outline-none border border-zinc-700 focus:border-amber-500" />
                                            </div>
                                            <div>
                                              <label className="text-[8px] text-amber-500 uppercase font-black block mb-1">Tip / Consejo</label>
                                              <textarea key={`ex-tip-${editingDayId}-${idx}`} defaultValue={String(ex.tip || "")} onBlur={e => modifyExerciseData(editingDayId, idx, 'tip', e.target.value)} className="w-full bg-zinc-800 p-3 rounded-xl text-white text-xs outline-none border border-zinc-700 focus:border-amber-500" rows="2" />
                                            </div>
                                            <button onClick={() => setAdminEditingExIdx(null)} className="w-full bg-amber-500 text-black font-black py-2.5 rounded-xl text-[10px] uppercase active:scale-95">✓ Listo</button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* BOTÓN AÑADIR EJERCICIO */}
                                <button onClick={() => setShowAddExercisePanel(!showAddExercisePanel)} className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 active:scale-95 transition-all border-2 border-dashed ${showAddExercisePanel ? 'bg-amber-500 text-black border-amber-500' : 'bg-zinc-900 text-amber-500 border-amber-500/30 hover:border-amber-500/60'}`}>
                                  <Plus size={16}/> Añadir Ejercicio
                                </button>

                                {/* Panel de selección de ejercicio */}
                                {showAddExercisePanel && (
                                  <div className="bg-zinc-800/90 backdrop-blur-sm p-6 rounded-2xl border border-zinc-700 space-y-4 animate-in slide-in-from-bottom-4 duration-300">

                                    {/* Mis ejercicios guardados (biblioteca personal) */}
                                    {customExercises.length > 0 && (
                                      <div className="space-y-2">
                                        <button onClick={() => setShowCustomLibrary(!showCustomLibrary)} className="w-full flex items-center justify-between text-left">
                                          <p className="text-[9px] text-amber-500 font-black uppercase flex items-center gap-1.5">📚 Mi biblioteca ({customExercises.length})</p>
                                          <ChevronRight size={14} className={`text-amber-500 transition-transform ${showCustomLibrary ? 'rotate-90' : ''}`} />
                                        </button>
                                        {showCustomLibrary && (
                                          <div className="space-y-2 max-h-60 overflow-y-auto">
                                            {customExercises.map((ce, ceIdx) => (
                                              <div key={ceIdx} className="relative">
                                                {editingCustomExIdx === ceIdx ? (
                                                  <div className="bg-zinc-900 p-3 rounded-xl border border-amber-500/50 space-y-2">
                                                    <input defaultValue={ce.name} onBlur={e => { if(e.target.value.trim()) updateCustomExercise(ceIdx, { ...ce, name: e.target.value }); }} className="w-full bg-zinc-800 p-2 rounded-lg text-white text-xs outline-none border border-zinc-700" />
                                                    <div className="grid grid-cols-3 gap-1.5">
                                                      <input type="number" defaultValue={ce.s} onBlur={e => updateCustomExercise(ceIdx, { ...ce, s: parseInt(e.target.value) || 3 })} className="bg-zinc-800 p-1.5 rounded-lg text-white text-[10px] outline-none border border-zinc-700 text-center" placeholder="Series" />
                                                      <input defaultValue={ce.r} onBlur={e => updateCustomExercise(ceIdx, { ...ce, r: e.target.value })} className="bg-zinc-800 p-1.5 rounded-lg text-white text-[10px] outline-none border border-zinc-700 text-center" placeholder="Reps" />
                                                      <input defaultValue={ce.mus} onBlur={e => updateCustomExercise(ceIdx, { ...ce, mus: e.target.value })} className="bg-zinc-800 p-1.5 rounded-lg text-white text-[10px] outline-none border border-zinc-700 text-center" placeholder="Grupo" />
                                                    </div>
                                                    <input defaultValue={ce.tip} onBlur={e => updateCustomExercise(ceIdx, { ...ce, tip: e.target.value })} className="w-full bg-zinc-800 p-1.5 rounded-lg text-white text-[10px] outline-none border border-zinc-700" placeholder="Tip" />
                                                    <input defaultValue={ce.yt} onBlur={e => updateCustomExercise(ceIdx, { ...ce, yt: e.target.value })} className="w-full bg-zinc-800 p-1.5 rounded-lg text-white text-[10px] outline-none border border-zinc-700" placeholder="YouTube URL" />
                                                    <div className="flex gap-2">
                                                      <button onClick={() => setEditingCustomExIdx(null)} className="flex-1 bg-amber-500 text-black font-bold py-1.5 rounded-lg text-[9px] uppercase active:scale-95">✓ Listo</button>
                                                      <button onClick={() => { deleteCustomExercise(ceIdx); setEditingCustomExIdx(null); }} className="bg-red-500/20 text-red-400 font-bold py-1.5 px-3 rounded-lg text-[9px] uppercase active:scale-95">🗑</button>
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <div className="flex items-center gap-3 bg-zinc-900 p-3 rounded-xl border border-amber-500/20">
                                                    <img src={ce.img || FALLBACK_IMG} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" loading="lazy" onError={imgError} />
                                                    <button onClick={() => {
                                                      const exToAdd = { name: ce.name, s: ce.s || 3, r: ce.r || "12", tip: ce.tip || "", mus: ce.mus || "", yt: ce.yt || "", img: ce.img || "" };
                                                      updateUserInCloud(editingClientId, u => { const days = [...(Array.isArray(u.workoutData?.days) ? u.workoutData.days : [])]; const dIdx = days.findIndex(d => d.id === editingDayId); if(dIdx > -1) days[dIdx].exercises = [...(Array.isArray(days[dIdx].exercises) ? days[dIdx].exercises : []), { ...exToAdd, name: sanitizeInput(exToAdd.name), mus: sanitizeInput(exToAdd.mus), tip: sanitizeInput(exToAdd.tip) }]; return { ...u, workoutData: { ...u.workoutData, days } }; });
                                                      showSuccess("Ejercicio agregado ✓");
                                                    }} className="flex-1 min-w-0 text-left">
                                                      <p className="text-sm font-bold text-white truncate">{ce.name}</p>
                                                      <p className="text-[9px] text-zinc-500">{ce.mus}{ce.tip ? ` · ${ce.tip}` : ''}</p>
                                                      <p className="text-[8px] text-zinc-600">{ce.s || 3}×{ce.r || '12'}</p>
                                                    </button>
                                                    <button onClick={() => setEditingCustomExIdx(ceIdx)} className="text-zinc-500 hover:text-amber-500 p-1 transition-colors"><Edit3 size={14}/></button>
                                                    <Plus size={18} className="text-amber-500 shrink-0"/>
                                                  </div>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Filtro por grupo muscular - visual con chips */}
                                    <div>
                                      <p className="text-[9px] text-zinc-500 font-bold uppercase mb-2">Ejercicios predefinidos:</p>
                                      <div className="flex flex-wrap gap-2">
                                        {GRUPOS_MUSCULARES.map(g => (
                                          <button key={g} onClick={() => { setSelectedMusculoGroup(g); setSelectedExerciseTemplate(""); }} className={`text-[9px] font-bold px-3 py-1.5 rounded-full transition-all active:scale-95 flex items-center gap-1 ${selectedMusculoGroup === g ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'}`}><span>{GRUPO_EMOJI[g] || '•'}</span> {g}</button>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Grid visual de ejercicios disponibles */}
                                    {selectedMusculoGroup && (
                                      <div className="space-y-3 max-h-80 overflow-y-auto">
                                        {[...EJERCICIOS_PREDEFINIDOS, ...ATHLOS_FORGE_EXERCISES, ...customExercises].filter(e => e.mus === selectedMusculoGroup).filter((e, i, arr) => arr.findIndex(x => x.name === e.name) === i).map(tmpl => {
                                          const isCustom = customExercises.some(c => c.name === tmpl.name);
                                          const resolvedImg = customExerciseImages[tmpl.name] || tmpl.img;
                                          return (
                                          <button key={tmpl.name} onClick={() => {
                                            const tip = tmpl.coaching || tmpl.tip || "";
                                            const exToAdd = { name: tmpl.name, s: tmpl.s || 3, r: tmpl.r || "12", tip: tip, mus: tmpl.mus, yt: tmpl.yt, img: resolvedImg };
                                            updateUserInCloud(editingClientId, u => { const days = [...(Array.isArray(u.workoutData?.days) ? u.workoutData.days : [])]; const dIdx = days.findIndex(d => d.id === editingDayId); if(dIdx > -1) days[dIdx].exercises = [...(Array.isArray(days[dIdx].exercises) ? days[dIdx].exercises : []), { ...exToAdd, name: sanitizeInput(exToAdd.name), mus: sanitizeInput(exToAdd.mus), tip: sanitizeInput(exToAdd.tip) }]; return { ...u, workoutData: { ...u.workoutData, days } }; });
                                            showSuccess("Ejercicio agregado ✓");
                                          }} className="w-full flex items-center gap-3 bg-zinc-900 p-3 rounded-xl border border-zinc-700 hover:border-amber-500/50 active:scale-[0.98] transition-all text-left">
                                            <img src={resolvedImg || FALLBACK_IMG} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" loading="lazy" onError={imgError} />
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-bold text-white truncate">{isCustom && <span className="text-amber-500 text-[8px] mr-1">📚</span>}{tmpl.name}</p>
                                              <p className="text-[9px] text-zinc-500">{tmpl.coaching || tmpl.tip || tmpl.mus}</p>
                                            </div>
                                            <Plus size={18} className="text-amber-500 shrink-0"/>
                                          </button>
                                        );})}
                                      </div>
                                    )}

                                    {/* Ejercicio personalizado */}
                                    <div className="border-t border-zinc-700 pt-4 space-y-3">
                                      <p className="text-[9px] text-zinc-500 font-bold uppercase">✏️ Crear ejercicio nuevo:</p>
                                      
                                      {/* Hero image area */}
                                      <button onClick={() => { setNewExImageMode(true); setImageManagerTarget({ dayId: null, exName: newEx.name || 'Nuevo ejercicio' }); setImageManagerOpen(true); }} className="w-full relative rounded-2xl overflow-hidden active:scale-[0.98] transition-all group">
                                        {newEx.img ? (
                                          <div className="relative">
                                            <img src={newEx.img} alt="" className="w-full h-32 object-cover" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                                            <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                                              <Camera size={12} className="text-amber-500"/>
                                              <span className="text-[9px] text-white font-bold">Cambiar</span>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="w-full h-28 border-2 border-dashed border-zinc-700 group-hover:border-amber-500/50 rounded-2xl flex flex-col items-center justify-center gap-2 bg-zinc-900/50 transition-colors">
                                            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                                              <Camera size={18} className="text-amber-500"/>
                                            </div>
                                            <span className="text-[10px] text-zinc-500 font-medium">Toca para añadir imagen</span>
                                          </div>
                                        )}
                                      </button>

                                      <input type="text" placeholder="Nombre del ejercicio..." maxLength="50" className="w-full bg-zinc-900 p-3 rounded-xl text-white text-sm outline-none border border-zinc-700 focus:border-amber-500" value={newEx.name} onChange={e => setNewEx({...newEx, name: e.target.value})} />
                                      
                                      {/* Muscle group visual chips */}
                                      <div>
                                        <label className="text-[7px] text-zinc-600 uppercase font-bold block mb-1.5 ml-1">Grupo muscular</label>
                                        {addingNewMusGroup ? (
                                          <div className="flex gap-2 items-center">
                                            <input type="text" placeholder="Nombre del nuevo grupo..." value={newEx.mus} onChange={e => setNewEx({...newEx, mus: e.target.value})} maxLength="30" className="flex-1 bg-zinc-900 p-2.5 rounded-xl text-white text-xs outline-none border border-amber-500 text-center" autoFocus />
                                            <button onClick={() => setAddingNewMusGroup(false)} className="bg-amber-500 text-black font-bold text-[10px] px-3 py-2.5 rounded-xl active:scale-95">✓</button>
                                            <button onClick={() => { setNewEx({...newEx, mus: ''}); setAddingNewMusGroup(false); }} className="text-zinc-500 text-[10px] font-bold px-2 py-2.5">✕</button>
                                          </div>
                                        ) : (
                                          <div className="flex flex-wrap gap-1.5">
                                            {GRUPOS_MUSCULARES.map(g => (
                                              <button key={g} onClick={() => setNewEx({...newEx, mus: g})} className={`text-[9px] font-bold px-2.5 py-1.5 rounded-full transition-all active:scale-95 flex items-center gap-1 ${newEx.mus === g ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
                                                <span>{GRUPO_EMOJI[g] || '•'}</span> {g}
                                              </button>
                                            ))}
                                            <button onClick={() => { setNewEx({...newEx, mus: ''}); setAddingNewMusGroup(true); }} className="text-[9px] font-bold px-2.5 py-1.5 rounded-full bg-zinc-800 text-zinc-500 hover:bg-zinc-700 active:scale-95 border border-dashed border-zinc-600">+ Nuevo</button>
                                          </div>
                                        )}
                                      </div>

                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="text-[7px] text-zinc-600 uppercase font-bold block mb-0.5 ml-1">Series</label>
                                          <input type="number" placeholder="3" value={newEx.s} onChange={e => setNewEx({...newEx, s: parseInt(e.target.value) || 3})} className="w-full bg-zinc-900 p-2.5 rounded-xl text-white text-xs outline-none border border-zinc-700 text-center" />
                                        </div>
                                        <div>
                                          <label className="text-[7px] text-zinc-600 uppercase font-bold block mb-0.5 ml-1">Reps</label>
                                          <input type="text" placeholder="12" value={newEx.r} onChange={e => setNewEx({...newEx, r: e.target.value})} className="w-full bg-zinc-900 p-2.5 rounded-xl text-white text-xs outline-none border border-zinc-700 text-center" />
                                        </div>
                                      </div>
                                      <input type="text" placeholder="💡 Tip / Consejo (ej: RIR 1, no bloquear codos...)" value={newEx.tip} onChange={e => setNewEx({...newEx, tip: e.target.value})} maxLength="200" className="w-full bg-zinc-900 p-2.5 rounded-xl text-white text-xs outline-none border border-zinc-700" />
                                      <input type="url" placeholder="🎬 YouTube URL (opcional)" value={newEx.yt} onChange={e => setNewEx({...newEx, yt: e.target.value})} className="w-full bg-zinc-900 p-2.5 rounded-xl text-white text-xs outline-none border border-zinc-700" />
                                      
                                      {/* Live preview card */}
                                      {newEx.name?.trim() && (
                                        <div className="bg-zinc-900/80 rounded-2xl border border-amber-500/20 overflow-hidden">
                                          <div className="px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/10">
                                            <p className="text-[8px] text-amber-500 font-bold uppercase">Vista previa</p>
                                          </div>
                                          <div className="flex items-center gap-3 p-3">
                                            <img src={newEx.img || FALLBACK_IMG} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0 border border-zinc-700" onError={imgError} />
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-bold text-white truncate">{newEx.name}</p>
                                              <div className="flex items-center gap-2 mt-0.5">
                                                {newEx.mus && <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-md font-medium">{GRUPO_EMOJI[newEx.mus] || '•'} {newEx.mus}</span>}
                                                <span className="text-[9px] text-zinc-500 font-medium">{newEx.s}×{newEx.r}</span>
                                              </div>
                                              {newEx.tip && <p className="text-[8px] text-zinc-500 mt-0.5 truncate">💡 {newEx.tip}</p>}
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      <div className="flex gap-2">
                                        <button onClick={() => { if(newEx.name?.trim()) { updateUserInCloud(editingClientId, u => { const days = [...(Array.isArray(u.workoutData?.days) ? u.workoutData.days : [])]; const dIdx = days.findIndex(d => d.id === editingDayId); if(dIdx > -1) days[dIdx].exercises = [...(Array.isArray(days[dIdx].exercises) ? days[dIdx].exercises : []), { ...newEx, name: sanitizeInput(newEx.name), mus: sanitizeInput(newEx.mus), tip: sanitizeInput(newEx.tip), yt: newEx.yt ? sanitizeUrl(newEx.yt) : '', img: newEx.img || '' }]; return { ...u, workoutData: { ...u.workoutData, days } }; }); setNewEx({ name: "", s: 3, r: "12", tip: "", mus: "", yt: "", img: "" }); showSuccess("Ejercicio agregado ✓"); } }} className="flex-1 bg-amber-500 text-black font-black py-3 rounded-xl text-[10px] uppercase active:scale-95 flex items-center justify-center gap-1"><Plus size={14}/> Añadir</button>
                                        <button onClick={() => { if(newEx.name?.trim()) { saveCustomExercise(newEx); updateUserInCloud(editingClientId, u => { const days = [...(Array.isArray(u.workoutData?.days) ? u.workoutData.days : [])]; const dIdx = days.findIndex(d => d.id === editingDayId); if(dIdx > -1) days[dIdx].exercises = [...(Array.isArray(days[dIdx].exercises) ? days[dIdx].exercises : []), { ...newEx, name: sanitizeInput(newEx.name), mus: sanitizeInput(newEx.mus), tip: sanitizeInput(newEx.tip), yt: newEx.yt ? sanitizeUrl(newEx.yt) : '', img: newEx.img || '' }]; return { ...u, workoutData: { ...u.workoutData, days } }; }); setNewEx({ name: "", s: 3, r: "12", tip: "", mus: "", yt: "", img: "" }); } }} className="bg-purple-500 text-white font-black py-3 px-4 rounded-xl text-[10px] uppercase active:scale-95 flex items-center gap-1" title="Añadir y guardar en tu biblioteca">📚 Guardar</button>
                                      </div>
                                      <p className="text-[8px] text-zinc-600 text-center">📚 = Añadir al día + guardar en tu biblioteca para reusar</p>
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Streak counter + Weekly summary */}
            {!isAdminMode && (
                <div className="space-y-4 mt-6">
                  {streakCount > 0 && (
                    <div className="flex items-center gap-4 p-5 rounded-[2rem] border shadow-sm" style={palette ? { backgroundColor: palette.card, borderColor: `${palette.accent}25`, color: palette.text } : { backgroundColor: '#18181b', borderColor: '#27272a', color: 'white' }}>
                      <div className="text-4xl">🔥</div>
                      <div>
                        <p className="text-2xl font-black">{streakCount} <span className="text-sm font-bold opacity-60">{streakCount === 1 ? 'día' : 'días'} seguidos</span></p>
                        <p className="text-[10px] font-bold opacity-40 uppercase tracking-wider">¡Sigue así, máquina!</p>
                      </div>
                    </div>
                  )}
                  {(weeklySummary.daysThisWeek > 0 || weeklySummary.totalSets > 0) && (
                    <div className="p-5 rounded-[2rem] border shadow-sm" style={palette ? { backgroundColor: palette.card, borderColor: `${palette.accent}25`, color: palette.text } : { backgroundColor: '#18181b', borderColor: '#27272a', color: 'white' }}>
                      <div className="flex items-center gap-2 mb-4">
                        <CalendarDays size={16} style={palette ? { color: palette.accent } : { color: '#f59e0b' }}/>
                        <h3 className="text-[10px] font-black uppercase tracking-widest" style={palette ? { color: palette.accent } : { color: '#f59e0b' }}>Esta semana</h3>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-2xl font-black">{weeklySummary.daysThisWeek}</p>
                          <p className="text-[9px] font-bold opacity-40 uppercase">Días</p>
                        </div>
                        <div>
                          <p className="text-2xl font-black">{weeklySummary.totalSets}</p>
                          <p className="text-[9px] font-bold opacity-40 uppercase">Series</p>
                        </div>
                        <div>
                          <p className="text-2xl font-black">{weeklySummary.totalVolume > 1000 ? `${(weeklySummary.totalVolume / 1000).toFixed(1)}k` : weeklySummary.totalVolume}</p>
                          <p className="text-[9px] font-bold opacity-40 uppercase">Kg total</p>
                        </div>
                      </div>
                      {weeklySummary.volumeChange !== 0 && (
                        <div className={`mt-3 flex items-center justify-center gap-1 text-[10px] font-bold ${weeklySummary.volumeChange > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                          {weeklySummary.volumeChange > 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                          <span>{weeklySummary.volumeChange > 0 ? '+' : ''}{weeklySummary.volumeChange}% vs semana pasada</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 mt-8">
              {validDays.length === 0 && !isAdminMode ? (
                <div className="text-center py-10 opacity-40 font-bold text-sm italic">Rutina en construcción...</div>
              ) : null}
              {validDays.map(day => {
                const DayIcon = getDayIcon(day.icon);
                const isAdminEditing = isAdminMode && isEditingClientRoutine;
                const isDragging = draggedDayId === day.id;
                const isDragOver = dragOverDayId === day.id && draggedDayId !== day.id;
                const completedToday = !isAdminMode && isDayCompletedToday(day, workoutLogs);
                return (
                <button key={day.id} data-day-id={day.id}
                  onClick={() => { if (touchDragState) return; isAdminEditing ? setEditingDayId(day.id) : navigateTo("day", day); }}
                  draggable={isAdminEditing}
                  onDragStart={isAdminEditing ? (e) => { setDraggedDayId(day.id); e.dataTransfer.effectAllowed = 'move'; } : undefined}
                  onDragOver={isAdminEditing ? (e) => { e.preventDefault(); setDragOverDayId(day.id); } : undefined}
                  onDragEnd={isAdminEditing ? () => { if (draggedDayId && dragOverDayId && draggedDayId !== dragOverDayId) reorderDays(draggedDayId, dragOverDayId); setDraggedDayId(null); setDragOverDayId(null); } : undefined}
                  onTouchStart={isAdminEditing ? (e) => handleDayTouchStart(e, day.id) : undefined}
                  onTouchMove={isAdminEditing ? handleDayTouchMove : undefined}
                  onTouchEnd={isAdminEditing ? handleDayTouchEnd : undefined}
                  onTouchCancel={isAdminEditing ? () => { clearTimeout(touchTimerRef.current); setTouchDragState(null); setDraggedDayId(null); setDragOverDayId(null); } : undefined}
                  className={`flex items-center justify-between p-6 rounded-[2rem] border shadow-sm text-left transition-all ${isDragging ? 'opacity-40 scale-95' : 'active:scale-95'} ${isDragOver ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-zinc-900' : ''} ${completedToday ? 'ring-2 ring-emerald-500/40' : ''}`}
                  style={palette ? { backgroundColor: palette.card, borderColor: completedToday ? '#10b98140' : isDragOver ? '#f59e0b' : `${palette.accent}20`, color: palette.text } : isAdminMode ? { backgroundColor: '#18181b', borderColor: isDragOver ? '#f59e0b' : '#27272a', color: 'white' } : {}}>
                  <div className="flex items-center gap-4">
                    {isAdminEditing && <div className="text-zinc-600 touch-none"><GripVertical size={18}/></div>}
                    <div className="relative p-4 rounded-3xl" style={palette ? { backgroundColor: completedToday ? '#10b98120' : `${palette.accent}15`, color: completedToday ? '#10b981' : palette.accent } : isAdminMode ? { backgroundColor: '#27272a', color: '#f59e0b' } : { backgroundColor: completedToday ? '#dcfce7' : '#f9fafb', color: completedToday ? '#16a34a' : '#6b7280' }}>
                      <DayIcon size={28}/>
                      {completedToday && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
                          <CheckCircle2 size={12} className="text-white"/>
                        </div>
                      )}
                    </div><div><p className="text-[9px] font-black uppercase tracking-widest" style={palette ? { color: `${palette.text}70` } : {}}>{String(day.focus || "")}</p><h3 className="text-lg font-black tracking-tight">{String(day.title || "")}</h3>{completedToday && <p className="text-[8px] font-bold text-emerald-500 mt-0.5">✓ Hecho hoy</p>}</div></div>
                  <ChevronRight size={24} style={palette ? { color: `${palette.accent}60` } : {}}/>
                </button>
              );})}
            </div>

            {/* Client Settings Modal is rendered at the bottom with other modals */}

            {/* NEW: Admin Motivational Phrase Button */}
            {isAdminMode && (
              <button onClick={() => setShowMotivationalModal(true)} className="w-full flex items-center justify-between p-4 rounded-2xl border border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 transition-all active:scale-[0.98]">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📝</span>
                  <div className="text-left">
                    <p className="text-[10px] font-black uppercase text-amber-500">Frase Motivadora</p>
                    <p className="text-xs text-zinc-400 italic truncate max-w-[220px]">"{dailyMotivationalPhrase}"</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-zinc-600"/>
              </button>
            )}

            <div className="p-6 rounded-[2rem] border shadow-sm" style={palette ? { backgroundColor: `${palette.accent}10`, borderColor: `${palette.accent}25`, color: palette.text } : isAdminMode ? { backgroundColor: '#18181b', borderColor: '#27272a', color: 'white' } : {}}>
               <h3 className="text-[10px] font-black uppercase mb-2 flex items-center gap-2" style={palette ? { color: palette.accent } : { color: '#d97706' }}><LayoutDashboard size={14}/> Mensaje Coach</h3>
               <p className="text-sm italic font-medium leading-relaxed">"{String(client.advice || "")}"</p>
            </div>
          </div>
        )}

        {/* --- DÍA --- */}
        {activeTab === "day" && selectedDay && (
          <div className="space-y-8 animate-in slide-in-from-right-4 duration-500 relative pb-24 mt-4">
            {timerDuration && <GlobalRestTimer key={timerKey} initialSeconds={timerDuration} onCancel={() => setTimerDuration(null)} />}
            {sessionStart && (
               <div className="fixed top-0 left-0 w-full bg-zinc-900 text-white p-3 z-[70] flex justify-between items-center shadow-lg">
                  <div className="flex items-center gap-2 font-black text-sm tracking-widest text-green-400"><PlayCircle size={16} className="animate-pulse" /> {String(Math.floor(sessionElapsed/60))}:{(sessionElapsed%60).toString().padStart(2,'0')}</div>
                  <button onClick={() => { if (sessionElapsed > 60 && !window.confirm('¿Finalizar sesión?')) return; finishSession(); }} className="flex items-center gap-1 text-xs font-bold text-red-400 bg-white/10 px-3 py-1.5 rounded-full">FINALIZAR</button>
               </div>
            )}
            <div className="flex justify-between items-center mt-12">
               <button onClick={() => navigateTo("home")} className="text-zinc-400 font-bold text-sm uppercase flex items-center gap-2"><ArrowLeft size={16}/> Volver</button>
               {!sessionStart && <button onClick={() => { setSessionStart(Date.now()); setSessionElapsed(0); }} className="bg-amber-500 text-black text-[10px] font-black px-6 py-2 rounded-full uppercase shadow-lg">INICIAR CRONO</button>}
            </div>
            <h2 className="text-3xl font-black" style={palette ? { color: palette.text } : isAdminMode ? { color: 'white' } : { color: '#111827' }}>{String(selectedDay.title || "")}</h2>
            {selectedDay.warmupType && warmupData[selectedDay.warmupType] && (
              <div className="bg-zinc-900 text-white p-6 rounded-[2.5rem] shadow-xl border border-zinc-800">
                <h3 className="font-black text-xs uppercase tracking-widest flex items-center gap-2 mb-4"><Flame className="text-amber-500"/> {String(warmupData[selectedDay.warmupType].title || "Calentamiento")}</h3>
                <div className="space-y-3">
                   {(Array.isArray(warmupData[selectedDay.warmupType].steps) ? warmupData[selectedDay.warmupType].steps : []).map((s,i) => <div key={i} className="flex gap-3 text-[10px]"><div className="w-1 h-1 bg-amber-500 rounded-full mt-1.5 shrink-0" /><p><strong>{String(s.name || "")}:</strong> {String(s.detail || "")}</p></div>)}
                </div>
              </div>
            )}
            {/* Quick exercise search */}
            {(() => { const liveDay = validDays.find(d => d.id === selectedDay.id) || selectedDay; const allExercises = Array.isArray(liveDay.exercises) ? liveDay.exercises : []; return allExercises.length > 3 ? (
              <div className="relative">
                <Search size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 ${palette ? '' : isAdminMode ? 'text-zinc-500' : 'text-gray-400'}`} style={palette ? { color: `${palette.text}50` } : {}}/>
                <input type="text" placeholder="Buscar ejercicio..." value={daySearchQuery} onChange={e => setDaySearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3 rounded-2xl border text-sm font-medium outline-none" style={palette ? { backgroundColor: palette.card, borderColor: `${palette.accent}20`, color: palette.text } : isAdminMode ? { backgroundColor: '#18181b', borderColor: '#27272a', color: 'white' } : { backgroundColor: '#f9fafb', borderColor: '#f3f4f6', color: '#111827' }} />
              </div>
            ) : null; })()}
            <div className="space-y-4">
              {(() => { const liveDay = validDays.find(d => d.id === selectedDay.id) || selectedDay; const allExercises = Array.isArray(liveDay.exercises) ? liveDay.exercises : []; const filtered = daySearchQuery.trim() ? allExercises.filter(ex => (ex.name || '').toLowerCase().includes(daySearchQuery.toLowerCase()) || (ex.mus || '').toLowerCase().includes(daySearchQuery.toLowerCase())) : allExercises; return filtered.map((ex, i) => {
                const originalIdx = allExercises.indexOf(ex);
                return (
                <ExerciseCard key={`${liveDay.id}-${originalIdx}`} ex={ex} workoutLogs={workoutLogs} isAdmin={isAdminMode} onAddLog={addLogRecord} onDeleteLog={deleteLogRecord} onStartTimer={startTimerHook} accentColor={client.color} onUpdateImage={updateImageHook} onOpenImageManager={openImageManagerCb} dayId={liveDay.id} onAddExerciseNote={addExerciseNote} exerciseNotes={client.exerciseNotes?.[ex.name] || []} />
              ); }); })()}
            </div>
          </div>
        )}

        {/* --- STATS --- */}
        {activeTab === "stats" && (
          <div className="space-y-8 animate-in fade-in duration-500 mt-4">
            <h2 className="text-2xl font-black">Evolución</h2>
            <div className="flex gap-2 p-1 rounded-xl" style={palette ? { backgroundColor: palette.card, border: `1px solid ${palette.accent}20` } : isAdminMode ? { backgroundColor: '#18181b', border: '1px solid #27272a' } : { backgroundColor: '#f3f4f6' }}>
               <button onClick={() => setChartMode('weight')} className={`flex-1 py-2 text-[10px] font-bold rounded-lg`} style={chartMode==='weight' ? { backgroundColor: palette?.accent || (isAdminMode ? '#f59e0b' : '#ffffff'), color: palette ? palette.dark : (isAdminMode ? 'black' : '#18181b'), boxShadow: '0 1px 3px rgba(0,0,0,0.2)' } : { color: `${palette?.text || '#71717a'}80` }}>PESO MÁX</button>
               <button onClick={() => setChartMode('volume')} className={`flex-1 py-2 text-[10px] font-bold rounded-lg`} style={chartMode==='volume' ? { backgroundColor: palette?.accent || (isAdminMode ? '#f59e0b' : '#ffffff'), color: palette ? palette.dark : (isAdminMode ? 'black' : '#18181b'), boxShadow: '0 1px 3px rgba(0,0,0,0.2)' } : { color: `${palette?.text || '#71717a'}80` }}>VOLUMEN</button>
            </div>
            {Object.keys(workoutLogs).length === 0 && <div className="text-center py-20 opacity-30 italic">No hay datos registrados aún.</div>}
            {validDays.map(d => (Array.isArray(d.exercises) ? d.exercises : []).map((ex,i) => {
               const logsRaw = workoutLogs[ex.name];
               const l = Array.isArray(logsRaw) ? logsRaw : []; 
               if(l.length < 1) return null;
               const displayVal = chartMode === 'volume' ? (parseFloat(l[0]?.weight) || 0) * (parseInt(l[0]?.reps) || 10) * (parseInt(ex.s) || 3) : Math.max(...l.map(x=>parseFloat(x.weight) || 0));
               return (
                 <div key={`${d.id}-${i}`} className={`${isAdminMode ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-gray-100 text-gray-900"} p-6 rounded-[2rem] shadow-sm border cursor-pointer active:scale-[0.98] transition-transform`} onClick={() => setExpandedStatsExercise({ name: ex.name, logs: l, sets: ex.s })}>
                    <div className="flex justify-between items-start mb-2"><div><span className="text-[8px] text-zinc-400 uppercase font-black">{String(d.title || "").split(":")[0]}</span><h4 className="text-lg font-black leading-tight">{String(ex.name || "")}</h4></div><div className="text-amber-500 font-black text-sm">{displayVal}kg</div></div>
                    <MiniProgressChart data={l} color={client.color} isAdmin={isAdminMode} mode={chartMode} exSets={ex.s} />
                    {l.length > 1 && (
                      <ProgressBar 
                        label={ex.name}
                        current={parseFloat(l[0]?.weight) || 0}
                        previous={l.length > 1 ? parseFloat(l[Math.min(5, l.length - 1)]?.weight) || parseFloat(l[0]?.weight) : parseFloat(l[0]?.weight)}
                        color={palette?.accent || (isAdminMode ? "#f59e0b" : "#3b82f6")}
                      />
                    )}
                    <p className="text-[8px] text-zinc-500 text-center mt-2 font-medium">Toca para ver gráfico completo</p>
                 </div>
               );
            }))}
          </div>
        )}

        {/* --- DIARIO --- */}
        {activeTab === "journal" && (
          <div className="space-y-8 animate-in fade-in duration-500 mt-4">
            <h2 className="text-2xl font-black">Diario</h2>
            <div className="p-6 rounded-[2rem] border shadow-sm space-y-3" style={palette ? { backgroundColor: palette.card, borderColor: `${palette.accent}20`, color: palette.text } : isAdminMode ? { backgroundColor: '#18181b', borderColor: '#27272a', color: 'white' } : { backgroundColor: 'white', borderColor: '#f3f4f6', color: '#111827' }}>
               <textarea placeholder="¿Cómo te has sentido hoy?..." className="w-full border rounded-xl p-4 text-xs font-medium outline-none h-24" style={palette ? { backgroundColor: palette.dark, borderColor: `${palette.accent}30`, color: palette.text } : isAdminMode ? { backgroundColor: '#09090b', borderColor: '#27272a', color: 'white' } : { backgroundColor: '#f9fafb', borderColor: '#f3f4f6', color: '#111827' }} value={noteText} onChange={e => setNoteText(e.target.value)} />
               <button onClick={addNoteRecord} className="w-full font-black py-4 rounded-xl text-[10px] uppercase" style={palette ? { backgroundColor: palette.accent, color: palette.dark } : isAdminMode ? { backgroundColor: '#f59e0b', color: 'black' } : { backgroundColor: '#2563eb', color: 'white' }}>Guardar Nota</button>
            </div>
            <div className="space-y-4">
              {validNotes.map(n => (
                <div key={n.id} className="p-5 rounded-[1.5rem] border shadow-sm flex flex-col gap-3" style={palette ? { backgroundColor: palette.card, borderColor: `${palette.accent}15`, color: palette.text } : isAdminMode ? { backgroundColor: '#18181b', borderColor: '#27272a', color: '#d4d4d8' } : { backgroundColor: 'white', borderColor: '#fafafa', color: '#374151' }}>
                   <div className="flex justify-between items-start w-full"><p className="text-sm leading-relaxed pr-4">{String(n.text || "")}</p><button onClick={() => updateUserInCloud(currentClientId, u => ({...u, notes: (Array.isArray(u.notes) ? u.notes : []).filter(x => x.id !== n.id)}))} className="text-red-400"><Trash2 size={14}/></button></div>
                   <div className="flex justify-between items-center"><span className="text-[9px] font-black" style={{ color: `${palette?.text || '#a1a1aa'}60` }}>{String(n.date || "")}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- MI PROGRESO --- */}
        {activeTab === "progress" && (
          <div className="space-y-8 animate-in fade-in duration-500 mt-4">
            <h2 className="text-2xl font-black">Mi Progreso</h2>
            <ProgressTracker
              stats={Array.isArray(client.userStats) ? client.userStats : []}
              onAddStats={addUserStats}
              palette={palette}
              isAdmin={isAdminMode}
            />
            <div className="h-px" style={{ backgroundColor: `${palette?.text || '#fff'}10` }}/>
            <PhotoComparator
              progressPhotos={Array.isArray(client.progressPhotos) ? client.progressPhotos : []}
              onSavePhotos={addProgressPhotos}
              palette={palette}
            />
          </div>
        )}

      </div>

      <nav className="fixed bottom-14 left-1/2 -translate-x-1/2 backdrop-blur-md border px-6 py-5 rounded-[2.5rem] shadow-2xl flex items-center gap-6 z-50" style={palette ? { backgroundColor: `${palette.card}ee`, borderColor: `${palette.accent}20` } : isAdminMode ? { backgroundColor: '#18181bee', borderColor: '#27272a' } : { backgroundColor: '#ffffffee', borderColor: '#f3f4f6' }}>
        <button onClick={() => navigateTo("home")} className="transition-all flex flex-col items-center gap-0.5" style={activeTab === "home" ? { color: palette?.accent || '#f59e0b', transform: 'scale(1.25)' } : { color: `${palette?.text || '#a1a1aa'}60` }}><User size={22} /><span className="text-[8px] font-bold leading-none">Home</span></button>
        <button onClick={() => { if(selectedDay) navigateTo("day", selectedDay); else if(validDays.length>0) navigateTo("day", validDays[0]); }} className="transition-all flex flex-col items-center gap-0.5" style={activeTab === "day" ? { color: palette?.accent || '#f59e0b', transform: 'scale(1.25)' } : { color: `${palette?.text || '#a1a1aa'}60` }}><Dumbbell size={22} /><span className="text-[8px] font-bold leading-none">Rutina</span></button>
        <button onClick={() => navigateTo("stats")} className="transition-all flex flex-col items-center gap-0.5" style={activeTab === "stats" ? { color: palette?.accent || '#f59e0b', transform: 'scale(1.25)' } : { color: `${palette?.text || '#a1a1aa'}60` }}><TrendingUp size={22} /><span className="text-[8px] font-bold leading-none">Stats</span></button>
        <button onClick={() => navigateTo("progress")} className="transition-all flex flex-col items-center gap-0.5" style={activeTab === "progress" ? { color: palette?.accent || '#f59e0b', transform: 'scale(1.25)' } : { color: `${palette?.text || '#a1a1aa'}60` }}><Scale size={22} /><span className="text-[8px] font-bold leading-none">Cuerpo</span></button>
        <button onClick={() => navigateTo("journal")} className="transition-all flex flex-col items-center gap-0.5" style={activeTab === "journal" ? { color: palette?.accent || '#f59e0b', transform: 'scale(1.25)' } : { color: `${palette?.text || '#a1a1aa'}60` }}><Heart size={22} /><span className="text-[8px] font-bold leading-none">Diario</span></button>
      </nav>

      {/* --- MODALES --- */}

      {/* Client Settings Modal */}
      {showClientSettings && !isAdminMode && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setShowClientSettings(false); }}>
          <div className="w-full max-w-md rounded-t-[2.5rem] p-6 pb-10 space-y-6 shadow-2xl animate-in slide-in-from-bottom-10 duration-300 max-h-[85vh] overflow-y-auto" style={{ backgroundColor: palette?.card || '#1a1a1a', borderTop: `2px solid ${palette?.accent || '#D4AF37'}40` }}>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl" style={{ backgroundColor: `${palette?.accent || '#D4AF37'}20` }}>
                  <Settings size={18} style={{ color: palette?.accent || '#D4AF37' }}/>
                </div>
                <div>
                  <h3 className="font-black uppercase text-sm" style={{ color: palette?.accent || '#D4AF37' }}>Ajustes</h3>
                  <p className="text-[9px] opacity-60" style={{ color: palette?.text || '#fff' }}>Personaliza tu experiencia</p>
                </div>
              </div>
              <button onClick={() => setShowClientSettings(false)} className="p-2 rounded-full hover:opacity-70 transition-opacity" style={{ backgroundColor: `${palette?.text || '#fff'}10` }}><X size={18} style={{ color: `${palette?.text || '#fff'}80` }}/></button>
            </div>

            {/* Theme Selector */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-wider" style={{ color: `${palette?.text || '#fff'}60` }}>🎨 Tema de Color</h4>
              <div className="grid grid-cols-3 gap-3">
                {COLOR_PALETTES.map((p) => {
                  const isSelected = p.id === preferredPaletteId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setPreferredPaletteId(p.id);
                        saveUserColorPreference(loggedInUser, p.id);
                        showSuccess('Tema aplicado ✨');
                      }}
                      className="relative rounded-2xl p-3 transition-all active:scale-95"
                      style={{
                        backgroundColor: p.dark,
                        border: isSelected ? `2px solid ${p.accent}` : `1px solid ${p.accent}30`,
                        boxShadow: isSelected ? `0 0 20px ${p.accent}30` : 'none',
                      }}
                    >
                      {/* Color circles preview */}
                      <div className="flex justify-center gap-1.5 mb-2">
                        <div className="w-5 h-5 rounded-full" style={{ backgroundColor: p.dark, border: `1px solid ${p.text}30` }}/>
                        <div className="w-5 h-5 rounded-full" style={{ backgroundColor: p.card }}/>
                        <div className="w-5 h-5 rounded-full" style={{ backgroundColor: p.accent }}/>
                      </div>
                      <p className="text-[8px] font-bold text-center truncate" style={{ color: p.accent }}>{p.name}</p>
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: p.accent }}>
                          <CheckCircle2 size={12} style={{ color: p.dark }} strokeWidth={3}/>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="h-px" style={{ backgroundColor: `${palette?.text || '#fff'}10` }}/>

            {/* Password Change */}
            <button onClick={() => { setShowClientSettings(false); setShowPasswordModal(true); }} className="w-full flex items-center gap-4 p-4 rounded-2xl transition-all active:scale-95" style={{ backgroundColor: `${palette?.accent || '#D4AF37'}10`, border: `1px solid ${palette?.accent || '#D4AF37'}20` }}>
              <div className="p-2 rounded-xl" style={{ backgroundColor: `${palette?.accent || '#D4AF37'}20` }}>
                <Key size={16} style={{ color: palette?.accent || '#D4AF37' }}/>
              </div>
              <div className="text-left">
                <p className="text-xs font-bold" style={{ color: palette?.text || '#fff' }}>Cambiar contraseña</p>
                <p className="text-[9px]" style={{ color: `${palette?.text || '#fff'}50` }}>Actualizar tu contraseña de acceso</p>
              </div>
              <ChevronRight size={16} className="ml-auto" style={{ color: `${palette?.text || '#fff'}40` }}/>
            </button>
          </div>
        </div>
      )}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm">
           <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-[2rem] p-6 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center"><h3 className="text-amber-500 font-black uppercase text-sm">Contraseña</h3><button onClick={()=>setShowPasswordModal(false)}><X size={20} className="text-zinc-500"/></button></div>
              <input type="password" placeholder="Contraseña actual" className="w-full bg-zinc-800 border border-zinc-700 outline-none text-white p-4 rounded-xl text-xs" value={pwdCurrent} onChange={e=>setPwdCurrent(e.target.value)} />
              <input type="password" placeholder="Nueva contraseña" className="w-full bg-zinc-800 border border-zinc-700 outline-none text-white p-4 rounded-xl text-xs" value={pwdNew} onChange={e=>setPwdNew(e.target.value)} />
              <input type="password" placeholder="Repite nueva contraseña" className="w-full bg-zinc-800 border border-zinc-700 outline-none text-white p-4 rounded-xl text-xs" value={pwdConfirm} onChange={e=>setPwdConfirm(e.target.value)} />
              {pwdError && <p className="text-red-500 text-[10px] text-center">{String(pwdError)}</p>}
              {pwdSuccess && <p className="text-green-500 text-[10px] font-bold text-center">{String(pwdSuccess)}</p>}
              <button onClick={handleChangePassword} className="w-full bg-amber-500 text-black font-black py-4 rounded-xl text-[10px] uppercase">ACTUALIZAR</button>
           </div>
        </div>
      )}

      {showDeleteConfirmModal && clientToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm">
           <div className="bg-zinc-900 border border-red-800/50 w-full max-w-sm rounded-[2rem] p-6 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center"><h3 className="text-red-500 font-black uppercase text-sm flex items-center gap-2"><Trash2 size={18}/> Eliminar Cliente</h3><button onClick={()=>{setShowDeleteConfirmModal(false); setClientToDelete(null);}}><X size={20} className="text-zinc-500"/></button></div>
              <p className="text-zinc-300 text-sm">¿Eliminar permanentemente a <strong className="text-red-400">{String(clientToDelete)}</strong>? Esta acción no se puede deshacer.</p>
              <div className="flex gap-2">
                <button onClick={() => deleteClientFromAdmin(clientToDelete)} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black py-3 rounded-xl text-[10px] uppercase active:scale-95">SÍ, ELIMINAR</button>
                <button onClick={()=>{setShowDeleteConfirmModal(false); setClientToDelete(null);}} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-black py-3 rounded-xl text-[10px] uppercase">CANCELAR</button>
              </div>
           </div>
        </div>
      )}

      {/* Modal: Frases Motivadoras (Admin) */}
      {showMotivationalModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-t-[2rem] sm:rounded-[2rem] p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-amber-500 font-black uppercase text-sm flex items-center gap-2">📝 Frases Motivadoras</h3>
              <button onClick={() => setShowMotivationalModal(false)}><X size={20} className="text-zinc-500"/></button>
            </div>
            <AdminMotivationalManager
              currentPhrase={dailyMotivationalPhrase}
              allPhrases={allMotivationalPhrases}
              onSavePhrase={(data) => { saveMotivationalPhrase(data); }}
              onDeletePhrase={deleteMotivationalPhrase}
              colorPalette={getPaletteById(preferredPaletteId)}
            />
          </div>
        </div>
      )}

      {showAddClientModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm">
           <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-[2rem] p-6 space-y-4 shadow-2xl">
              <h3 className="text-amber-500 font-black uppercase text-sm text-center">Nuevo Cliente</h3>
              <input type="text" placeholder="Usuario" className="w-full bg-zinc-800 p-4 rounded-xl text-xs text-white outline-none" value={newClient.username} onChange={e=>setNewClient({...newClient, username:e.target.value})} />
              <input type="password" placeholder="Contraseña" className="w-full bg-zinc-800 p-4 rounded-xl text-xs text-white outline-none" value={newClient.password} onChange={e=>setNewClient({...newClient, password:e.target.value})} />
              <input type="text" placeholder="Nombre completo" className="w-full bg-zinc-800 p-4 rounded-xl text-xs text-white outline-none" value={newClient.name} onChange={e=>setNewClient({...newClient, name:e.target.value})} />
              <button onClick={runCreateProfile} disabled={isCreatingProfile} className={`w-full bg-amber-500 text-black font-black py-4 rounded-xl text-[10px] uppercase flex items-center justify-center gap-2 ${isCreatingProfile ? 'opacity-60' : ''}`}>{isCreatingProfile ? <><Loader2 className="animate-spin" size={14}/> CREANDO...</> : 'CREAR CUENTA'}</button>
              <button onClick={()=>setShowAddClientModal(false)} className="w-full text-zinc-500 text-[10px] font-bold">CANCELAR</button>
           </div>
        </div>
      )}

      {/* Admin: Client Info & Password Reset Modal */}
      {showClientInfoModal && clientInfoTarget && db[clientInfoTarget] && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-[2rem] p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-amber-500 font-black uppercase text-sm flex items-center gap-2"><User size={18}/> Datos Cliente</h3>
              <button onClick={() => { setShowClientInfoModal(false); setClientInfoTarget(null); }}><X size={20} className="text-zinc-500"/></button>
            </div>

            <div className="space-y-3">
              <div className="bg-zinc-800 p-4 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-[9px] font-black uppercase">Nombre</span>
                  <span className="text-white text-sm font-bold">{String(db[clientInfoTarget].name || clientInfoTarget)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-[9px] font-black uppercase">Usuario</span>
                  <span className="text-white text-sm font-bold">{String(db[clientInfoTarget].username || clientInfoTarget)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-[9px] font-black uppercase">Subtítulo</span>
                  <span className="text-zinc-300 text-xs">{String(db[clientInfoTarget].subtitle || "—")}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-[9px] font-black uppercase">Días rutina</span>
                  <span className="text-zinc-300 text-xs">{(Array.isArray(db[clientInfoTarget].workoutData?.days) ? db[clientInfoTarget].workoutData.days : []).length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-[9px] font-black uppercase">Registros</span>
                  <span className="text-zinc-300 text-xs">{Object.values(db[clientInfoTarget].logs || {}).flat().length}</span>
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-4 space-y-3">
                <h4 className="text-amber-500 text-[10px] font-black uppercase flex items-center gap-2"><Key size={12}/> Resetear Contraseña</h4>
                <input type="password" placeholder="Nueva contraseña" className="w-full bg-zinc-800 border border-zinc-700 outline-none text-white p-3 rounded-xl text-xs" value={adminResetPwd} onChange={e => setAdminResetPwd(e.target.value)} />
                <input type="password" placeholder="Confirmar contraseña" className="w-full bg-zinc-800 border border-zinc-700 outline-none text-white p-3 rounded-xl text-xs" value={adminResetPwdConfirm} onChange={e => setAdminResetPwdConfirm(e.target.value)} />
                {adminResetError && <p className="text-red-500 text-[10px] text-center">{String(adminResetError)}</p>}
                {adminResetSuccess && <p className="text-green-500 text-[10px] font-bold text-center">{String(adminResetSuccess)}</p>}
                <button onClick={adminResetClientPassword} className="w-full bg-amber-500 text-black font-black py-3 rounded-xl text-[10px] uppercase active:scale-95">CAMBIAR CONTRASEÑA</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Image Manager Modal (Admin) */}
      <ExerciseImageManager
        isOpen={imageManagerOpen}
        onClose={() => { setImageManagerOpen(false); setNewExImageMode(false); }}
        exerciseName={imageManagerTarget.exName}
        onSelectImage={(imgData) => {
          if (newExImageMode) {
            setNewEx(prev => ({...prev, img: imgData}));
            setNewExImageMode(false);
          } else {
            updateImageHook(imageManagerTarget.dayId, imageManagerTarget.exName, imgData);
          }
        }}
      />

      {/* Confetti celebration effect */}
      <ConfettiEffect active={showConfetti} onDone={() => setShowConfetti(false)} />

      {/* Expanded stats chart modal */}
      {expandedStatsExercise && (
        <ExpandedChart
          logs={expandedStatsExercise.logs}
          exName={expandedStatsExercise.name}
          exSets={expandedStatsExercise.sets}
          mode={chartMode}
          color={client.color}
          isAdmin={isAdminMode}
          onClose={() => setExpandedStatsExercise(null)}
        />
      )}

      {/* Onboarding welcome modal for new clients */}
      {showOnboarding && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-500">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-[2rem] p-8 space-y-5 shadow-2xl text-center animate-in slide-in-from-bottom-10 duration-500">
            <div className="text-5xl mb-2">🏋️</div>
            <h2 className="text-white font-black text-xl">¡Bienvenido a Athlos!</h2>
            <p className="text-zinc-400 text-sm leading-relaxed">Tu entrenador ha preparado tu rutina personalizada. Aquí podrás:</p>
            <div className="space-y-3 text-left">
              <div className="flex items-center gap-3 bg-zinc-800/50 p-3 rounded-xl">
                <span className="text-lg">📋</span>
                <p className="text-xs text-zinc-300"><b className="text-white">Ver tus días</b> — Toca un día para ver los ejercicios</p>
              </div>
              <div className="flex items-center gap-3 bg-zinc-800/50 p-3 rounded-xl">
                <span className="text-lg">💪</span>
                <p className="text-xs text-zinc-300"><b className="text-white">Registrar series</b> — Apunta peso y reps de cada serie</p>
              </div>
              <div className="flex items-center gap-3 bg-zinc-800/50 p-3 rounded-xl">
                <span className="text-lg">📈</span>
                <p className="text-xs text-zinc-300"><b className="text-white">Ver tu progreso</b> — En la pestaña Evolución verás tus gráficos</p>
              </div>
              <div className="flex items-center gap-3 bg-zinc-800/50 p-3 rounded-xl">
                <span className="text-lg">⏱️</span>
                <p className="text-xs text-zinc-300"><b className="text-white">Cronómetro</b> — Inicia el crono al empezar a entrenar</p>
              </div>
            </div>
            <button onClick={() => { setShowOnboarding(false); localStorage.setItem(`athlos_onboarding_${loggedInUser}`, 'true'); }} className="w-full bg-amber-500 text-black font-black py-4 rounded-xl text-sm uppercase active:scale-95 transition-transform shadow-lg shadow-amber-500/20">¡Vamos! 💪</button>
          </div>
        </div>
      )}

      {/* NEW: Toast notification container */}
      <div className="fixed bottom-32 right-4 z-40 space-y-2">
        {toasts.map((toast, idx) => (
          <Toast
            key={idx}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={toast.onClose}
          />
        ))}
      </div>
    </div>
  );
}

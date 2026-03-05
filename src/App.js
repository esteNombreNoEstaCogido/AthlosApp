import React, { useState, useEffect, useCallback, memo, useRef } from "react";
import html2pdf from "html2pdf.js";
import bcrypt from "bcryptjs";
// Importaciones de Firebase
import { initializeApp } from "firebase/app";
import { 
  getFirestore, doc, setDoc, getDoc, collection, onSnapshot, deleteDoc 
} from "firebase/firestore";
import {
  Dumbbell, Flame, Info, ChevronRight, ArrowLeft, User, Heart, Youtube, 
  PlusCircle, History, Trash2, Clock, MessageSquareHeart, X, Zap, Users, 
  Settings, Plus, Edit3, TrendingUp, Trophy, Crown, LayoutDashboard, 
  PlayCircle, Calculator, Brain, Loader2, LogOut, Key, CheckCircle2, Sparkles,
  Camera, CheckSquare, CalendarPlus, Eye, Download, TrendingDown
} from "lucide-react";

// ==========================================
// CONFIGURACIÓN FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: "athlos-5dcc5.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: "athlos-5dcc5.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db_cloud = getFirestore(app);
const COLLECTION_NAME = "athlos_clients";

// ==========================================
// UTILIDADES BLINDADAS
// ==========================================
const sanitizeInput = (str) => {
  if (typeof str !== 'string') return '';
  return str.slice(0, 200).replace(/[<>\"'&]/g, c => ({
    '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;'
  }[c]));
};

const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:')) return '';
  try { new URL(trimmed); return trimmed; } catch { return ''; }
};

const safeJSONParse = (key, fallback) => {
  try {
    const item = localStorage.getItem(key);
    return item && item !== "undefined" ? JSON.parse(item) : fallback;
  } catch (e) { return fallback; }
};

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
  const geminiKey = process.env.REACT_APP_GEMINI_KEY;
  if (!geminiKey || geminiKey === "tu_api_key_aqui") {
    console.warn("⚠️ Gemini API key no configurada");
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
const hashPassword = (password) => {
  // Usar salt simple para evitar problemas con bcrypt en client-side
  const salt = "athlos_salt_2025";
  return btoa(salt + password).slice(0, 50); // Encoding simple, no es criptografía real
};

const validatePassword = (password) => {
  // Al menos 6 caracteres, sin espacios
  return password && password.length >= 6 && !/\s/.test(password);
};

const generatePDFReport = (client, days) => {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
      <h1 style="color: #1a1a1a; border-bottom: 3px solid #f59e0b; padding-bottom: 10px;">📋 PLAN DE ENTRENAMIENTO</h1>
      <h2 style="color: #666;">${client.name}</h2>
      <p style="color: #999; font-style: italic;">${client.subtitle || ''}</p>
      <p style="color: #999; margin-bottom: 30px;"><strong>Generado:</strong> ${new Date().toLocaleDateString('es-ES')}</p>
      
      ${days.map(day => `
        <div style="background: white; padding: 15px; margin-bottom: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
          <h3 style="color: #1a1a1a; margin: 0 0 10px 0;">${day.title}</h3>
          <p style="color: #666; margin: 5px 0;"><strong>Enfoque:</strong> ${day.focus || 'General'}</p>
          <h4 style="color: #888; margin-top: 10px;">Ejercicios:</h4>
          <ul style="color: #666; padding-left: 20px;">
            ${(day.exercises || []).map(ex => `
              <li style="margin: 8px 0;">
                <strong>${ex.name}</strong> - ${ex.s} series x ${ex.r} reps
                <br/><small style="color: #999;">Grupo: ${ex.mus} ${ex.tip ? '| Tip: ' + ex.tip : ''}</small>
              </li>
            `).join('')}
          </ul>
        </div>
      `).join('')}
      
      <div style="margin-top: 30px; padding: 15px; background: #fff3cd; border-radius: 8px;">
        <p style="color: #666;"><strong>💡 Consejo del Coach:</strong> ${client.advice || 'Mantén la consistencia y disfruta el proceso.'}</p>
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
// DATOS INICIALES
// ==========================================
const EJERCICIOS_PREDEFINIDOS = [
  { name: "Hip Thrust", mus: "Glúteo", img: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8ZW58MHx8fHx8fDA%3D%3D&auto=format&fit=crop&w=500&q=60", yt: "https://www.youtube.com/watch?v=zsRrjH2z0N8" },
  { name: "Peso Muerto Rumano", mus: "Isquios", img: "https://images.unsplash.com/photo-1633626773746-25284de532af?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8ZW58MHx8fHx8fDA%3D%3D&auto=format&fit=crop&w=500&q=60", yt: "https://www.youtube.com/watch?v=jEy_czNkF2o" },
  { name: "Sentadilla", mus: "Piernas", img: "https://images.unsplash.com/photo-1595078519480-bc102f8aa565?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8ZW58MHx8fHx8fDA%3D%3D&auto=format&fit=crop&w=500&q=60", yt: "https://www.youtube.com/watch?v=Fzc5vKsU5gE" },
  { name: "Prensa de Piernas", mus: "Piernas", img: "https://images.unsplash.com/photo-1576556356529-3f0f8c9346d5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8ZW58MHx8fHx8fDA%3D%3D&auto=format&fit=crop&w=500&q=60", yt: "https://www.youtube.com/watch?v=IZxyjW7MPJQ" },
  { name: "Leg Curl", mus: "Isquios", img: "https://images.unsplash.com/photo-1598971457747-9b61f4981e91?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8ZW58MHx8fHx8fDA%3D%3D&auto=format&fit=crop&w=500&q=60", yt: "https://www.youtube.com/watch?v=1Gc-ugJHBEE" },
  { name: "Extensión de Cuádriceps", mus: "Cuádriceps", img: "https://images.unsplash.com/photo-1584735175097-24340077ad18?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8ZW58MHx8fHx8fDA%3D%3D&auto=format&fit=crop&w=500&q=60", yt: "https://www.youtube.com/watch?v=YEvct2Bp8qo" },
  { name: "Press de Banca", mus: "Pecho", img: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8ZW58MHx8fHx8fDA%3D%3D&auto=format&fit=crop&w=500&q=60", yt: "https://www.youtube.com/watch?v=FjKLBRXIgDo" },
  { name: "Remo", mus: "Espalda", img: "https://images.unsplash.com/photo-1574519338703-46cc396c01db?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8ZW58MHx8fHx8fDA%3D%3D&auto=format&fit=crop&w=500&q=60", yt: "https://www.youtube.com/watch?v=p2h0N-5nUDU" },
  { name: "Dominadas", mus: "Espalda", img: "https://images.unsplash.com/photo-1597124514420-c6391dd34e97?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8ZW58MHx8fHx8fDA%3D%3D&auto=format&fit=crop&w=500&q=60", yt: "https://www.youtube.com/watch?v=eXRwVYt9specifically" },
  { name: "Curl de Bíceps", mus: "Brazos", img: "https://images.unsplash.com/photo-1567059884314-1812253f72c5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8ZW58MHx8fHx8fDA%3D%3D&auto=format&fit=crop&w=500&q=60", yt: "https://www.youtube.com/watch?v=ykJmrZ5v0Oo" },
];

const RUTINA_TAMARA_OFICIAL = [
  { id: 101, title: "DÍA 1: Glúteo Máximo", focus: "Fuerza", warmupType: "warmupAthlos", exercises: [
    { name: "Hip Thrust", s: 4, r: "8-10", tip: "Pausa 2\" arriba.", mus: "Glúteo", img: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/watch?v=zsRrjH2z0N8" },
    { name: "Peso Muerto Rumano", s: 3, r: "10", tip: "Bajada lenta.", mus: "Isquios", img: "https://images.unsplash.com/photo-1613210915490-b0c0e1f30e4f?auto=format&fit=crop&q=80&w=400", yt: "https://www.youtube.com/watch?v=jEy_czNkF2o" }
  ]}
];

const INITIAL_DB = {
  entrenador: { username: "coach", password: "1234", name: "Coach Jhon", color: "from-zinc-800 to-zinc-900", subtitle: "Panel de Control", advice: "Calidad técnica.", logs: {}, notes: [], templates: [{ id: "tmpl_tamara", name: "Plantilla Tamara", days: RUTINA_TAMARA_OFICIAL }], workoutData: { days: [] } },
  tamara: { username: "tamara", password: "1234", name: "Tamara", color: "from-blue-600 to-indigo-500", subtitle: "Glúteo & Postura", advice: "Estira cada hora.", logs: {}, notes: [], workoutData: { days: RUTINA_TAMARA_OFICIAL } }
};

const warmupData = {
  warmupLower: { title: "Calentamiento Inferior", steps: [{ name: "Círculos", detail: "15/lado" }] },
  warmupUpper: { title: "Calentamiento Superior", steps: [{ name: "Rotaciones", detail: "10/lado" }] },
  warmupAthlos: { title: "Calentamiento Athlos", steps: [{ name: "Hip Flow", detail: "10 reps." }, { name: "Sentadillas", detail: "15 reps." }] }
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

const MiniProgressChart = ({ data, color, isAdmin, mode, exSets }) => {
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
};

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
        <div style={{ width: `${currentPercent}%` }} className="absolute h-full transition-all" style={{ backgroundColor: color }}></div>
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

const ExerciseCard = memo(({ ex, workoutLogs, onAddLog, onDeleteLog, onStartTimer, isAdmin, onUpdateImage, dayId, accentColor, onAddExerciseNote, exerciseNotes }) => {
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
    const weightToUse = localW || suggestedWeight || (logs.length > 0 ? logs[0].weight : 10); 
    const repsToUse = localR || targetRepsCalc || 10;
    onAddLog(safeName, weightToUse, repsToUse);
    setLocalW(""); 
    setLocalR(""); 
    setShowCalc(false);
  };

  return (
    <div className={`${isAdmin ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-100"} rounded-[2.5rem] border shadow-sm overflow-hidden mb-6`}>
      <div className="relative h-52 bg-zinc-800 group">
        <img src={ex?.img || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400'} alt="" className="w-full h-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent" />
        {isAdmin && <button onClick={() => fileRef.current.click()} className="absolute top-4 left-4 bg-black/60 p-2 rounded-xl text-white"><Camera size={18} /><input type="file" ref={fileRef} className="hidden" onChange={e => {
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
                <div className="flex items-center gap-3"><span className={`text-[9px] ${isAdmin ? 'text-zinc-500' : 'text-zinc-400'}`}>{String(l.date)}</span><button onClick={() => onDeleteLog(safeName, l.id)} className="text-red-400 opacity-60 hover:opacity-100"><Trash2 size={12}/></button></div>
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
            <input type="number" placeholder="Kg..." className={`flex-1 min-w-0 border rounded-xl p-3 text-sm font-bold outline-none ${isAdmin ? "bg-zinc-800 border-zinc-700 text-white" : "bg-white border-gray-200 text-gray-900"}`} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} value={localW} onChange={e => setLocalW(e.target.value)} />
            <input type="number" placeholder="Reps" className={`w-16 shrink-0 border rounded-xl p-3 text-sm font-bold text-center outline-none ${isAdmin ? "bg-zinc-800 border-zinc-700 text-white" : "bg-white border-gray-200 text-gray-900"}`} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} value={localR} onChange={e => setLocalR(e.target.value)} />
            <button onClick={() => setShowCalc(!showCalc)} className={`px-3 shrink-0 rounded-xl transition-all shadow-md border ${isAdmin ? (showCalc ? "bg-amber-500 text-black border-amber-500" : "bg-zinc-800 text-zinc-400 border-zinc-700") : (showCalc ? "bg-blue-500 text-white border-blue-500" : "bg-white text-gray-400 border-gray-200")}`}><Calculator size={20}/></button>
            <button onClick={handleAdd} className={`px-4 shrink-0 rounded-xl transition-all active:scale-95 shadow-md ${isAdmin ? "bg-amber-500 text-black" : "bg-gray-900 text-white"}`}><PlusCircle size={20}/></button>
          </div>
          {showCalc && <PlateDisplay weight={weightToCalc} />}
        </div>
        {safeTip && (
          <div className={`p-3 rounded-xl border flex gap-2 ${isAdmin ? "bg-amber-500/10 border-amber-500/20" : "bg-blue-50 border-blue-100"}`}>
            <Info size={14} className={`${textAccent} shrink-0 mt-0.5`} /><p className={`text-[11px] italic leading-tight ${isAdmin ? 'text-zinc-400' : 'text-gray-700'}`}>"{safeTip}"</p>
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
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const [loggedInUser, setLoggedInUser] = useState(() => getSavedSession());
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [loginLockedUntil, setLoginLockedUntil] = useState(null);
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);

  const [activeTab, setActiveTab] = useState("home");
  const [currentClientId, setCurrentClientId] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [sessionStart, setSessionStart] = useState(null);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [isAdminMode, setIsAdminMode] = useState(false);
  
  const [showEditor, setShowEditor] = useState(false);
  const [editorTab, setEditorTab] = useState("day");
  const [targetDayId, setTargetDayId] = useState("");
  const [editingClientId, setEditingClientId] = useState(null);
  const [editingDayId, setEditingDayId] = useState(null);
  const [selectedExerciseTemplate, setSelectedExerciseTemplate] = useState("");
  const [newEx, setNewEx] = useState({ name: "", s: 3, r: "12", tip: "", mus: "", yt: "", img: "" });
  const [newDay, setNewDay] = useState({ title: "", focus: "", warmupType: "warmupLower" });
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", username: "", password: "", sourceTemplate: "" });
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState("");
  const [isEditingClientRoutine, setIsEditingClientRoutine] = useState(false);
  const [sourceClientToCopy, setSourceClientToCopy] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState("");
  const [loadingAiNoteId, setLoadingAiNoteId] = useState(null);
  const [toast, setToast] = useState(null);
  const [chartMode, setChartMode] = useState('weight');
  const [noteText, setNoteText] = useState("");
  const [timerDuration, setTimerDuration] = useState(null);
  const [timerKey, setTimerKey] = useState(0);

  const lastBackPress = useRef(0);
  const [showExitToast, setShowExitToast] = useState(false);
  const lastAppliedUpdateRef = useRef({});

  // RED Y FIREBASE
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, []);

  const updateUserInCloud = useCallback((userId, modifierFn) => {
    setDb(prev => {
      const current = prev[userId] || INITIAL_DB[userId] || { workoutData: { days: [] }, logs: {}, notes: [] };
      const cloned = JSON.parse(JSON.stringify(current));
      const next = modifierFn(cloned);
      
      // Crear hash simple para detectar si es la misma actualización
      const nextStr = JSON.stringify(next);
      const updateKey = `${userId}-${nextStr}`;
      
      if (lastAppliedUpdateRef.current[userId] !== updateKey) {
        lastAppliedUpdateRef.current[userId] = updateKey;
        if (navigator.onLine) {
          setIsSyncing(true);
          setDoc(doc(db_cloud, COLLECTION_NAME, userId), next).then(() => setIsSyncing(false)).catch(() => setIsSyncing(false));
        }
      }
      
      return { ...prev, [userId]: next };
    });
  }, []);

  // Liberar bloqueo de login cuando expira
  useEffect(() => {
    if (!loginLockedUntil) return;
    const timer = setTimeout(() => {
      if (Date.now() >= loginLockedUntil) {
        setLoginLockedUntil(null);
        setLoginAttempts(0);
        setLoginError("Intenta de nuevo");
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [loginLockedUntil]);

  // CARGA DE DATOS DE FIREBASE
  useEffect(() => {
    if (!loggedInUser) {
      setDataLoaded(true);
      return;
    }
    if (!navigator.onLine) {
      setDataLoaded(true);
      return;
    }
    const unsub = onSnapshot(collection(db_cloud, COLLECTION_NAME), (snap) => {
      const cloud = {};
      snap.forEach(d => { cloud[d.id] = d.data(); });
      
      if (Object.keys(cloud).length === 0) {
         Object.keys(INITIAL_DB).forEach(k => setDoc(doc(db_cloud, COLLECTION_NAME, k), INITIAL_DB[k]));
         setDb(INITIAL_DB);
      } else {
         if(!cloud.entrenador?.templates) {
           if (!cloud.entrenador) cloud.entrenador = INITIAL_DB.entrenador;
           cloud.entrenador.templates = INITIAL_DB.entrenador.templates;
         }
         setDb(cloud);
      }
      setDataLoaded(true);
    }, (err) => {
      console.warn("Firebase Snapshot Error:", err);
      setDataLoaded(true);
    });

    return () => unsub();
  }, [loggedInUser]);

  // Resetear estados cuando cambia el día que se edita
  useEffect(() => {
    setNewEx({ name: "", s: 3, r: "12", tip: "", mus: "", yt: "", img: "" });
    setSelectedExerciseTemplate("");
  }, [editingDayId]);

  useEffect(() => {
    if (loggedInUser && db[loggedInUser]) {
      setCurrentClientId(loggedInUser);
      setIsAdminMode(loggedInUser === 'entrenador' || loggedInUser === 'coach');
    }
  }, [loggedInUser, db]);

  // SOLUCIÓN DE SEGURIDAD CONTRA BUCLES INFINITOS Y PANTALLA EN BLANCO
  useEffect(() => {
    if (dataLoaded && loggedInUser && currentClientId) {
      const userExists = Object.prototype.hasOwnProperty.call(db, currentClientId);
      
      // Si la base de datos no es la inicial y el usuario no está, expulsar.
      if (!userExists && db !== INITIAL_DB) {
        setLoggedInUser(null);
        setIsAdminMode(false);
        localStorage.removeItem("athlos_session_final");
        sessionStorage.removeItem("athlos_session_final");
        setDataLoaded(false);
      }
    }
  }, [dataLoaded, db, currentClientId, loggedInUser]);

  const authenticate = async () => {
    // Rate limiting: bloquear después de 5 intentos fallidos por 5 minutos
    if (loginLockedUntil && Date.now() < loginLockedUntil) {
      const minutesLeft = Math.ceil((loginLockedUntil - Date.now()) / 60000);
      setLoginError(`Demasiados intentos. Intenta en ${minutesLeft} minuto(s)`);
      return;
    }
    
    setLoginError("");
    const input = loginUser.toLowerCase().trim();
    if (!input) return;
    try {
      if (input === "coach" && loginPass === "1234") {
        setLoginAttempts(0);
        setLoginLockedUntil(null);
        setLoggedInUser("entrenador"); setCurrentClientId("entrenador"); setIsAdminMode(true);
        if (keepLoggedIn) localStorage.setItem("athlos_session_final", JSON.stringify("entrenador"));
        else sessionStorage.setItem("athlos_session_final", JSON.stringify("entrenador"));
        return;
      }
      let user = db[input] || INITIAL_DB[input];
      if (navigator.onLine && !user) {
         const snap = await getDoc(doc(db_cloud, COLLECTION_NAME, input));
         if (snap.exists()) user = snap.data();
      }
      if (user && user.password === loginPass) {
        setLoginAttempts(0);
        setLoginLockedUntil(null);
        setLoggedInUser(input); setCurrentClientId(input); setIsAdminMode(input === 'entrenador' || input === 'coach');
        if (keepLoggedIn) localStorage.setItem("athlos_session_final", JSON.stringify(input));
        else sessionStorage.setItem("athlos_session_final", JSON.stringify(input));
      } else { 
        const newAttempts = loginAttempts + 1;
        setLoginAttempts(newAttempts);
        if (newAttempts >= 5) {
          setLoginLockedUntil(Date.now() + 5 * 60 * 1000); // Bloquear por 5 minutos
          setLoginError("Cuenta bloqueada por 5 minutos después de 5 intentos fallidos");
        } else {
          setLoginError(`Usuario o contraseña incorrectos (${newAttempts}/5)`);
        }
      }
    } catch (e) { setLoginError("Error de red."); }
  };

  const changePassword = () => {
    // Validar contraseña actual
    if (!pwdCurrent || !pwdNew || !pwdConfirm) {
      setPwdError("Todos los campos son obligatorios");
      return;
    }
    
    // Validar que la nueva contraseña sea fuerte
    if (!validatePassword(pwdNew)) {
      setPwdError("La contraseña debe tener al menos 6 caracteres sin espacios");
      return;
    }
    
    // Verificar que las contraseñas coincidan
    if (pwdNew !== pwdConfirm) {
      setPwdError("Las contraseñas no coinciden");
      return;
    }
    
    // Verificar contraseña actual
    const currentUser = db[loggedInUser] || INITIAL_DB[loggedInUser];
    if (!currentUser || currentUser.password !== pwdCurrent) {
      setPwdError("Contraseña actual incorrecta");
      return;
    }
    
    // Actualizar contraseña
    updateUserInCloud(loggedInUser, u => ({ ...u, password: pwdNew }));
    setPwdError("");
    setPwdSuccess("Contraseña actualizada correctamente ✓");
    setTimeout(() => {
      setPwdCurrent("");
      setPwdNew("");
      setPwdConfirm("");
      setPwdSuccess("");
      setShowPasswordModal(false);
    }, 2000);
  };

  const signOutUser = () => {
    setLoggedInUser(null); setIsAdminMode(false); 
    localStorage.removeItem("athlos_session_final"); 
    sessionStorage.removeItem("athlos_session_final");
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
        const sanitized = field === 'yt' ? sanitizeUrl(val) : field === 's' ? parseInt(val) || 3 : sanitizeInput(val); 
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
    setToast({ type: "SUCCESS", message: "Ejercicio borrado" }); 
    setTimeout(() => setToast(null), 2500);
  };

  const removeDayFromRoutine = (dayId) => {
    updateUserInCloud(currentClientId, u => {
      const days = Array.isArray(u.workoutData?.days) ? u.workoutData.days : [];
      const filtered = days.filter(d => d.id !== dayId);
      return { ...u, workoutData: { ...u.workoutData, days: filtered } };
    });
    setEditingDayId(null);
    setToast({ type: "SUCCESS", message: "Día eliminado" }); 
    setTimeout(() => setToast(null), 2500);
  };

  const selectExerciseTemplate = (exName) => {
    const template = EJERCICIOS_PREDEFINIDOS.find(e => e.name === exName);
    if (template) {
      setNewEx({ name: template.name, s: 3, r: "12", tip: "", mus: template.mus, yt: template.yt, img: template.img });
      setSelectedExerciseTemplate(exName);
    }
  };

  const removeClientAccount = async () => {
    if (currentClientId === 'entrenador' || currentClientId === 'coach') return;
    setIsSyncing(true);
    await deleteDoc(doc(db_cloud, COLLECTION_NAME, currentClientId)).catch(()=>{});
    setDb(prev => { const n = {...prev}; delete n[currentClientId]; return n; });
    setCurrentClientId('entrenador'); setIsSyncing(false);
    setToast({ type: "SUCCESS", message: "Cliente eliminado" }); setTimeout(() => setToast(null), 2500);
  };

  const deleteClientFromAdmin = async (clientId) => {
    if (clientId === 'entrenador' || clientId === 'coach') {
      setToast({ type: "ERROR", message: "No puedes eliminar el admin" }); 
      setTimeout(() => setToast(null), 2500);
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
      
      // LUEGO eliminar de Firebase si está online
      if (navigator.onLine) {
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
      setToast({ type: "SUCCESS", message: `${clientId} eliminado permanentemente` }); 
      setTimeout(() => setToast(null), 2500);
    } catch (err) {
      setIsSyncing(false);
      setToast({ type: "ERROR", message: "Error al eliminar cliente" }); 
      setTimeout(() => setToast(null), 2500);
    }
  };

  const addLogRecord = useCallback((exName, weight, reps) => {
    const dateStr = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    updateUserInCloud(currentClientId, (u) => {
      const logs = u.logs || {};
      return { ...u, logs: { ...logs, [exName]: [{ weight, reps, date: dateStr, id: Date.now() }, ...(Array.isArray(logs[exName]) ? logs[exName] : [])].slice(0, 15) } };
    });
    setToast({ type: "SUCCESS", message: `Serie registrada` }); setTimeout(() => setToast(null), 2000);
  }, [currentClientId, updateUserInCloud]);

  const deleteLogRecord = useCallback((exName, logId) => updateUserInCloud(currentClientId, u => ({ ...u, logs: { ...u.logs, [exName]: (Array.isArray(u.logs?.[exName]) ? u.logs[exName] : []).filter(l => l.id !== logId) } })), [currentClientId, updateUserInCloud]);
  
  const addExerciseNote = useCallback((exName, noteText) => {
    const dateStr = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    const sanitized = sanitizeInput(noteText);
    if (!sanitized.trim()) return;
    updateUserInCloud(currentClientId, (u) => {
      const exNotes = u.exerciseNotes || {};
      return { ...u, exerciseNotes: { ...exNotes, [exName]: [{ text: sanitized, date: dateStr, id: Date.now() }, ...(Array.isArray(exNotes[exName]) ? exNotes[exName] : [])].slice(0, 20) } };
    });
  }, [currentClientId, updateUserInCloud]);
  
  const addNoteRecord = () => {
    if (!noteText) return;
    const dateStr = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    updateUserInCloud(currentClientId, (u) => ({ ...u, notes: [{ text: noteText, date: dateStr, id: Date.now() }, ...(Array.isArray(u.notes) ? u.notes : [])] }));
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

  const startTimerHook = useCallback((s) => { setTimerDuration(s); setTimerKey((k) => k + 1); }, []);
  const navigateTo = (tab, day = null) => { setActiveTab(tab); setSelectedDay(day); window.scrollTo(0,0); };

  const updateImageHook = useCallback((dayId, exName, newImgBase64) => {
    updateUserInCloud(currentClientId, (u) => {
      const days = [...(Array.isArray(u.workoutData?.days) ? u.workoutData.days : [])];
      const dIdx = days.findIndex(d => d.id === dayId);
      if (dIdx !== -1) {
          const exes = [...(Array.isArray(days[dIdx].exercises) ? days[dIdx].exercises : [])];
          const eIdx = exes.findIndex(e => e.name === exName);
          if (eIdx !== -1) { exes[eIdx] = { ...exes[eIdx], img: newImgBase64 }; days[dIdx] = { ...days[dIdx], exercises: exes }; }
      }
      return { ...u, workoutData: { ...u.workoutData, days } };
    });
  }, [currentClientId, updateUserInCloud]);

  const runCreateProfile = () => {
    const name = sanitizeInput(newClient.name).trim();
    const username = sanitizeInput(newClient.username).trim().toLowerCase();
    const password = newClient.password;
    
    if (!name || !username || !password || password.length < 4) {
      setToast({ type: "SUCCESS", message: "Datos inválidos o contraseña muy corta" }); 
      setTimeout(() => setToast(null), 3000); 
      return;
    }
    
    const id = username.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_");
    let sourceDays = [];
    if (newClient.sourceTemplate.startsWith("tmpl_")) {
      sourceDays = (db.entrenador?.templates || []).find(t => t.id === newClient.sourceTemplate.replace("tmpl_", ""))?.days || [];
    } else if (newClient.sourceTemplate.startsWith("client_")) {
      sourceDays = db[newClient.sourceTemplate.replace("client_", "")]?.workoutData?.days || [];
    }
    updateUserInCloud(id, () => ({
      username: username, password: password, name: name, color: "from-blue-600 to-indigo-500", subtitle: "Nuevo Plan", advice: "A darlo todo.", logs: {}, notes: [], workoutData: { days: JSON.parse(JSON.stringify(sourceDays)) }
    }));
    setCurrentClientId(id); setShowAddClientModal(false);
    setNewClient({ name: "", username: "", password: "", sourceTemplate: "" });
  };

  useEffect(() => {
    let interval;
    if (sessionStart) interval = setInterval(() => setSessionElapsed(Math.floor((Date.now() - sessionStart) / 1000)), 1000);
    else setSessionElapsed(0);
    return () => clearInterval(interval);
  }, [sessionStart]);

  const finishSession = () => { 
    const h = Math.floor(sessionElapsed / 3600), m = Math.floor((sessionElapsed % 3600) / 60);
    setToast({ type: "SUCCESS", message: `¡COMPLETADO EN ${h>0?h+'h ':''}${m}m! 🎉` }); 
    setSessionStart(null); setTimeout(() => setToast(null), 4000); navigateTo("home"); 
  };

  useEffect(() => {
    window.history.replaceState({ tab: "home" }, "");
    const handlePopState = (e) => {
      if (!loggedInUser) return;
      if (e.state && e.state.tab !== 'home') { setActiveTab(e.state.tab); } else {
        const now = Date.now();
        if (now - lastBackPress.current < 2000) window.history.back(); 
        else {
          lastBackPress.current = now; setShowExitToast(true); setTimeout(() => setShowExitToast(false), 2000);
          window.history.pushState({ tab: "home" }, ""); setActiveTab("home"); setSelectedDay(null);
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [loggedInUser]);

  useEffect(() => {
    if (db[currentClientId]?.workoutData?.days?.length > 0) {
      if(!targetDayId || !db[currentClientId].workoutData.days.find(d=>d.id.toString() === targetDayId)) {
        setTargetDayId(db[currentClientId].workoutData.days[0].id.toString());
      }
    } else { setTargetDayId(""); }
  }, [currentClientId, db, targetDayId]);

  // --- UI RENDER ---

  if (!loggedInUser) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="w-full max-w-sm animate-in fade-in duration-500">
          <div className="text-center mb-10"><div className="bg-zinc-900 w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 border border-zinc-800 shadow-xl"><Dumbbell className="text-amber-500" size={32}/></div><h1 className="text-3xl font-black tracking-tighter">ATHLOS</h1><p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mt-1">Entrenamiento Pro</p></div>
          <div className="space-y-4">
            <input type="text" placeholder="Usuario" className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:outline-none focus:border-amber-500 transition-colors placeholder:text-zinc-600" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} />
            <input type="password" placeholder="Contraseña" className={`w-full bg-zinc-900 border-2 border-zinc-800 rounded-2xl px-5 py-4 text-left text-sm font-bold focus:outline-none focus:border-amber-500 transition-colors ${loginPass ? 'text-amber-500 tracking-[0.5em]' : 'text-zinc-600'}`} value={loginPass} onChange={(e) => setLoginPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && authenticate()} />
            <label className="flex items-center gap-2 text-zinc-400 text-xs font-bold pl-2 cursor-pointer mt-2"><input type="checkbox" checked={keepLoggedIn} onChange={(e) => setKeepLoggedIn(e.target.checked)} className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-amber-500 accent-amber-500" />Mantener sesión iniciada</label>
            {loginError && <p className="text-red-500 text-xs font-bold text-center bg-red-500/10 p-2 rounded-lg">{String(loginError)}</p>}
            <button onClick={authenticate} className="w-full bg-amber-500 text-black font-black py-5 rounded-2xl uppercase text-xs shadow-lg active:scale-95 transition-all mt-4">Acceder</button>
          </div>
        </div>
      </div>
    );
  }

  if (!dataLoaded || !db[currentClientId]) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-amber-500"><Loader2 className="animate-spin" size={40} /></div>;

  const client = db[currentClientId];
  const workoutLogs = client.logs || {};
  const dailyNotes = client.notes || [];
  const validDays = Array.isArray(client.workoutData?.days) ? client.workoutData.days : [];
  const validNotes = Array.isArray(client.notes) ? client.notes : [];

  return (
    <div className={`min-h-screen font-sans transition-colors duration-500 ${isAdminMode ? "bg-black text-white" : "bg-[#FDFDFD] text-zinc-900"}`}>
      <div className="max-w-md mx-auto p-6 pb-32">
        <div className="flex justify-between items-center mb-6">
           <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} /><span className="text-[9px] font-black uppercase text-zinc-400">{isOnline ? 'Online' : 'Offline'}</span></div>
           <div className="flex gap-2">
              {isAdminMode && <button onClick={() => setIsAdminMode(false)} className="bg-blue-500/10 text-blue-500 p-2 rounded-xl text-xs font-bold px-3">Ver como cliente</button>}
              {!isAdminMode && loggedInUser === 'entrenador' && <button onClick={() => setIsAdminMode(true)} className="bg-amber-500/10 text-amber-500 p-2 rounded-xl"><Settings size={18}/></button>}
              <button onClick={() => setShowPasswordModal(true)} className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded-xl"><Key size={18}/></button>
              <button onClick={signOutUser} className="bg-red-50 text-red-500 p-2 rounded-xl border border-red-100"><LogOut size={18}/></button>
           </div>
        </div>

        {activeTab === "home" && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className={`bg-gradient-to-br ${isAdminMode && !isEditingClientRoutine ? "from-zinc-800 to-zinc-900 border border-zinc-700" : String(client.color || "from-blue-600 to-indigo-500")} p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden`}>
              <div className="flex flex-col gap-1 relative z-10">
                 {isAdminMode && !isEditingClientRoutine ? (
                   <>
                     <input defaultValue={String(client.name || "Cliente")} onBlur={e => actDay(null, 'name', e.target.value)} className="bg-transparent text-3xl font-black uppercase outline-none w-full" />
                     <input defaultValue={String(client.subtitle || "")} onBlur={e => actDay(null, 'subtitle', e.target.value)} className="bg-transparent text-sm font-medium italic opacity-80 outline-none w-full" />
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
              <div className="bg-zinc-900 p-8 rounded-[2rem] border border-zinc-800 shadow-2xl space-y-8 mt-8">
                <div className="flex justify-between items-center text-[10px] font-black uppercase text-zinc-500">
                  <div className="flex items-center gap-2"><Users size={14} className="text-amber-500" /> Clientes</div>
                  <button onClick={() => setShowAddClientModal(true)} className="bg-zinc-800 text-amber-500 px-3 py-1.5 rounded-lg active:scale-95 flex items-center gap-1"><Plus size={12}/> Nuevo</button>
                </div>
                <div className="flex gap-6 overflow-x-auto scrollbar-hide pb-4">
                  {Object.keys(db).filter(id => id !== 'entrenador').map(id => (
                    <button key={id} onClick={() => { setEditingClientId(id); setEditingDayId(null); setCurrentClientId(id); setIsEditingClientRoutine(true); setNewEx({ name: "", s: 3, r: "12", tip: "", mus: "", yt: "", img: "" }); setSelectedExerciseTemplate(""); }} className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase shrink-0 transition-all ${editingClientId === id ? 'bg-amber-500 text-black shadow-lg scale-105' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'}`}>{String(db[id].name || id)}</button>
                  ))}
                </div>
                
                {editingClientId && db[editingClientId] && (
                  <div className="border-t border-zinc-800 pt-12 space-y-12 animate-in slide-in-from-top-4 mt-8">
                    {/* HEADER DEL CLIENTE */}
                    <div className={`bg-gradient-to-br ${String(db[editingClientId].color || "from-blue-600")} p-6 rounded-2xl text-white relative`}>
                      <div className="absolute top-4 right-4 flex gap-2">
                        <button onClick={() => generatePDFReport(db[editingClientId], Array.isArray(db[editingClientId].workoutData?.days) ? db[editingClientId].workoutData.days : [])} className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-all flex items-center gap-1 text-[9px] font-bold uppercase"><Download size={14}/> PDF</button>
                        <button onClick={() => { setShowDeleteConfirmModal(true); setClientToDelete(editingClientId); }} className="bg-red-500/30 hover:bg-red-500/40 text-red-200 p-2 rounded-lg transition-all flex items-center gap-1 text-[9px] font-bold uppercase"><Trash2 size={14}/> Eliminar</button>
                      </div>
                      <div className="space-y-6">
                        <div>
                          <label className="text-[9px] font-black uppercase text-white/60 block mb-2">Nombre</label>
                          <input key={`name-${editingClientId}`} defaultValue={String(db[editingClientId].name || "")} maxLength="50" onBlur={e => updateUserInCloud(editingClientId, u => ({...u, name: sanitizeInput(e.target.value)}))} className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-white font-black text-lg outline-none" />
                        </div>
                        <div>
                          <label className="text-[9px] font-black uppercase text-white/60 block mb-2">Subtítulo</label>
                          <input key={`subtitle-${editingClientId}`} defaultValue={String(db[editingClientId].subtitle || "")} maxLength="60" onBlur={e => updateUserInCloud(editingClientId, u => ({...u, subtitle: sanitizeInput(e.target.value)}))} className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-white font-medium text-sm outline-none" />
                        </div>
                        <div>
                          <label className="text-[9px] font-black uppercase text-white/60 block mb-2">Consejo Coach</label>
                          <textarea key={`advice-${editingClientId}`} defaultValue={String(db[editingClientId].advice || "")} maxLength="150" onBlur={e => updateUserInCloud(editingClientId, u => ({...u, advice: sanitizeInput(e.target.value)}))} className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-white font-medium text-sm outline-none" />
                        </div>
                      </div>
                    </div>

                    {/* SELECTOR DE DÍAS */}
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h4 className="text-[10px] font-black uppercase text-zinc-400">Días de Entrenamiento ({(Array.isArray(db[editingClientId].workoutData?.days) ? db[editingClientId].workoutData.days : []).length})</h4>
                        {editingDayId && <button onClick={() => setEditingDayId(null)} className="text-amber-500 text-[9px] font-bold">← Volver</button>}
                      </div>
                      
                      {!editingDayId ? (
                        <>
                          <div className="grid grid-cols-2 gap-6">
                            {(Array.isArray(db[editingClientId].workoutData?.days) ? db[editingClientId].workoutData.days : []).map((day, idx) => (
                              <div key={day.id} className="relative group">
                                <button onClick={() => setEditingDayId(day.id)} className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 p-5 rounded-xl transition-all active:scale-95 text-left">
                                  <p className="text-[9px] text-zinc-400 font-bold uppercase group-hover:text-amber-500 transition-colors">{String(day.focus || "")}</p>
                                  <p className="text-sm font-black text-white mt-1 line-clamp-2">{String(day.title || "Día")}</p>
                                  <p className="text-[8px] text-zinc-500 mt-2">{(Array.isArray(day.exercises) ? day.exercises : []).length} ejercicios</p>
                                </button>
                                <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={(e) => { e.stopPropagation(); const newDayId = Date.now(); updateUserInCloud(editingClientId, u => { const days = [...(Array.isArray(u.workoutData?.days) ? u.workoutData.days : [])]; const sourceDayIdx = days.findIndex(d => d.id === day.id); if(sourceDayIdx > -1) { const newDay = JSON.parse(JSON.stringify(days[sourceDayIdx])); newDay.id = newDayId; newDay.title += " (Copia)"; days.splice(sourceDayIdx + 1, 0, newDay); } return { ...u, workoutData: { ...u.workoutData, days } }; }); setToast({ type: "SUCCESS", message: "Día duplicado ✓" }); setTimeout(() => setToast(null), 2500); }} className="bg-amber-500 text-black p-1.5 rounded-lg text-[9px] font-bold hover:bg-amber-600 active:scale-90"><Plus size={12}/></button>
                                  <button onClick={(e) => { e.stopPropagation(); removeDayFromRoutine(day.id); }} className="bg-red-500/20 text-red-500 p-1.5 rounded-lg hover:bg-red-500/30 active:scale-90"><Trash2 size={12}/></button>
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          <div className="space-y-4 bg-zinc-800/30 p-6 rounded-xl border border-zinc-700/50">
                            <input key={`newday-title-${editingClientId}`} type="text" placeholder="Nombre del día..." className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white text-xs outline-none focus:border-amber-500" value={newDay.title} onChange={e => setNewDay({...newDay, title: e.target.value})} />
                            <input key={`newday-focus-${editingClientId}`} type="text" placeholder="Focus (ej: Fuerza, Hipertrofia)..." className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white text-xs outline-none focus:border-amber-500" value={newDay.focus} onChange={e => setNewDay({...newDay, focus: e.target.value})} />
                            <select key={`newday-warmup-${editingClientId}`} value={newDay.warmupType} onChange={e => setNewDay({...newDay, warmupType: e.target.value})} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white text-xs outline-none">
                              <option value="warmupLower">Calentamiento Inferior</option>
                              <option value="warmupUpper">Calentamiento Superior</option>
                              <option value="warmupAthlos">Calentamiento Athlos</option>
                            </select>
                            <button onClick={() => { if(newDay.title?.trim()) { updateUserInCloud(editingClientId, u => ({ ...u, workoutData: { ...u.workoutData, days: [...(Array.isArray(u.workoutData?.days) ? u.workoutData.days : []), { id: Date.now(), title: sanitizeInput(newDay.title), focus: sanitizeInput(newDay.focus), warmupType: newDay.warmupType, exercises: [] }] } })); setNewDay({ title: "", focus: "", warmupType: "warmupLower" }); setToast({ type: "SUCCESS", message: "Día creado ✨" }); setTimeout(() => setToast(null), 2500); } }} className="w-full bg-amber-500 text-black font-black py-3 rounded-xl text-[10px] uppercase active:scale-95">+ Crear Día</button>
                          </div>
                        </>
                      ) : (
                        /* EDITAR EJERCICIOS DEL DÍA */
                        <div className="space-y-4">
                          {(() => {
                            const day = db[editingClientId].workoutData?.days?.find(d => d.id === editingDayId);
                            return (
                              <>
                                <div className="bg-zinc-800/50 p-6 rounded-xl border border-zinc-700 space-y-4">
                                  <h5 className="font-black text-white text-sm">{String(day?.title || "Día")}</h5>
                                  <div className="grid grid-cols-2 gap-4">
                                    <input key={`dayedit-focus-${editingDayId}`} defaultValue={String(day?.focus || "")} onBlur={e => modifyDayData(editingDayId, 'focus', e.target.value)} placeholder="Focus..." className="bg-zinc-900 p-2 rounded text-xs text-white outline-none" />
                                    <button onClick={() => removeDayFromRoutine(editingDayId)} className="bg-red-500/10 text-red-500 text-[9px] font-bold rounded active:scale-95 flex items-center justify-center gap-1"><Trash2 size={14}/> Eliminar</button>
                                  </div>
                                </div>

                                <div className="space-y-4 mt-6">
                                  <h5 className="text-[10px] font-black uppercase text-zinc-400">Ejercicios ({(Array.isArray(day?.exercises) ? day.exercises : []).length})</h5>
                                  {(Array.isArray(day?.exercises) ? day.exercises : []).map((ex, idx) => (
                                    <div key={idx} className="bg-zinc-800/70 p-5 rounded-xl border border-zinc-700/50 space-y-4 group">
                                      <div className="flex justify-between items-start gap-2">
                                        <input key={`ex-name-${editingDayId}-${idx}`} defaultValue={String(ex.name || "")} onBlur={e => modifyExerciseData(editingDayId, idx, 'name', e.target.value)} className="flex-1 bg-zinc-900 p-2 rounded font-bold text-white text-sm outline-none" />
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          {idx > 0 && <button onClick={() => updateUserInCloud(editingClientId, u => { const days = [...(u.workoutData?.days || [])]; const dIdx = days.findIndex(d => d.id === editingDayId); if(dIdx > -1) { const exes = [...(days[dIdx].exercises || [])]; [exes[idx-1], exes[idx]] = [exes[idx], exes[idx-1]]; days[dIdx].exercises = exes; } return { ...u, workoutData: { ...u.workoutData, days } }; })} className="text-zinc-400 hover:text-amber-500 active:scale-90"><ArrowLeft size={14}/></button>}
                                          {idx < (day?.exercises?.length || 0) - 1 && <button onClick={() => updateUserInCloud(editingClientId, u => { const days = [...(u.workoutData?.days || [])]; const dIdx = days.findIndex(d => d.id === editingDayId); if(dIdx > -1) { const exes = [...(days[dIdx].exercises || [])]; [exes[idx], exes[idx+1]] = [exes[idx+1], exes[idx]]; days[dIdx].exercises = exes; } return { ...u, workoutData: { ...u.workoutData, days } }; })} className="text-zinc-400 hover:text-amber-500 active:scale-90"><ChevronRight size={14}/></button>}
                                          <button onClick={() => removeExerciseFromDay(editingDayId, idx)} className="text-red-400 hover:text-red-500 active:scale-90"><Trash2 size={14}/></button>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <label className="text-[8px] text-zinc-500 uppercase font-bold block mb-1">Series</label>
                                          <input type="number" key={`ex-s-${editingDayId}-${idx}`} defaultValue={String(ex.s || 3)} onBlur={e => modifyExerciseData(editingDayId, idx, 's', e.target.value)} className="w-full bg-zinc-900 p-2 rounded text-white text-sm outline-none" />
                                        </div>
                                        <div>
                                          <label className="text-[8px] text-zinc-500 uppercase font-bold block mb-1">Reps</label>
                                          <input key={`ex-r-${editingDayId}-${idx}`} defaultValue={String(ex.r || "12")} onBlur={e => modifyExerciseData(editingDayId, idx, 'r', e.target.value)} className="w-full bg-zinc-900 p-2 rounded text-white text-sm outline-none" />
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <label className="text-[8px] text-zinc-500 uppercase font-bold block mb-1">Grupo</label>
                                          <input key={`ex-mus-${editingDayId}-${idx}`} defaultValue={String(ex.mus || "")} onBlur={e => modifyExerciseData(editingDayId, idx, 'mus', e.target.value)} className="w-full bg-zinc-900 p-2 rounded text-white text-sm outline-none" />
                                        </div>
                                        <div>
                                          <label className="text-[8px] text-zinc-500 uppercase font-bold block mb-1">Link YouTube</label>
                                          <input key={`ex-yt-${editingDayId}-${idx}`} defaultValue={String(ex.yt || "")} onBlur={e => modifyExerciseData(editingDayId, idx, 'yt', e.target.value)} placeholder="https://..." className="w-full bg-zinc-900 p-2 rounded text-white text-xs outline-none" />
                                        </div>
                                      </div>
                                      <div>
                                        <label className="text-[8px] text-zinc-500 uppercase font-bold block mb-1">Tip / Consejo</label>
                                        <textarea key={`ex-tip-${editingDayId}-${idx}`} defaultValue={String(ex.tip || "")} onBlur={e => modifyExerciseData(editingDayId, idx, 'tip', e.target.value)} className="w-full bg-zinc-900 p-2 rounded text-white text-xs outline-none" rows="2" />
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* AGREGAR EJERCICIO */}
                                <div className="bg-zinc-800 p-6 rounded-xl border border-zinc-700 space-y-4 mt-8">
                                  <h5 className="text-[10px] font-black uppercase text-zinc-400">Nuevo Ejercicio</h5>
                                  <div className="space-y-3">
                                    <label className="text-[9px] text-zinc-500 font-bold block">Selecciona de predefinidos:</label>
                                    <select value={selectedExerciseTemplate} onChange={e => selectExerciseTemplate(e.target.value)} className="w-full bg-zinc-900 p-2 rounded text-white text-xs outline-none border border-zinc-700">
                                      <option value="">-- Escoge un ejercicio --</option>
                                      {EJERCICIOS_PREDEFINIDOS.map(ex => <option key={ex.name} value={ex.name}>{ex.name} ({ex.mus})</option>)}
                                    </select>
                                  </div>
                                  {newEx.img && (
                                    <div className="text-center">
                                      <img src={newEx.img} alt={newEx.name} className="w-full h-24 object-cover rounded-lg" />
                                    </div>
                                  )}
                                  <input key={`newex-name-${editingDayId}`} type="text" placeholder="Nombre..." maxLength="50" className="w-full bg-zinc-900 p-2 rounded text-white text-sm outline-none border border-zinc-700" value={newEx.name} onChange={e => setNewEx({...newEx, name: e.target.value})} />
                                  <div className="grid grid-cols-2 gap-4">
                                    <input type="number" placeholder="Series" value={newEx.s} onChange={e => setNewEx({...newEx, s: parseInt(e.target.value) || 3})} className="bg-zinc-900 p-2 rounded text-white text-sm outline-none border border-zinc-700" />
                                    <input type="text" placeholder="Reps (ej: 10-12)" value={newEx.r} onChange={e => setNewEx({...newEx, r: e.target.value})} className="bg-zinc-900 p-2 rounded text-white text-sm outline-none border border-zinc-700" />
                                  </div>
                                  <input type="text" placeholder="Grupo muscular" value={newEx.mus} onChange={e => setNewEx({...newEx, mus: e.target.value})} maxLength="30" className="w-full bg-zinc-900 p-2 rounded text-white text-xs outline-none border border-zinc-700" />
                                  <input type="text" placeholder="Link YouTube" value={newEx.yt} onChange={e => setNewEx({...newEx, yt: sanitizeUrl(e.target.value)})} className="w-full bg-zinc-900 p-2 rounded text-white text-xs outline-none border border-zinc-700" />
                                  <textarea placeholder="Tip/Consejo" value={newEx.tip} onChange={e => setNewEx({...newEx, tip: e.target.value})} maxLength="100" className="w-full bg-zinc-900 p-2 rounded text-white text-xs outline-none border border-zinc-700" rows="2" />
                                  <button onClick={() => { if(newEx.name?.trim()) { updateUserInCloud(editingClientId, u => { const days = [...(Array.isArray(u.workoutData?.days) ? u.workoutData.days : [])]; const dIdx = days.findIndex(d => d.id === editingDayId); if(dIdx > -1) days[dIdx].exercises = [...(Array.isArray(days[dIdx].exercises) ? days[dIdx].exercises : []), { ...newEx, name: sanitizeInput(newEx.name), mus: sanitizeInput(newEx.mus), tip: sanitizeInput(newEx.tip) }]; return { ...u, workoutData: { ...u.workoutData, days } }; }); setNewEx({ name: "", s: 3, r: "12", tip: "", mus: "", yt: "", img: "" }); setSelectedExerciseTemplate(""); setToast({ type: "SUCCESS", message: "Ejercicio agregado ✓" }); setTimeout(() => setToast(null), 2500); } }} className="w-full bg-amber-500 text-black font-black py-2 rounded-lg text-[9px] uppercase active:scale-95">+ Añadir Ejercicio</button>
                                </div>
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

            <div className="grid grid-cols-1 gap-6 mt-8">
              {validDays.length === 0 && !isAdminMode ? (
                <div className="text-center py-10 opacity-40 font-bold text-sm italic">Rutina en construcción...</div>
              ) : null}
              {validDays.map(day => (
                <button key={day.id} onClick={() => navigateTo("day", day)} className={`${isAdminMode ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-zinc-100 text-zinc-900"} flex items-center justify-between p-6 rounded-[2rem] border shadow-sm active:scale-95 text-left`}>
                  <div className="flex items-center gap-4"><div className={`${isAdminMode ? "bg-zinc-800 text-amber-500" : "bg-gray-50 text-gray-500"} p-4 rounded-3xl transition-transform group-hover:scale-105`}><Dumbbell size={28}/></div><div><p className={`text-[9px] font-black uppercase tracking-widest ${isAdminMode ? "text-zinc-500" : "text-gray-400"}`}>{String(day.focus || "")}</p><h3 className="text-lg font-black tracking-tight">{String(day.title || "")}</h3></div></div>
                  <ChevronRight className={isAdminMode ? "text-zinc-700" : "text-gray-300"} size={24}/>
                </button>
              ))}
            </div>

            <div className={`${isAdminMode ? "bg-zinc-900 border-zinc-800 text-white" : "bg-amber-50 border-amber-100 text-zinc-900"} p-6 rounded-[2rem] border shadow-sm`}>
               <h3 className="text-[10px] font-black uppercase text-amber-600 mb-2 flex items-center gap-2"><LayoutDashboard size={14}/> Mensaje Coach</h3>
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
                  <button onClick={finishSession} className="flex items-center gap-1 text-xs font-bold text-red-400 bg-white/10 px-3 py-1.5 rounded-full">FINALIZAR</button>
               </div>
            )}
            <div className="flex justify-between items-center mt-12">
               <button onClick={() => navigateTo("home")} className="text-zinc-400 font-bold text-sm uppercase flex items-center gap-2"><ArrowLeft size={16}/> Volver</button>
               {!sessionStart && <button onClick={() => { setSessionStart(Date.now()); setSessionElapsed(0); }} className="bg-amber-500 text-black text-[10px] font-black px-6 py-2 rounded-full uppercase shadow-lg">INICIAR CRONO</button>}
            </div>
            <h2 className={`text-3xl font-black ${isAdminMode ? 'text-white' : 'text-gray-900'}`}>{String(selectedDay.title || "")}</h2>
            {selectedDay.warmupType && warmupData[selectedDay.warmupType] && (
              <div className="bg-zinc-900 text-white p-6 rounded-[2.5rem] shadow-xl border border-zinc-800">
                <h3 className="font-black text-xs uppercase tracking-widest flex items-center gap-2 mb-4"><Flame className="text-amber-500"/> {String(warmupData[selectedDay.warmupType].title || "Calentamiento")}</h3>
                <div className="space-y-3">
                   {(Array.isArray(warmupData[selectedDay.warmupType].steps) ? warmupData[selectedDay.warmupType].steps : []).map((s,i) => <div key={i} className="flex gap-3 text-[10px]"><div className="w-1 h-1 bg-amber-500 rounded-full mt-1.5 shrink-0" /><p><strong>{String(s.name || "")}:</strong> {String(s.detail || "")}</p></div>)}
                </div>
              </div>
            )}
            <div className="space-y-4">
              {(Array.isArray(selectedDay.exercises) ? selectedDay.exercises : []).map((ex, i) => (
                <ExerciseCard key={i} ex={ex} workoutLogs={workoutLogs} isAdmin={isAdminMode} onAddLog={addLogRecord} onDeleteLog={deleteLogRecord} onStartTimer={startTimerHook} accentColor={client.color} onUpdateImage={updateImageHook} dayId={selectedDay.id} onAddExerciseNote={addExerciseNote} exerciseNotes={client.exerciseNotes?.[ex.name] || []} />
              ))}
            </div>
          </div>
        )}

        {/* --- STATS --- */}
        {activeTab === "stats" && (
          <div className="space-y-8 animate-in fade-in duration-500 mt-4">
            <h2 className="text-2xl font-black">Evolución</h2>
            <div className={`flex gap-2 p-1 rounded-xl ${isAdminMode ? 'bg-zinc-900 border border-zinc-800' : 'bg-gray-100'}`}>
               <button onClick={() => setChartMode('weight')} className={`flex-1 py-2 text-[10px] font-bold rounded-lg ${chartMode==='weight' ? (isAdminMode ? 'bg-amber-500 text-black shadow' : 'bg-white shadow text-zinc-900') : 'text-zinc-500'}`}>PESO MÁX</button>
               <button onClick={() => setChartMode('volume')} className={`flex-1 py-2 text-[10px] font-bold rounded-lg ${chartMode==='volume' ? (isAdminMode ? 'bg-amber-500 text-black shadow' : 'bg-white shadow text-zinc-900') : 'text-zinc-500'}`}>VOLUMEN</button>
            </div>
            {Object.keys(workoutLogs).length === 0 && <div className="text-center py-20 opacity-30 italic">No hay datos registrados aún.</div>}
            {validDays.map(d => (Array.isArray(d.exercises) ? d.exercises : []).map((ex,i) => {
               const logsRaw = workoutLogs[ex.name];
               const l = Array.isArray(logsRaw) ? logsRaw : []; 
               if(l.length < 1) return null;
               const displayVal = chartMode === 'volume' ? (parseFloat(l[0]?.weight) || 0) * (parseInt(l[0]?.reps) || 10) * (parseInt(ex.s) || 3) : Math.max(...l.map(x=>parseFloat(x.weight) || 0));
               return (
                 <div key={`${d.id}-${i}`} className={`${isAdminMode ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-gray-100 text-gray-900"} p-6 rounded-[2rem] shadow-sm border`}>
                    <div className="flex justify-between items-start mb-2"><div><span className="text-[8px] text-zinc-400 uppercase font-black">{String(d.title || "").split(":")[0]}</span><h4 className="text-lg font-black leading-tight">{String(ex.name || "")}</h4></div><div className="text-amber-500 font-black text-sm">{displayVal}kg</div></div>
                    <MiniProgressChart data={l} color={client.color} isAdmin={isAdminMode} mode={chartMode} exSets={ex.s} />
                    {l.length > 1 && (
                      <ProgressBar 
                        label={ex.name}
                        current={parseFloat(l[0]?.weight) || 0}
                        previous={l.length > 1 ? parseFloat(l[Math.min(5, l.length - 1)]?.weight) || parseFloat(l[0]?.weight) : parseFloat(l[0]?.weight)}
                        color={isAdminMode ? "#f59e0b" : "#3b82f6"}
                      />
                    )}
                 </div>
               );
            }))}
          </div>
        )}

        {/* --- DIARIO --- */}
        {activeTab === "journal" && (
          <div className="space-y-8 animate-in fade-in duration-500 mt-4">
            <h2 className="text-2xl font-black">Diario</h2>
            <div className={`${isAdminMode ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-gray-100 text-gray-900"} p-6 rounded-[2rem] border shadow-sm space-y-3`}>
               <textarea placeholder="¿Cómo te has sentido hoy?..." className={`w-full ${isAdminMode ? "bg-zinc-950 border-zinc-800" : "bg-gray-50 border-gray-100"} border rounded-xl p-4 text-xs font-medium focus:border-amber-500 outline-none h-24`} value={noteText} onChange={e => setNoteText(e.target.value)} />
               <button onClick={addNoteRecord} className={`w-full ${isAdminMode ? "bg-amber-500 text-black" : "bg-blue-600 text-white"} font-black py-4 rounded-xl text-[10px] uppercase`}>Guardar Nota</button>
            </div>
            <div className="space-y-4">
              {validNotes.map(n => (
                <div key={n.id} className={`${isAdminMode ? "bg-zinc-900 border-zinc-800 text-zinc-300" : "bg-white border-gray-50 text-gray-700"} p-5 rounded-[1.5rem] border shadow-sm flex flex-col gap-3`}>
                   <div className="flex justify-between items-start w-full"><p className="text-sm leading-relaxed pr-4">{String(n.text || "")}</p><button onClick={() => updateUserInCloud(currentClientId, u => ({...u, notes: (Array.isArray(u.notes) ? u.notes : []).filter(x => x.id !== n.id)}))} className="text-red-400"><Trash2 size={14}/></button></div>
                   <div className="flex justify-between items-center"><span className="text-[9px] font-black text-zinc-400">{String(n.date || "")}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      <nav className={`fixed bottom-8 left-1/2 -translate-x-1/2 ${isAdminMode ? "bg-zinc-900/90 border-zinc-800" : "bg-white/90 border-gray-100"} backdrop-blur-md border px-8 py-5 rounded-[2.5rem] shadow-2xl flex items-center gap-8 z-50`}>
        <button onClick={() => navigateTo("home")} className={`transition-all ${activeTab === "home" ? "text-amber-500 scale-125" : "text-zinc-400"}`}><User size={24} /></button>
        <button onClick={() => { if(selectedDay) navigateTo("day", selectedDay); else if(validDays.length>0) navigateTo("day", validDays[0]); }} className={`transition-all ${activeTab === "day" ? "text-amber-500 scale-125" : "text-zinc-400"}`}><Dumbbell size={24} /></button>
        <button onClick={() => navigateTo("stats")} className={`transition-all ${activeTab === "stats" ? "text-amber-500 scale-125" : "text-zinc-400"}`}><TrendingUp size={24} /></button>
        <button onClick={() => navigateTo("journal")} className={`transition-all ${activeTab === "journal" ? "text-amber-500 scale-125" : "text-zinc-400"}`}><Heart size={24} /></button>
      </nav>

      {/* --- MODALES --- */}
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

      {showAddClientModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm">
           <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-[2rem] p-6 space-y-4 shadow-2xl">
              <h3 className="text-amber-500 font-black uppercase text-sm text-center">Nuevo Cliente</h3>
              <input type="text" placeholder="Usuario" className="w-full bg-zinc-800 p-4 rounded-xl text-xs text-white outline-none" value={newClient.username} onChange={e=>setNewClient({...newClient, username:e.target.value})} />
              <input type="text" placeholder="Contraseña" className="w-full bg-zinc-800 p-4 rounded-xl text-xs text-white outline-none" value={newClient.password} onChange={e=>setNewClient({...newClient, password:e.target.value})} />
              <input type="text" placeholder="Nombre completo" className="w-full bg-zinc-800 p-4 rounded-xl text-xs text-white outline-none" value={newClient.name} onChange={e=>setNewClient({...newClient, name:e.target.value})} />
              <button onClick={runCreateProfile} className="w-full bg-amber-500 text-black font-black py-4 rounded-xl text-[10px] uppercase">CREAR CUENTA</button>
              <button onClick={()=>setShowAddClientModal(false)} className="w-full text-zinc-500 text-[10px] font-bold">CANCELAR</button>
           </div>
        </div>
      )}

      {toast && (<div className="fixed top-12 left-1/2 -translate-x-1/2 z-[150] w-10/12 max-w-sm animate-in slide-in-from-top-10"><div className="bg-green-600 text-white p-4 rounded-2xl flex items-center gap-3 shadow-2xl border-2 border-white/20"><CheckCircle2 size={24}/> <span className="text-xs font-black uppercase tracking-widest">{String(toast.message)}</span></div></div>)}
    </div>
  );
}

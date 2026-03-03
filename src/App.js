import React, { useState, useEffect, useCallback, memo, useRef } from "react";
// Importaciones de Firebase
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  collection,
  onSnapshot,
  deleteDoc
} from "firebase/firestore";

import {
  Dumbbell,
  Flame,
  Info,
  ChevronRight,
  ArrowLeft,
  User,
  Heart,
  Youtube,
  PlusCircle,
  History,
  Trash2,
  Clock,
  MessageSquareHeart,
  X,
  Zap,
  Users,
  Settings,
  Plus,
  Edit3,
  TrendingUp,
  Trophy,
  Crown,
  LayoutDashboard,
  PlayCircle,
  CheckSquare,
  Camera,
  Key,
  Cloud,
  CheckCircle2,
  Copy,
  SaveAll,
  WifiOff,
  Calculator,
  BarChart2,
  Brain,
  Loader2,
  LogOut,
  FileText
} from "lucide-react";

// ==========================================
// CONFIGURACIÓN FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCSDIcqfl5LAAln4UbzEOBGAIPZ4hKeeec",
  authDomain: "athlos-5dcc5.firebaseapp.com",
  projectId: "athlos-5dcc5",
  storageBucket: "athlos-5dcc5.firebasestorage.app",
  messagingSenderId: "454935635191",
  appId: "1:454935635191:web:7d05c0952d56b99c3e9ff2",
  measurementId: "G-7YYW9DB0EL"
};

const app = initializeApp(firebaseConfig);
const db_cloud = getFirestore(app);
const COLLECTION_NAME = "athlos_clients";

// ==========================================
// FUNCIONES DE UTILIDAD PROTEGIDAS
// ==========================================

const safeJSONParse = (key, fallback) => {
  try {
    const item = localStorage.getItem(key);
    return item && item !== "undefined" ? JSON.parse(item) : fallback;
  } catch (e) { return fallback; }
};

const getSavedUser = () => {
  try {
    const local = localStorage.getItem("athlos_user_session_v36");
    if (local && local !== "undefined") return JSON.parse(local);
    const session = sessionStorage.getItem("athlos_user_session_v36");
    if (session && session !== "undefined") return JSON.parse(session);
  } catch (e) { return null; }
  return null;
};

// ==========================================
// CONFIGURACIÓN GEMINI API
// ==========================================
const apiKey = ""; 

const callGeminiAPI = async (prompt) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (error) {
    return "El Coach AI está en mantenimiento. 💪";
  }
};

// ==========================================
// BASE DE DATOS INICIAL
// ==========================================
const RUTINA_TAMARA_OFICIAL = [
  { id: 101, title: "DÍA 1: Glúteo Máximo & Cargas", focus: "Gym - 45 min", warmupType: "warmupAthlos", exercises: [
    { name: "Hip Thrust", s: 4, r: "8-10", tip: "Pausa de 2\" arriba. El más importante.", mus: "Glúteo", img: "https://images.unsplash.com/photo-1590239926044-23927693630f?auto=format&fit=crop&q=80&w=400" },
    { name: "Peso Muerto Rumano (DB)", s: 3, r: "10", tip: "Bajada 3 seg. Siente el estiramiento.", mus: "Isquios", img: "https://images.unsplash.com/photo-1594737625785-a2bad9931c60?auto=format&fit=crop&q=80&w=400" },
    { name: "Hiperextensiones", s: 3, r: "12", tip: "Barbilla al pecho para aislar glúteo.", mus: "Glúteo", img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=400" },
    { name: "Abducción en Máquina", s: 3, r: "15", tip: "Descanso corto (30\"). Bombeo final.", mus: "Glúteo Medio", img: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400" }
  ]},
  { id: 102, title: "DÍA 2: Torso & Postura", focus: "Anti-Oficina", warmupType: "warmupAthlos", exercises: [
    { name: "Jalón al Pecho (Neutro)", s: 3, r: "12", tip: "Hombros abajo, no tires con el cuello.", mus: "Espalda", img: "https://images.unsplash.com/photo-1591940742878-13aba4b7a35e?auto=format&fit=crop&q=80&w=400" },
    { name: "Remo en Polea Baja", s: 3, r: "12", tip: "Aprieta escápulas atrás.", mus: "Espalda Media", img: "https://images.unsplash.com/photo-1605296867304-46d5465a13f1?auto=format&fit=crop&q=80&w=400" },
    { name: "Press Militar (DB)", s: 3, r: "12", tip: "Estabilidad de core.", mus: "Hombros", img: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400" },
    { name: "Facepulls en Polea", s: 3, r: "20", tip: "Codos altos. Corrige la postura.", mus: "Hombro Post", img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=400" }
  ]},
  { id: 103, title: "DÍA 3: Glúteo Unilateral", focus: "Estabilidad", warmupType: "warmupAthlos", exercises: [
    { name: "Zancada Búlgara", s: 3, r: "10", tip: "Torso inclinado adelante.", mus: "Glúteo", img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=400" },
    { name: "Step-Up (Cajón)", s: 3, r: "12", tip: "Control en la bajada.", mus: "Glúteo", img: "https://images.unsplash.com/photo-1597452485669-2c7bb5fef90d?auto=format&fit=crop&q=80&w=400" },
    { name: "Curl Femoral Sentado", s: 3, r: "15", tip: "Aprieta fuerte abajo.", mus: "Isquios", img: "https://images.unsplash.com/photo-1591940742878-13aba4b7a35e?auto=format&fit=crop&q=80&w=400" },
    { name: "Patada de Glúteo", s: 3, r: "15", tip: "No arquees la espalda.", mus: "Glúteo", img: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400" }
  ]},
  { id: 104, title: "DÍA 4: Power Leg & Core", focus: "Fuerza global", warmupType: "warmupAthlos", exercises: [
    { name: "Prensa (Pies altos)", s: 3, r: "8-10", tip: "Pies arriba para más glúteo.", mus: "Piernas", img: "https://images.unsplash.com/photo-1574673139055-520448d31705?auto=format&fit=crop&q=80&w=400" },
    { name: "Hiperextensiones", s: 3, r: "12", tip: "Mordida del glúteo.", mus: "Glúteo", img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=400" },
    { name: "Elevación de Piernas", s: 3, r: "12-15", tip: "Sin balanceo.", mus: "Core", img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&q=80&w=400" },
    { name: "Plancha (Plank)", s: 3, r: "60s", tip: "Máxima tensión global.", mus: "Core", img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&q=80&w=400" }
  ]}
];

const INITIAL_DATABASE = {
  entrenador: { username: "coach", password: "1234", name: "Coach Jhon", color: "from-emerald-600 to-teal-500", subtitle: "Panel de Control", advice: "Calidad sobre cantidad.", logs: {}, notes: [], templates: [{ id: "tmpl_tamara", name: "Plantilla Athlos: Tamara (Anti-Oficina)", days: RUTINA_TAMARA_OFICIAL }], workoutData: { days: [] } },
  tamara: { username: "tamara", password: "1234", name: "Tamara", color: "from-blue-600 to-indigo-500", subtitle: "Glúteo & Postura", advice: "Estira psoas cada hora.", logs: {}, notes: [], workoutData: { days: RUTINA_TAMARA_OFICIAL } }
};

const warmupData = {
  warmupLower: { title: "Calentamiento Tren Inferior", steps: [{ name: "Círculos cadera", detail: "15/lado" }, { name: "Parabrisas", detail: "15/lado" }] },
  warmupUpper: { title: "Calentamiento Tren Superior", steps: [{ name: "Cat-Cow", detail: "10 reps" }, { name: "Rotaciones", detail: "10/lado" }] },
  warmupAthlos: { title: "Calentamiento Dinámico 'Athlos'", steps: [{ name: "90/90 Hip Flow", detail: "10 rotaciones sentado." }, { name: "Cat-Cow", detail: "10 reps lentas." }, { name: "Sentadillas", detail: "15 reps controladas." }] }
};

// ==========================================
// COMPONENTES AUXILIARES BLINDADOS
// ==========================================

const PlateDisplay = ({ weight }) => {
  const target = parseFloat(weight) || 0;
  if (target < 20) return <p className="text-[10px] text-zinc-500 mt-2 font-bold text-center italic">Mancuerna o Máquina</p>;
  const calculatePlates = (w) => {
    let side = (w - 20) / 2;
    if (side <= 0 || isNaN(side)) return [];
    const available = [25, 20, 15, 10, 5, 2.5, 1.25];
    let res = [];
    for (let p of available) {
      while (side >= p) { res.push(p); side = Math.round((side - p) * 100) / 100; }
    }
    return res;
  };
  const plates = calculatePlates(target);
  const colors = { 25: 'bg-red-500 text-white', 20: 'bg-blue-600 text-white', 15: 'bg-yellow-500 text-black', 10: 'bg-green-600 text-white', 5: 'bg-gray-100 text-black border', 2.5: 'bg-gray-800 text-white', 1.25: 'bg-zinc-400 text-black' };
  if (plates.length === 0) return <p className="text-[10px] text-zinc-500 mt-2 font-bold text-center">Barra olímpica (20kg)</p>;
  return (
    <div className="mt-3 bg-zinc-50 rounded-xl p-3 border border-zinc-100 flex flex-col items-center">
      <p className="text-[9px] font-black uppercase text-zinc-400 mb-2">Discos por lado (Barra 20kg)</p>
      <div className="flex items-center justify-center gap-0.5">
        <div className="w-12 h-1.5 bg-zinc-300 rounded-l-full" /><div className="w-2 h-4 bg-zinc-400 rounded-sm" />
        {plates.map((p, i) => <div key={i} className={`flex items-center justify-center font-black text-[9px] w-5 ${p >= 15 ? 'h-12' : 'h-8'} rounded-sm shadow-sm ${colors[p]}`}>{p}</div>)}
      </div>
    </div>
  );
};

const MiniProgressChart = ({ data, color, isAdmin, mode, exSets }) => {
  if (!data || data.length < 2) return null;
  const getVal = (d) => {
    const w = parseFloat(d.weight) || 0;
    return mode === 'volume' ? w * (parseInt(d.reps) || 10) * (parseInt(exSets) || 3) : w;
  };
  const vals = data.map(getVal).reverse();
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

const GlobalRestTimer = ({ initialSeconds, onCancel }) => {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);
  const formatTime = (time) => {
    const mins = Math.floor(time / 60);
    const secs = time % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  return (
    <div className="sticky top-2 z-50 flex justify-center pointer-events-none mb-4">
      <div className={`pointer-events-auto shadow-2xl flex items-center gap-3 px-6 py-3 rounded-full font-black text-sm transition-all transform scale-110 border-2 border-white ${timeLeft > 0 ? 'bg-orange-500 text-white animate-pulse' : 'bg-green-500 text-white'}`}>
        <Clock size={18} /> 
        <span>{timeLeft > 0 ? `DESCANSO: ${formatTime(timeLeft)}` : "¡VAMOS A POR OTRA! 🔥"}</span>
        <button onClick={onCancel} className="ml-2 bg-black/10 hover:bg-black/20 rounded-full p-1"><X size={14} /></button>
      </div>
    </div>
  );
};

const getTargetReps = (repString) => {
  if (!repString) return 10;
  const match = String(repString).match(/\d+/g);
  if (!match) return 10;
  if (match.length > 1) return Math.floor((parseInt(match[0]) + parseInt(match[1])) / 2);
  return parseInt(match[0]);
};

const calculate1RM = (weight, reps) => {
  const w = parseFloat(weight);
  if (isNaN(w)) return 0;
  return w * (1 + (parseInt(reps) || 1) / 30);
};

const ExerciseCard = memo(({ ex, workoutLogs, onAddLog, onDeleteLog, onStartTimer, accentColor, isAdmin, onUpdateImage, dayId }) => {
  const [localWeight, setLocalWeight] = useState("");
  const [localReps, setLocalReps] = useState("");
  const [showCalc, setShowCalc] = useState(false);
  const fileInput = useRef(null);

  const safeName = String(ex?.name || "");
  const safeMus = String(ex?.mus || "Fuerza");
  const safeS = String(ex?.s || "-");
  const safeR = String(ex?.r || "-");
  const safeTip = String(ex?.tip || "Concéntrate en la técnica.");

  const logs = workoutLogs[safeName] || [];
  const latestW = logs.length > 0 ? parseFloat(logs[0].weight) : 0;
  const maxW = logs.length > 0 ? Math.max(...logs.map(l => parseFloat(l.weight) || 0)) : 0;

  const handleAddLog = () => {
    if (!localWeight) return;
    const match = safeR.match(/\d+/g);
    const targetReps = match ? Math.floor((parseInt(match[0]) + parseInt(match[1] || match[0])) / 2) : 10;
    onAddLog(safeName, localWeight, localReps || targetReps);
    setLocalWeight(""); setLocalReps(""); setShowCalc(false);
  };

  return (
    <div className={`${isAdmin ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-100"} rounded-[2.5rem] border shadow-sm overflow-hidden mb-6`}>
      <div className="relative h-52 bg-zinc-800 group">
        <img src={ex.img} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400'; }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        {isAdmin && (
           <button onClick={() => fileInput.current.click()} className="absolute top-4 left-4 bg-black/60 p-2 rounded-xl text-white z-10"><Camera size={18} /><input type="file" ref={fileInput} className="hidden" onChange={e => {
             const file = e.target.files[0];
             const reader = new FileReader();
             reader.onload = (ev) => onUpdateImage(dayId, safeName, ev.target.result);
             if(file) reader.readAsDataURL(file);
           }}/></button>
        )}
        <div className="absolute bottom-4 left-6 text-white">
          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${isAdmin ? "bg-amber-500 text-black" : "bg-indigo-500 text-white"} mb-1 inline-block`}>{safeMus}</span>
          <h4 className="text-xl font-black">{safeName}</h4>
        </div>
        {ex.yt && <a href={ex.yt} target="_blank" rel="noreferrer" className="absolute top-4 right-4 bg-white/20 p-3 rounded-2xl text-white"><Youtube size={22} /></a>}
      </div>
      <div className="p-6">
        <div className="grid grid-cols-2 gap-3 mb-6 text-center">
          <div className="bg-zinc-100/50 dark:bg-zinc-800 p-3 rounded-2xl"><p className="text-[9px] font-bold text-zinc-400 uppercase">Series</p><p className={`text-xl font-black ${isAdmin ? "text-amber-500" : "text-gray-900"}`}>{safeS}</p></div>
          <div className="bg-zinc-100/50 dark:bg-zinc-800 p-3 rounded-2xl"><p className="text-[9px] font-bold text-zinc-400 uppercase">Reps</p><p className={`text-xl font-black ${isAdmin ? "text-amber-500" : "text-gray-900"}`}>{safeR}</p></div>
        </div>
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            {logs.slice(0, 3).map(l => (
              <div key={l.id} className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <span className={`text-xs font-bold ${isAdmin ? "text-amber-500" : "text-indigo-600"}`}>{String(l.weight)}kg x {String(l.reps)}</span>
                <div className="flex items-center gap-3"><span className="text-[9px] text-zinc-400">{String(l.date)}</span><button onClick={() => onDeleteLog(safeName, l.id)} className="text-red-400"><Trash2 size={12}/></button></div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="number" placeholder="Peso" className="w-full bg-zinc-50 dark:bg-zinc-800 border rounded-xl p-3 text-sm font-bold outline-none" value={localWeight} onChange={e => setLocalWeight(e.target.value)} />
            <input type="number" placeholder="R" className="w-16 bg-zinc-50 dark:bg-zinc-800 border rounded-xl p-3 text-sm font-bold text-center outline-none" value={localReps} onChange={e => setLocalReps(e.target.value)} />
            <button onClick={() => setShowCalc(!showCalc)} className={`p-3 rounded-xl border ${showCalc ? 'bg-amber-500 text-black border-amber-600' : 'bg-zinc-100 text-zinc-400 border-zinc-200'}`}><Calculator size={18}/></button>
            <button onClick={handleAddLog} className={`p-3 rounded-xl shadow-md ${isAdmin ? "bg-amber-500 text-black" : "bg-black text-white"}`}><PlusCircle size={20}/></button>
          </div>
          {showCalc && <PlateDisplay weight={localWeight || latestW || 0} />}
          <div className={`${isAdmin ? "bg-amber-500/10 border-amber-500/20" : "bg-indigo-50 border-indigo-100"} p-3 rounded-xl border flex gap-2`}>
            <Info size={14} className={`${isAdmin ? "text-amber-500" : "text-indigo-500"} shrink-0 mt-0.5`} /><p className="text-[11px] italic text-zinc-600 dark:text-zinc-400 leading-tight">"{safeTip}"</p>
          </div>
        </div>
      </div>
    </div>
  );
});

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
export default function App() {
  const [db, setDb] = useState(() => safeJSONParse("athlos_coach_db_v36", INITIAL_DATABASE));
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Mantenimiento de sesión (claves actualizadas para forzar reseteo si había basura en caché)
  const [loggedInUser, setLoggedInUser] = useState(() => getSavedUser());
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
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
  const [newEx, setNewEx] = useState({ name: "", s: 3, r: "12", tip: "", mus: "", yt: "", img: "" });
  const [newDay, setNewDay] = useState({ title: "", focus: "", warmupType: "warmupLower" });
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", username: "", password: "", sourceTemplate: "" });
  
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState("");
  const [sourceClientToCopy, setSourceClientToCopy] = useState("");

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdError, setPwdError] = useState("");

  const [toast, setToast] = useState(null);
  const [chartMode, setChartMode] = useState('weight');
  const [isGeneratingTip, setIsGeneratingTip] = useState(false);
  const [loadingAiNoteId, setLoadingAiNoteId] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [timerDuration, setTimerDuration] = useState(null);
  const [timerKey, setTimerKey] = useState(0);

  const lastBackPress = useRef(0);
  const [showExitToast, setShowExitToast] = useState(false);

  // RENOMBRAMIENTO MAESTRO DE FUNCIONES PARA VACIAR CACHÉ
  const authenticateUser = async () => {
    setLoginError("");
    const input = loginUser.toLowerCase().trim();
    if (!input) return;
    try {
      if (input === "coach" && loginPass === "1234") {
        const id = "entrenador";
        setLoggedInUser(id); setCurrentClientId(id); setIsAdminMode(true);
        if (keepLoggedIn) localStorage.setItem("athlos_user_session_v36", JSON.stringify(id));
        else sessionStorage.setItem("athlos_user_session_v36", JSON.stringify(id));
        return;
      }

      let foundUser = db[input] || INITIAL_DATABASE[input];
      if (navigator.onLine && !foundUser) {
         const docSnap = await getDoc(doc(db_cloud, COLLECTION_NAME, input));
         if (docSnap.exists()) foundUser = docSnap.data();
      }

      if (foundUser && foundUser.password === loginPass) {
        setLoggedInUser(input);
        setCurrentClientId(input);
        setIsAdminMode(input === 'entrenador' || input === 'coach');
        if (keepLoggedIn) localStorage.setItem("athlos_user_session_v36", JSON.stringify(input));
        else sessionStorage.setItem("athlos_user_session_v36", JSON.stringify(input));
      } else { setLoginError("Usuario o contraseña incorrectos"); }
    } catch (e) { setLoginError("Error de red."); }
  };

  const signOutUser = () => {
    setLoggedInUser(null); setIsAdminMode(false); 
    localStorage.removeItem("athlos_user_session_v36"); 
    sessionStorage.removeItem("athlos_user_session_v36");
    setDataLoaded(false);
  };

  const modifyDayData = (id, field, val) => {
    updateUserInCloud(currentClientId, (u) => ({ ...u, workoutData: { ...u.workoutData, days: (u.workoutData.days || []).map(d => d.id === id ? {...d, [field]: val} : d) } }));
  };

  const modifyExerciseData = (dayId, idx, field, val) => {
    updateUserInCloud(currentClientId, (u) => {
      const days = [...(u.workoutData.days || [])];
      const dIdx = days.findIndex(d => d.id === dayId);
      if(dIdx > -1) days[dIdx].exercises[idx] = { ...days[dIdx].exercises[idx], [field]: val };
      return { ...u, workoutData: { ...u.workoutData, days } };
    });
  };

  const removeExerciseFromDay = (dayId, exIdx) => {
    updateUserInCloud(currentClientId, (u) => {
      const days = [...(u.workoutData.days || [])];
      const dIdx = days.findIndex(d => d.id === dayId);
      if (dIdx > -1) days[dIdx].exercises.splice(exIdx, 1);
      return { ...u, workoutData: { ...u.workoutData, days } };
    });
    setToast({ type: "SUCCESS", message: "Ejercicio borrado" });
    setTimeout(() => setToast(null), 2500);
  };

  const applyTemplateRoutine = (source) => {
    if (!source) return;
    let days = [];
    if (source.startsWith("tmpl_")) {
      const tId = source.replace("tmpl_", "");
      days = (db.entrenador?.templates || []).find(t => t.id === tId)?.days || [];
    } else {
      const cId = source.replace("client_", "");
      days = db[cId]?.workoutData?.days || [];
    }
    updateUserInCloud(currentClientId, (u) => ({ ...u, workoutData: { ...u.workoutData, days: JSON.parse(JSON.stringify(days)) } }));
    setToast({ type: "SUCCESS", message: "Rutina aplicada" });
    setTimeout(() => setToast(null), 2500);
    setShowEditor(false);
  };

  const saveRoutineTemplate = () => {
    if (!templateNameInput.trim()) return;
    const newTmpl = { id: Date.now().toString(), name: templateNameInput, days: JSON.parse(JSON.stringify(db[currentClientId].workoutData.days)) };
    updateUserInCloud('entrenador', (coach) => ({ ...coach, templates: [...(coach.templates || []), newTmpl] }));
    setToast({ type: "SUCCESS", message: "Plantilla guardada" });
    setTimeout(() => { setToast(null); setIsSavingTemplate(false); setTemplateNameInput(""); }, 2500);
  };

  const removeRoutineTemplate = (tmplId) => {
    updateUserInCloud('entrenador', (coachData) => ({ ...coachData, templates: (coachData.templates || []).filter(t => t.id !== tmplId) }));
    setToast({ type: "SUCCESS", message: "Plantilla borrada" });
    setTimeout(() => setToast(null), 2500);
  };

  const createNewDay = () => {
    if (!newDay.title) return;
    updateUserInCloud(currentClientId, (u) => ({ ...u, workoutData: { ...u.workoutData, days: [...(u.workoutData.days || []), { id: Date.now(), ...newDay, exercises: [] }] } }));
    setNewDay({ title: "", focus: "", warmupType: "warmupLower" });
  };

  const removeDayFromRoutine = (dayId) => {
    updateUserInCloud(currentClientId, (u) => ({ ...u, workoutData: { ...u.workoutData, days: (u.workoutData.days || []).filter(d => d.id !== dayId) } }));
    setToast({ type: "SUCCESS", message: "Día borrado" });
    setTimeout(() => setToast(null), 2500);
  };

  const appendNewExercise = () => {
    if (!newEx.name || !targetDayId) return;
    updateUserInCloud(currentClientId, (u) => {
       const days = (u.workoutData.days || []).map(d => d.id.toString() === targetDayId.toString() ? { ...d, exercises: [...(d.exercises || []), newEx] } : d);
       return { ...u, workoutData: { ...u.workoutData, days } };
    });
    setNewEx({ name: "", s: 3, r: "12", tip: "", mus: "", yt: "", img: "" });
  };

  const removeClientAccount = async () => {
    if (currentClientId === 'entrenador' || currentClientId === 'coach') return;
    setIsSyncing(true);
    await deleteDoc(doc(db_cloud, COLLECTION_NAME, currentClientId)).catch(()=>{});
    setDb(prev => { const n = {...prev}; delete n[currentClientId]; return n; });
    setCurrentClientId('entrenador');
    setIsSyncing(false);
    setToast({ type: "SUCCESS", message: "Cliente eliminado" });
    setTimeout(() => setToast(null), 2500);
  };

  const createClientProfile = () => {
    if (!newClient.name || !newClient.username || !newClient.password) {
      setToast({ type: "ERROR", message: "Faltan datos por rellenar" });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    const id = newClient.username.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_");
    
    let sourceDays = [];
    if (newClient.sourceTemplate.startsWith("tmpl_")) {
      const tmplId = newClient.sourceTemplate.replace("tmpl_", "");
      sourceDays = (db.entrenador?.templates || []).find(t => t.id === tmplId)?.days || [];
    } else if (newClient.sourceTemplate.startsWith("client_")) {
      const cId = newClient.sourceTemplate.replace("client_", "");
      sourceDays = db[cId]?.workoutData?.days || [];
    }

    const newUserObj = {
      username: newClient.username.toLowerCase(), password: newClient.password, name: newClient.name, color: "from-blue-600 to-indigo-500", subtitle: "Nuevo Plan", advice: "A darlo todo.", logs: {}, notes: [], 
      workoutData: { days: JSON.parse(JSON.stringify(sourceDays)) }
    };
    updateUserInCloud(id, () => newUserObj);
    setCurrentClientId(id);
    setShowAddClientModal(false);
    setNewClient({ name: "", username: "", password: "", sourceTemplate: "" });
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, []);

  const updateUserInCloud = useCallback((userId, modifierFn) => {
    setDb(prev => {
      const current = prev[userId] || INITIAL_DATABASE[userId] || { workoutData: { days: [] }, logs: {}, notes: [] };
      const next = modifierFn(current);
      if (navigator.onLine) {
        setIsSyncing(true);
        setDoc(doc(db_cloud, COLLECTION_NAME, userId), next).then(() => setIsSyncing(false)).catch(() => setIsSyncing(false));
      } else {
        setDoc(doc(db_cloud, COLLECTION_NAME, userId), next).catch(()=>{});
      }
      return { ...prev, [userId]: next };
    });
  }, []);

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
         Object.keys(INITIAL_DATABASE).forEach(k => setDoc(doc(db_cloud, COLLECTION_NAME, k), INITIAL_DATABASE[k]));
         setDb(INITIAL_DATABASE);
      } else {
         if(!cloud.entrenador?.templates) {
           if (!cloud.entrenador) cloud.entrenador = INITIAL_DATABASE.entrenador;
           cloud.entrenador.templates = INITIAL_DATABASE.entrenador.templates;
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

  useEffect(() => {
    if (loggedInUser && db[loggedInUser]) {
      setCurrentClientId(loggedInUser);
      setIsAdminMode(loggedInUser === 'entrenador' || loggedInUser === 'coach');
    }
  }, [loggedInUser, db]);


  const handleAddLog = useCallback((exName, weight, reps) => {
    const dateStr = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    updateUserInCloud(currentClientId, (u) => {
      const logs = u.logs || {};
      return { ...u, logs: { ...logs, [exName]: [{ weight, reps, date: dateStr, id: Date.now() }, ...(logs[exName] || [])].slice(0, 15) } };
    });
  }, [currentClientId, updateUserInCloud]);

  const handleDeleteLog = useCallback((exName, logId) => {
    updateUserInCloud(currentClientId, (u) => ({ ...u, logs: { ...u.logs, [exName]: (u.logs[exName] || []).filter(l => l.id !== logId) } }));
  }, [currentClientId, updateUserInCloud]);

  const addNote = () => {
    if (!noteText) return;
    const dateStr = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    updateUserInCloud(currentClientId, (u) => ({ ...u, notes: [{ text: noteText, date: dateStr, id: Date.now() }, ...(u.notes || [])] }));
    setNoteText("");
  };

  const handleAiCoachReply = async (noteId, text) => {
    setLoadingAiNoteId(noteId);
    const clientName = db[currentClientId]?.name || "Cliente";
    const reply = await callGeminiAPI(`El cliente ${clientName} dice: "${text}". Responde como su entrenador con un mensaje motivador de 2 líneas con algún emoji.`);
    if (reply) {
      updateUserInCloud(currentClientId, (userData) => ({
        ...userData, notes: (userData.notes || []).map(n => n.id === noteId ? { ...n, aiReply: reply.trim() } : n)
      }));
    }
    setLoadingAiNoteId(null);
  };

  const handleChangePassword = () => {
    if (db[currentClientId].password !== pwdCurrent) { setPwdError("Actual incorrecta"); return; }
    if (pwdNew.length < 4) { setPwdError("Mínimo 4 caracteres"); return; }
    if (pwdNew !== pwdConfirm) { setPwdError("Las contraseñas no coinciden"); return; }
    updateUserInCloud(currentClientId, (userData) => ({ ...userData, password: pwdNew }));
    setPwdSuccess("¡Éxito!");
    setTimeout(() => { setShowPasswordModal(false); setPwdCurrent(""); setPwdNew(""); setPwdConfirm(""); setPwdSuccess(""); }, 2000);
  };

  const handleUpdateImage = useCallback((dayId, exName, newImgBase64) => {
    updateUserInCloud(currentClientId, (userData) => {
      const dayIdx = userData.workoutData.days.findIndex((d) => d.id === dayId);
      if (dayIdx !== -1) {
        const exIdx = userData.workoutData.days[dayIdx].exercises.findIndex((e) => e.name === exName);
        if (exIdx !== -1) userData.workoutData.days[dayIdx].exercises[exIdx].img = newImgBase64;
      }
      return userData;
    });
  }, [currentClientId, updateUserInCloud]);

  const handleStartTimer = useCallback((s) => {
    setTimerDuration(s);
    setTimerKey((k) => k + 1);
  }, []);

  const finishSession = () => {
    setToast({ type: "SUCCESS", message: `¡SESIÓN TERMINADA! 🎉` });
    setSessionStart(null); setTimeout(() => setToast(null), 3000); navigateTo("home");
  };

  const navigateTo = (tab, day = null) => { setActiveTab(tab); setSelectedDay(day); window.scrollTo(0,0); };

  useEffect(() => {
    window.history.replaceState({ tab: "home" }, "");
    const handlePopState = (e) => {
      if (!loggedInUser) return;
      if (e.state && e.state.tab !== 'home') {
        setActiveTab(e.state.tab);
      } else {
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
    } else {
      setTargetDayId("");
    }
  }, [currentClientId, db, targetDayId]);

  if (!loggedInUser) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="w-full max-w-sm animate-in fade-in zoom-in duration-500">
          <div className="text-center mb-10"><div className="bg-zinc-900 w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 border border-zinc-800 shadow-xl"><Dumbbell className="text-amber-500" size={32}/></div><h1 className="text-3xl font-black tracking-tighter">ATHLOS</h1><p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mt-1">Entrenamiento Pro</p></div>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-2">Usuario</label>
              <input type="text" placeholder="Escribe tu usuario..." className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-2xl px-5 py-4 text-left text-sm font-bold text-white focus:outline-none focus:border-amber-500 transition-colors placeholder:text-zinc-600 placeholder:font-normal" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-2">Contraseña</label>
              <input type="password" placeholder="••••" className={`w-full bg-zinc-900 border-2 border-zinc-800 rounded-2xl px-5 py-4 text-left text-sm font-bold focus:outline-none focus:border-amber-500 transition-colors ${loginPass ? 'text-amber-500 tracking-[0.5em]' : 'text-white tracking-normal'}`} value={loginPass} onChange={(e) => setLoginPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && performLogin()} />
            </div>
            <label className="flex items-center gap-2 text-zinc-400 text-xs font-bold pl-2 cursor-pointer mt-2">
              <input type="checkbox" checked={keepLoggedIn} onChange={(e) => setKeepLoggedIn(e.target.checked)} className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-amber-500 accent-amber-500" />
              Mantener sesión iniciada
            </label>
            {loginError && <p className="text-red-500 text-xs font-bold text-center bg-red-500/10 p-2 rounded-lg">{String(loginError)}</p>}
            <button onClick={authenticateUser} className="w-full bg-amber-500 text-black font-black py-5 rounded-2xl uppercase text-xs shadow-lg active:scale-95 transition-all mt-4">Acceder</button>
          </div>
        </div>
      </div>
    );
  }

  // Previene el bucle si no encuentra el cliente o está cargando en la nube.
  if (!dataLoaded || !db[currentClientId]) {
     if (dataLoaded && !db[currentClientId]) {
       signOutUser();
     }
     return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-amber-500"><Loader2 className="animate-spin" size={40} /></div>;
  }

  const client = db[currentClientId];
  const workoutLogs = client.logs || {};

  return (
    <div className={`min-h-screen font-sans transition-colors duration-500 ${isAdminMode ? "bg-black text-white" : "bg-[#FDFDFD] text-zinc-900"}`}>
      <div className="max-w-md mx-auto p-6 pb-32">
        
        <div className="flex justify-between items-center mb-6">
           <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">{isOnline ? 'Online' : 'Offline'}</span>
           </div>
           <div className="flex gap-2">
              {loggedInUser === 'entrenador' && !isAdminMode && <button onClick={() => setIsAdminMode(true)} className="bg-amber-500/10 text-amber-600 p-2 rounded-xl border border-amber-500/20"><Settings size={18}/></button>}
              <button onClick={() => setShowPasswordModal(true)} className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded-xl"><Key size={18}/></button>
              <button onClick={signOutUser} className="bg-red-50 text-red-500 p-2 rounded-xl border border-red-100"><LogOut size={18}/></button>
           </div>
        </div>

        {activeTab === "home" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className={`bg-gradient-to-br ${isAdminMode ? "from-zinc-800 to-zinc-900 border border-zinc-700" : String(client.color || "from-blue-600 to-indigo-500")} p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden`}>
              <div className="flex flex-col gap-2 relative z-10">
                 {isAdminMode ? (
                   <div className="space-y-2">
                     <input defaultValue={String(client.name || "Cliente")} onBlur={e => updateUserInCloud(currentClientId, u => ({...u, name: e.target.value}))} className="bg-transparent text-3xl font-black uppercase outline-none border-b border-white/20 w-full" />
                     <input defaultValue={String(client.subtitle || "")} onBlur={e => updateUserInCloud(currentClientId, u => ({...u, subtitle: e.target.value}))} className="bg-transparent text-sm font-medium italic opacity-80 outline-none w-full" />
                   </div>
                 ) : (
                   <>
                     <h1 className="text-3xl font-black uppercase tracking-tight">{String(client.name || "Cliente")}</h1>
                     <p className="text-sm font-medium italic opacity-80">{String(client.subtitle || "")}</p>
                   </>
                 )}
              </div>
              <Zap className="absolute -bottom-4 -right-4 w-32 h-32 opacity-10 rotate-12" />
            </div>

            {isAdminMode && (
              <div className="bg-zinc-900 p-6 rounded-[2rem] border border-zinc-800 shadow-2xl space-y-6">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  <div className="flex items-center gap-2"><Users size={14} className="text-amber-500" /> Clientes</div>
                  <button onClick={() => setShowAddClientModal(true)} className="bg-zinc-800 text-amber-500 px-3 py-1.5 rounded-lg active:scale-95 transition-all"><Plus size={12}/> Nuevo</button>
                </div>
                <div className="flex gap-3 overflow-x-auto scrollbar-hide">
                  {Object.keys(db).map(id => (
                    <button key={id} onClick={() => { setCurrentClientId(id); setShowEditor(false); }} className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase shrink-0 transition-all ${currentClientId === id ? 'bg-amber-500 text-black shadow-lg scale-105' : 'bg-zinc-800 text-zinc-500'}`}>{String(db[id].name || id)}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                   <button onClick={() => setShowEditor(!showEditor)} className={`${showEditor ? "bg-amber-500 text-black border-amber-600" : "bg-zinc-800 text-white border-zinc-700"} py-4 rounded-xl text-[10px] font-black uppercase border transition-all flex items-center justify-center gap-2`}><Edit3 size={14}/> {showEditor ? 'Cerrar Edición' : 'Editar Rutina'}</button>
                   <button onClick={removeClientAccount} className="bg-red-500/10 text-red-500 py-4 rounded-xl text-[10px] font-black uppercase border border-red-500/20 flex justify-center items-center gap-2"><Trash2 size={14}/> Eliminar</button>
                </div>

                {showEditor && (
                   <div className="space-y-4 animate-in slide-in-from-top-4 border-t border-zinc-800 pt-4">
                     <div className="flex gap-2 bg-zinc-800 p-1 rounded-xl">
                       <button onClick={() => setEditorTab("day")} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase ${editorTab === "day" ? "bg-zinc-700 text-amber-500" : "text-zinc-500"}`}>Días</button>
                       <button onClick={() => setEditorTab("exercise")} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase ${editorTab === "exercise" ? "bg-zinc-700 text-amber-500" : "text-zinc-500"}`}>Ejercicios</button>
                       <button onClick={() => setEditorTab("template")} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase ${editorTab === "template" ? "bg-zinc-700 text-amber-500" : "text-zinc-500"}`}>Plantillas</button>
                     </div>

                     {editorTab === "day" && (
                       <div className="space-y-4">
                         {(client.workoutData.days || []).map(d => (
                            <div key={d.id} className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700 space-y-2">
                               <div className="flex justify-between items-center"><span className="text-[9px] text-zinc-500 font-bold uppercase">Editar Día</span><button onClick={() => removeDayFromRoutine(d.id)} className="text-red-500"><Trash2 size={14}/></button></div>
                               <input defaultValue={String(d.title || "")} onBlur={e => modifyDayData(d.id, 'title', e.target.value)} className="w-full bg-zinc-900 rounded-lg p-2 text-xs font-bold text-white outline-none focus:border-amber-500" />
                               <input defaultValue={String(d.focus || "")} onBlur={e => modifyDayData(d.id, 'focus', e.target.value)} className="w-full bg-zinc-900 rounded-lg p-2 text-xs text-white outline-none focus:border-amber-500" />
                               <select defaultValue={String(d.warmupType || "warmupLower")} onChange={e => modifyDayData(d.id, 'warmupType', e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-xs font-bold text-amber-500 outline-none focus:border-amber-500">
                                 <option value="warmupLower">Calentamiento Tren Inferior</option>
                                 <option value="warmupUpper">Calentamiento Tren Superior</option>
                                 <option value="warmupAthlos">Calentamiento Dinámico 'Athlos'</option>
                               </select>
                            </div>
                         ))}
                         <input type="text" placeholder="Nuevo Día..." className="w-full bg-zinc-800 border border-zinc-700 p-3 rounded-xl text-xs text-white outline-none" value={newDay.title} onChange={e => setNewDay({...newDay, title: e.target.value})} />
                         <button onClick={createNewDay} className="w-full bg-amber-500 text-black font-black py-3 rounded-xl text-[10px]">CREAR DÍA NUEVO</button>
                       </div>
                     )}

                     {editorTab === "exercise" && (
                       <div className="space-y-4">
                         <select value={targetDayId} onChange={e => setTargetDayId(e.target.value)} className="w-full bg-zinc-900 p-3 rounded-xl text-xs font-bold text-amber-500 outline-none">
                           <option value="">Selecciona el día a editar...</option>
                           {(client.workoutData.days || []).map(d => <option key={d.id} value={d.id}>{String(d.title || "Día")}</option>)}
                         </select>
                         {targetDayId && (client.workoutData.days || []).find(d => d.id.toString() === targetDayId)?.exercises.map((ex, idx) => (
                           <div key={idx} className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700 space-y-2">
                              <div className="flex justify-between items-center"><span className="text-[9px] text-zinc-500 font-bold">Ejercicio {idx + 1}</span><button onClick={() => removeExerciseFromDay(parseInt(targetDayId), idx)} className="text-red-500"><Trash2 size={12}/></button></div>
                              <input defaultValue={String(ex.name || "")} onBlur={e => modifyExerciseData(parseInt(targetDayId), idx, 'name', e.target.value)} className="w-full bg-zinc-900 rounded-lg p-2 text-xs font-bold text-white outline-none focus:border-amber-500" />
                              <div className="grid grid-cols-2 gap-2"><input defaultValue={String(ex.s || "")} onBlur={e => modifyExerciseData(parseInt(targetDayId), idx, 's', e.target.value)} className="bg-zinc-900 p-2 rounded text-xs text-white outline-none" placeholder="Series" /><input defaultValue={String(ex.r || "")} onBlur={e => modifyExerciseData(parseInt(targetDayId), idx, 'r', e.target.value)} className="bg-zinc-900 p-2 rounded text-xs text-white outline-none" placeholder="Reps" /></div>
                              <textarea defaultValue={String(ex.tip || "")} onBlur={e => modifyExerciseData(parseInt(targetDayId), idx, 'tip', e.target.value)} className="w-full bg-zinc-900 p-2 rounded text-[10px] italic text-white outline-none" />
                           </div>
                         ))}
                         {targetDayId && (
                           <>
                             <input type="text" placeholder="Nuevo Ejercicio..." className="w-full bg-zinc-800 border border-zinc-700 p-3 rounded-xl text-xs text-white outline-none" value={newEx.name} onChange={e => setNewEx({...newEx, name: e.target.value})} />
                             <button onClick={appendNewExercise} className="w-full bg-amber-500 text-black font-black py-3 rounded-xl text-[10px]">AÑADIR EJERCICIO</button>
                           </>
                         )}
                       </div>
                     )}

                     {editorTab === "template" && (
                       <div className="space-y-4">
                         <div className="bg-zinc-800 p-4 rounded-xl border border-zinc-700">
                            <p className="text-[10px] text-zinc-400 font-bold uppercase mb-2">Aplicar plantilla de:</p>
                            <select value={sourceClientToCopy} onChange={e => setSourceClientToCopy(e.target.value)} className="w-full bg-zinc-900 p-3 rounded-xl text-xs text-white outline-none mb-3">
                               <option value="">Selecciona origen...</option>
                               {db.entrenador?.templates?.map(t => <option key={t.id} value={`tmpl_${t.id}`}>Plantilla: {String(t.name || "")}</option>)}
                               {Object.keys(db).map(id => <option key={id} value={`client_${id}`}>Cliente: {String(db[id].name || id)}</option>)}
                            </select>
                            <button onClick={() => applyTemplateRoutine(sourceClientToCopy)} disabled={!sourceClientToCopy} className="w-full bg-blue-600 text-white font-black py-3 rounded-xl text-[10px] disabled:opacity-50">SOBRESCRIBIR RUTINA</button>
                         </div>
                         {!isSavingTemplate ? (
                           <button onClick={() => setIsSavingTemplate(true)} className="w-full bg-zinc-800 border border-zinc-700 text-amber-500 py-3 rounded-xl text-[10px] font-black">GUARDAR COMO PLANTILLA</button>
                         ) : (
                           <div className="bg-zinc-800 p-4 rounded-xl space-y-2 border border-zinc-700">
                             <input type="text" placeholder="Nombre para la plantilla..." className="w-full bg-zinc-900 p-3 rounded-xl text-xs text-white outline-none" value={templateNameInput} onChange={e => setTemplateNameInput(e.target.value)} />
                             <div className="flex gap-2"><button onClick={saveRoutineTemplate} className="flex-1 bg-amber-500 text-black font-black py-2 rounded-lg text-[10px]">GUARDAR</button><button onClick={() => setIsSavingTemplate(false)} className="flex-1 bg-zinc-700 text-white py-2 rounded-lg text-[10px]">CANCELAR</button></div>
                           </div>
                         )}
                         {currentClientId === 'entrenador' && db.entrenador?.templates?.length > 0 && (
                           <div className="pt-2">
                             <p className="text-[10px] text-red-400 font-bold uppercase mb-2">Borrar Plantillas</p>
                             {db.entrenador.templates.map(t => (
                                <div key={t.id} className="flex justify-between items-center bg-zinc-900 p-2 rounded-lg border border-red-500/20 mb-2">
                                   <span className="text-[10px] text-zinc-300 truncate">{String(t.name || "")}</span>
                                   <button onClick={() => removeRoutineTemplate(t.id)} className="text-red-500 p-1"><Trash2 size={12}/></button>
                                </div>
                             ))}
                           </div>
                         )}
                       </div>
                     )}
                   </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              {(!client.workoutData.days || client.workoutData.days.length === 0) && !isAdminMode ? (
                <div className="text-center py-10 opacity-40 font-bold text-sm italic">Rutina en construcción...</div>
              ) : null}
              {(client.workoutData.days || []).map(day => (
                <button key={day.id} onClick={() => navigateTo("day", day)} className={`${isAdminMode ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-zinc-100 text-gray-800"} group flex items-center justify-between p-6 rounded-[2rem] border shadow-sm active:scale-95 transition-all text-left`}>
                  <div className="flex items-center gap-4"><div className={`${isAdminMode ? "bg-zinc-800 text-amber-500" : "bg-gray-50 text-gray-500"} p-4 rounded-3xl group-hover:scale-105 transition-transform`}><Dumbbell size={28}/></div><div><p className={`font-bold text-[10px] uppercase ${isAdminMode ? "text-zinc-500" : "text-gray-400"}`}>{String(day.focus || "")}</p><h3 className="text-lg font-black tracking-tight">{String(day.title || "")}</h3></div></div>
                  <ChevronRight className={isAdminMode ? "text-zinc-700" : "text-gray-300"} size={24}/>
                </button>
              ))}
            </div>

            <div className={`${isAdminMode ? "bg-zinc-900 border-zinc-800 text-white" : "bg-amber-50 border-amber-100 text-zinc-900"} p-6 rounded-[2rem] border shadow-sm`}>
               <h3 className="text-[10px] font-black uppercase text-amber-600 mb-2 flex items-center gap-2"><LayoutDashboard size={14}/> Mensaje del Coach</h3>
               <p className="text-sm italic font-medium leading-relaxed">"{String(client.advice || "¡A por todas!")}"</p>
            </div>
          </div>
        )}

        {/* --- DÍA --- */}
        {activeTab === "day" && selectedDay && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 relative pb-24 mt-4">
            {sessionStart && (<div className="fixed top-0 left-0 w-full bg-zinc-900 text-white p-3 z-[70] flex justify-between items-center shadow-lg"><div className="flex items-center gap-2 font-black text-sm tracking-widest text-green-400"><PlayCircle size={16} className="animate-pulse" /> {formatTime(sessionElapsed)}</div><button onClick={finishSession} className="flex items-center gap-1 text-xs font-bold text-red-400 bg-white/10 px-3 py-1.5 rounded-full">FINALIZAR</button></div>)}
            <div className="flex justify-between items-center mt-12">
               <button onClick={() => navigateTo("home")} className="text-zinc-400 font-bold text-sm uppercase flex items-center gap-2"><ArrowLeft size={16}/> Volver</button>
               {!sessionStart && <button onClick={() => setSessionStart(Date.now())} className="bg-amber-500 text-black text-[10px] font-black px-6 py-2 rounded-full uppercase shadow-lg">INICIAR CRONO</button>}
            </div>
            <h2 className={`text-3xl font-black ${isAdminMode ? 'text-white' : 'text-gray-900'}`}>{String(selectedDay.title || "")}</h2>
            {warmupData[selectedDay.warmupType] && (
              <div className="bg-zinc-900 text-white p-6 rounded-[2.5rem] shadow-xl border border-zinc-800">
                <h3 className="font-black text-xs uppercase tracking-widest flex items-center gap-2 mb-4"><Flame className="text-amber-500"/> {String(warmupData[selectedDay.warmupType].title || "Calentamiento")}</h3>
                <div className="space-y-3">
                   {(warmupData[selectedDay.warmupType].steps || []).map((s,i) => <div key={i} className="flex gap-3 text-[10px]"><div className="w-1 h-1 bg-amber-500 rounded-full mt-1.5 shrink-0" /><p><strong>{String(s.name || "")}:</strong> {String(s.detail || "")}</p></div>)}
                </div>
              </div>
            )}
            <div className="space-y-4">
              {(selectedDay.exercises || []).map((ex, i) => (
                <ExerciseCard key={i} ex={ex} workoutLogs={workoutLogs} isAdmin={isAdminMode} onAddLog={handleAddLog} onDeleteLog={handleDeleteLog} onStartTimer={handleStartTimer} accentColor={client.color} onUpdateImage={handleUpdateImage} dayId={selectedDay.id} />
              ))}
            </div>
          </div>
        )}

        {/* --- STATS --- */}
        {activeTab === "stats" && (
          <div className="space-y-6 animate-in fade-in duration-500 mt-4">
            <h2 className={`text-2xl font-black ${isAdminMode ? 'text-white' : 'text-gray-900'}`}>Evolución</h2>
            <div className={`flex gap-2 p-1 rounded-xl ${isAdminMode ? 'bg-zinc-900 border border-zinc-800' : 'bg-gray-100'}`}>
               <button onClick={() => setChartMode('weight')} className={`flex-1 py-2 text-[10px] font-bold rounded-lg ${chartMode==='weight' ? (isAdminMode ? 'bg-amber-500 text-black' : 'bg-white shadow text-gray-900') : 'text-zinc-500'}`}>PESO MÁX</button>
               <button onClick={() => setChartMode('volume')} className={`flex-1 py-2 text-[10px] font-bold rounded-lg ${chartMode==='volume' ? (isAdminMode ? 'bg-amber-500 text-black' : 'bg-white shadow text-gray-900') : 'text-zinc-500'}`}>VOLUMEN TOTAL</button>
            </div>
            {Object.keys(workoutLogs).length === 0 && <div className="text-center py-20 opacity-30 italic">No hay datos registrados aún.</div>}
            {(client.workoutData.days || []).map(d => (d.exercises || []).map((ex,i) => {
               const l = workoutLogs[ex.name] || []; if(l.length < 1) return null;
               const isVol = chartMode === 'volume';
               let displayVal = isVol ? (parseFloat(l[0]?.weight) || 0) * (parseInt(l[0]?.reps) || 10) * parseInt(ex.s || 3) : Math.max(...l.map(x=>parseFloat(x.weight) || 0));
               return (
                 <div key={`${d.id}-${i}`} className={`${isAdminMode ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-zinc-100 text-gray-900"} p-6 rounded-[2rem] shadow-sm border`}>
                    <div className="flex justify-between items-start mb-2"><div><span className="text-[8px] text-zinc-400 uppercase font-black">{String(d.title || "").split(":")[0]}</span><h4 className="text-lg font-black leading-tight">{String(ex.name || "")}</h4></div><div className={`${isAdminMode ? "text-amber-500" : "text-blue-500"} font-black text-sm`}>{displayVal}kg</div></div>
                    <MiniProgressChart data={l} color={client.color} isAdmin={isAdminMode} mode={chartMode} exSets={ex.s} />
                 </div>
               );
            }))}
          </div>
        )}

        {/* --- DIARIO --- */}
        {activeTab === "journal" && (
          <div className="space-y-6 animate-in fade-in duration-500 mt-4">
            <div className="flex items-center gap-3 mb-2"><div className={`${isAdminMode ? "bg-amber-500 text-black" : "bg-gray-100 text-gray-600"} p-3 rounded-2xl`}><MessageSquareHeart size={24} /></div><div><h2 className={`text-2xl font-black ${isAdminMode ? "text-white" : "text-gray-900"}`}>Diario</h2><p className="text-xs text-gray-400 uppercase tracking-widest">Notas de {String(client.name || "")}</p></div></div>
            <div className={`${isAdminMode ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-gray-100 text-gray-900"} p-6 rounded-[2rem] border shadow-sm space-y-3`}>
               <textarea placeholder="¿Cómo te has sentido hoy?..." className={`w-full ${isAdminMode ? "bg-zinc-950 border-zinc-800" : "bg-gray-50 border-gray-100"} border rounded-xl p-4 text-xs font-medium focus:border-amber-500 outline-none h-24`} value={noteText} onChange={e => setNoteText(e.target.value)} />
               <button onClick={addNote} className={`w-full ${isAdminMode ? "bg-amber-500 text-black" : "bg-blue-600 text-white"} font-black py-4 rounded-xl text-[10px] uppercase`}>Guardar Nota</button>
            </div>
            <div className="space-y-4">
              {dailyNotes.map(n => (
                <div key={n.id} className={`${isAdminMode ? "bg-zinc-900 border-zinc-800 text-zinc-300" : "bg-white border-gray-50 text-gray-700"} p-5 rounded-[1.5rem] border shadow-sm flex flex-col gap-3`}>
                   <div className="flex justify-between items-start w-full"><p className="text-sm leading-relaxed pr-4">{String(n.text || "")}</p><button onClick={() => { updateUserInCloud(currentClientId, u => ({...u, notes: u.notes.filter(x => x.id !== n.id)})); }} className="text-red-400"><Trash2 size={14}/></button></div>
                   <div className="flex justify-between items-center"><span className="text-[9px] font-black text-zinc-400">{String(n.date || "")}</span>{n.aiReply ? <div className="bg-amber-500/10 text-amber-500 text-[10px] p-3 rounded-xl italic">Coach AI: {String(n.aiReply)}</div> : <button onClick={() => handleAiCoachReply(n.id, n.text)} className="text-[10px] text-amber-500 font-bold" disabled={loadingAiNoteId === n.id}>{loadingAiNoteId === n.id ? 'Analizando...' : '+ Sugerencia Coach AI'}</button>}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      <nav className={`fixed bottom-8 left-1/2 -translate-x-1/2 ${isAdminMode ? "bg-zinc-900/90 border-zinc-800" : "bg-white/90 border-gray-100"} backdrop-blur-md border px-8 py-5 rounded-[2.5rem] shadow-2xl flex items-center gap-8 z-50`}>
        <button onClick={() => navigateTo("home")} className={`transition-all ${activeTab === "home" ? (isAdminMode ? "text-amber-500 scale-125" : "text-blue-500 scale-125") : "text-zinc-400"}`}><User size={24} /></button>
        <button onClick={() => { if(selectedDay) navigateTo("day", selectedDay); else if(client.workoutData?.days?.length > 0) navigateTo("day", client.workoutData.days[0]); }} className={`transition-all ${activeTab === "day" ? (isAdminMode ? "text-amber-500 scale-125" : "text-blue-500 scale-125") : "text-zinc-400"}`}><Dumbbell size={24} /></button>
        <button onClick={() => navigateTo("stats")} className={`transition-all ${activeTab === "stats" ? (isAdminMode ? "text-amber-500 scale-125" : "text-blue-500 scale-125") : "text-zinc-400"}`}><TrendingUp size={24} /></button>
        <button onClick={() => navigateTo("journal")} className={`transition-all ${activeTab === "journal" ? (isAdminMode ? "text-amber-500 scale-125" : "text-blue-500 scale-125") : "text-zinc-400"}`}><Heart size={24} /></button>
      </nav>

      {/* --- MODALES --- */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm">
           <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-[2rem] p-6 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center"><h3 className="text-amber-500 font-black uppercase text-sm">Cambiar Contraseña</h3><button onClick={()=>setShowPasswordModal(false)}><X size={20} className="text-zinc-500"/></button></div>
              <input type="password" placeholder="Contraseña actual" className="w-full bg-zinc-800 border border-zinc-700 outline-none text-white p-4 rounded-xl text-xs" value={pwdCurrent} onChange={e=>setPwdCurrent(e.target.value)} />
              <input type="password" placeholder="Nueva contraseña" className="w-full bg-zinc-800 border border-zinc-700 outline-none text-white p-4 rounded-xl text-xs" value={pwdNew} onChange={e=>setPwdNew(e.target.value)} />
              <input type="password" placeholder="Repite nueva contraseña" className="w-full bg-zinc-800 border border-zinc-700 outline-none text-white p-4 rounded-xl text-xs" value={pwdConfirm} onChange={e=>setPwdConfirm(e.target.value)} />
              {pwdError && <p className="text-red-500 text-[10px] text-center">{String(pwdError)}</p>}
              {pwdSuccess && <p className="text-green-500 text-[10px] font-bold text-center">{String(pwdSuccess)}</p>}
              <button onClick={handleChangePassword} className="w-full bg-amber-500 text-black font-black py-4 rounded-xl text-[10px] uppercase">ACTUALIZAR</button>
           </div>
        </div>
      )}

      {showAddClientModal && isAdminMode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm">
           <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-[2rem] p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
              <h3 className="text-amber-500 font-black uppercase text-sm text-center">Nuevo Cliente</h3>
              <div className="space-y-1">
                 <label className="text-[10px] text-zinc-500 font-bold uppercase ml-1">Copiar rutina de:</label>
                 <select value={newClient.sourceTemplate} onChange={e=>setNewClient({...newClient, sourceTemplate:e.target.value})} className="w-full bg-zinc-800 border border-zinc-700 outline-none text-white p-3 rounded-xl text-xs">
                    <option value="">En blanco</option>
                    {db.entrenador?.templates?.map(t => <option key={t.id} value={`tmpl_${t.id}`}>Plantilla: {String(t.name || "")}</option>)}
                    {Object.keys(db).map(id => <option key={id} value={`client_${id}`}>Cliente: {String(db[id].name || "")}</option>)}
                 </select>
              </div>
              <input type="text" placeholder="Usuario" className="w-full bg-zinc-800 border border-zinc-700 outline-none text-white p-4 rounded-xl text-xs" value={newClient.username} onChange={e=>setNewClient({...newClient, username:e.target.value})} />
              <input type="text" placeholder="Contraseña" className="w-full bg-zinc-800 border border-zinc-700 outline-none text-white p-4 rounded-xl text-xs" value={newClient.password} onChange={e=>setNewClient({...newClient, password:e.target.value})} />
              <input type="text" placeholder="Nombre completo" className="w-full bg-zinc-900 border border-zinc-700 outline-none text-white p-4 rounded-xl text-xs" value={newClient.name} onChange={e=>setNewClient({...newClient, name:e.target.value})} />
              <button onClick={createClientProfile} className="w-full bg-amber-500 text-black font-black py-4 rounded-xl text-[10px] uppercase">CREAR CUENTA</button>
              <button onClick={()=>setShowAddClientModal(false)} className="w-full text-zinc-500 text-[10px] font-bold">CANCELAR</button>
           </div>
        </div>
      )}

      {toast && (<div className="fixed top-12 left-1/2 -translate-x-1/2 z-[150] w-10/12 max-w-sm animate-in slide-in-from-top-10"><div className="bg-green-600 text-white p-4 rounded-2xl flex items-center gap-3 shadow-2xl border-2 border-white/20"><CheckCircle2 size={24}/> <span className="text-xs font-black uppercase tracking-widest">{String(toast.message || "")}</span></div></div>)}
    </div>
  );
}

function formatTime(t) {
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}` : `${m}:${s.toString().padStart(2, "0")}`;
}
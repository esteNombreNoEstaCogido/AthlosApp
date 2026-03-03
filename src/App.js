import React, { useState, useEffect, useCallback, memo, useRef } from "react";
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
  Camera, CheckSquare, CalendarPlus, Eye
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
  appId: "1:454935635191:web:7d05c0952d56b99c3e9ff2"
};

const app = initializeApp(firebaseConfig);
const db_cloud = getFirestore(app);
const COLLECTION_NAME = "athlos_clients";

// ==========================================
// UTILIDADES BLINDADAS
// ==========================================
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
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Coach AI en descanso. ¡Sigue así! 💪";
  } catch { return "Coach AI en descanso. ¡Sigue así! 💪"; }
};

// ==========================================
// DATOS INICIALES
// ==========================================
const RUTINA_TAMARA_OFICIAL = [
  { id: 101, title: "DÍA 1: Glúteo Máximo", focus: "Fuerza", warmupType: "warmupAthlos", exercises: [
    { name: "Hip Thrust", s: 4, r: "8-10", tip: "Pausa 2\" arriba.", mus: "Glúteo", img: "https://images.unsplash.com/photo-1590239926044-23927693630f?auto=format&fit=crop&q=80&w=400" },
    { name: "Peso Muerto Rumano", s: 3, r: "10", tip: "Bajada lenta.", mus: "Isquios", img: "https://images.unsplash.com/photo-1594737625785-a2bad9931c60?auto=format&fit=crop&q=80&w=400" }
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

const ExerciseCard = memo(({ ex, workoutLogs, onAddLog, onDeleteLog, onStartTimer, isAdmin, onUpdateImage, dayId, accentColor }) => {
  const [localW, setLocalW] = useState("");
  const [localR, setLocalR] = useState("");
  const [showCalc, setShowCalc] = useState(false);
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
        <div className="grid grid-cols-2 gap-3 mb-6 text-center">
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
          <div className="flex gap-2 mt-4">
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
  const [noteText, setNoteText] = useState("");
  const [timerDuration, setTimerDuration] = useState(null);
  const [timerKey, setTimerKey] = useState(0);

  const lastBackPress = useRef(0);
  const [showExitToast, setShowExitToast] = useState(false);

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
      const next = modifierFn(current);
      if (navigator.onLine) {
        setIsSyncing(true);
        setDoc(doc(db_cloud, COLLECTION_NAME, userId), next).then(() => setIsSyncing(false)).catch(() => setIsSyncing(false));
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
    setLoginError("");
    const input = loginUser.toLowerCase().trim();
    if (!input) return;
    try {
      if (input === "coach" && loginPass === "1234") {
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
        setLoggedInUser(input); setCurrentClientId(input); setIsAdminMode(input === 'entrenador' || input === 'coach');
        if (keepLoggedIn) localStorage.setItem("athlos_session_final", JSON.stringify(input));
        else sessionStorage.setItem("athlos_session_final", JSON.stringify(input));
      } else { setLoginError("Usuario o contraseña incorrectos"); }
    } catch (e) { setLoginError("Error de red."); }
  };

  const signOutUser = () => {
    setLoggedInUser(null); setIsAdminMode(false); 
    localStorage.removeItem("athlos_session_final"); 
    sessionStorage.removeItem("athlos_session_final");
    setDataLoaded(false);
  };

  const modifyDayData = (id, field, val) => updateUserInCloud(currentClientId, u => ({ ...u, workoutData: { ...u.workoutData, days: (Array.isArray(u.workoutData?.days) ? u.workoutData.days : []).map(d => d.id === id ? {...d, [field]: val} : d) } }));
  const modifyExerciseData = (dayId, idx, field, val) => updateUserInCloud(currentClientId, u => { const days = [...(Array.isArray(u.workoutData?.days) ? u.workoutData.days : [])]; const dIdx = days.findIndex(d => d.id === dayId); if(dIdx > -1) days[dIdx].exercises[idx] = { ...days[dIdx].exercises[idx], [field]: val }; return { ...u, workoutData: { ...u.workoutData, days } }; });
  
  const removeExerciseFromDay = (dayId, exIdx) => {
    updateUserInCloud(currentClientId, u => { const days = [...(Array.isArray(u.workoutData?.days) ? u.workoutData.days : [])]; const dIdx = days.findIndex(d => d.id === dayId); if (dIdx > -1) days[dIdx].exercises.splice(exIdx, 1); return { ...u, workoutData: { ...u.workoutData, days } }; });
    setToast({ type: "SUCCESS", message: "Ejercicio borrado" }); setTimeout(() => setToast(null), 2500);
  };

  const applyTemplateRoutine = (source) => {
    if (!source) return;
    let days = source.startsWith("tmpl_") ? (db.entrenador?.templates || []).find(t => t.id === source.replace("tmpl_", ""))?.days : db[source.replace("client_", "")]?.workoutData?.days;
    if(days) {
      updateUserInCloud(currentClientId, (u) => ({ ...u, workoutData: { ...u.workoutData, days: JSON.parse(JSON.stringify(days)) } }));
      setToast({ type: "SUCCESS", message: "Rutina aplicada" }); setTimeout(() => setToast(null), 2500); setShowEditor(false);
    }
  };

  const saveRoutineTemplate = () => {
    if (!templateNameInput.trim()) return;
    const newTmpl = { id: Date.now().toString(), name: templateNameInput, days: JSON.parse(JSON.stringify(db[currentClientId].workoutData.days)) };
    updateUserInCloud('entrenador', coach => ({ ...coach, templates: [...(coach.templates || []), newTmpl] }));
    setToast({ type: "SUCCESS", message: "Plantilla guardada" }); setTimeout(() => { setToast(null); setIsSavingTemplate(false); setTemplateNameInput(""); }, 2500);
  };

  const removeRoutineTemplate = (tmplId) => {
    updateUserInCloud('entrenador', (coachData) => ({ ...coachData, templates: (coachData.templates || []).filter(t => t.id !== tmplId) }));
    setToast({ type: "SUCCESS", message: "Plantilla borrada" }); setTimeout(() => setToast(null), 2500);
  };

  const createNewDay = () => {
    if (!newDay.title) return;
    updateUserInCloud(currentClientId, u => ({ ...u, workoutData: { ...u.workoutData, days: [...(Array.isArray(u.workoutData?.days) ? u.workoutData.days : []), { id: Date.now(), ...newDay, exercises: [] }] } }));
    setNewDay({ title: "", focus: "", warmupType: "warmupLower" });
    setToast({ type: "SUCCESS", message: "Día creado" }); setTimeout(() => setToast(null), 2500);
  };

  const removeDayFromRoutine = (dayId) => {
    updateUserInCloud(currentClientId, u => ({ ...u, workoutData: { ...u.workoutData, days: (u.workoutData.days || []).filter(d => d.id !== dayId) } }));
    setToast({ type: "SUCCESS", message: "Día borrado" }); setTimeout(() => setToast(null), 2500);
  };

  const appendNewExercise = () => {
    if (!newEx.name || !targetDayId) {
      setToast({ type: "SUCCESS", message: "Rellena el nombre" }); setTimeout(() => setToast(null), 2500);
      return;
    }
    updateUserInCloud(currentClientId, u => {
       const days = (Array.isArray(u.workoutData?.days) ? u.workoutData.days : []).map(d => d.id.toString() === targetDayId.toString() ? { ...d, exercises: [...(Array.isArray(d.exercises) ? d.exercises : []), newEx] } : d);
       return { ...u, workoutData: { ...u.workoutData, days } };
    });
    setNewEx({ name: "", s: 3, r: "12", tip: "", mus: "", yt: "", img: "" });
    setToast({ type: "SUCCESS", message: "Ejercicio añadido" }); setTimeout(() => setToast(null), 2500);
  };

  const removeClientAccount = async () => {
    if (currentClientId === 'entrenador' || currentClientId === 'coach') return;
    setIsSyncing(true);
    await deleteDoc(doc(db_cloud, COLLECTION_NAME, currentClientId)).catch(()=>{});
    setDb(prev => { const n = {...prev}; delete n[currentClientId]; return n; });
    setCurrentClientId('entrenador'); setIsSyncing(false);
    setToast({ type: "SUCCESS", message: "Cliente eliminado" }); setTimeout(() => setToast(null), 2500);
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

  const handleChangePassword = () => {
    if (db[currentClientId].password !== pwdCurrent) { setPwdError("Actual incorrecta"); return; }
    if (pwdNew.length < 4) { setPwdError("Mínimo 4 caracteres"); return; }
    updateUserInCloud(currentClientId, u => ({ ...u, password: pwdNew }));
    setPwdSuccess("¡Éxito!"); setTimeout(() => setShowPasswordModal(false), 2000);
  };

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
    if (!newClient.name || !newClient.username || !newClient.password) {
      setToast({ type: "SUCCESS", message: "Faltan datos" }); setTimeout(() => setToast(null), 3000); return;
    }
    const id = newClient.username.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_");
    let sourceDays = [];
    if (newClient.sourceTemplate.startsWith("tmpl_")) {
      sourceDays = (db.entrenador?.templates || []).find(t => t.id === newClient.sourceTemplate.replace("tmpl_", ""))?.days || [];
    } else if (newClient.sourceTemplate.startsWith("client_")) {
      sourceDays = db[newClient.sourceTemplate.replace("client_", "")]?.workoutData?.days || [];
    }
    updateUserInCloud(id, () => ({
      username: newClient.username.toLowerCase(), password: newClient.password, name: newClient.name, color: "from-blue-600 to-indigo-500", subtitle: "Nuevo Plan", advice: "A darlo todo.", logs: {}, notes: [], workoutData: { days: JSON.parse(JSON.stringify(sourceDays)) }
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
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className={`bg-gradient-to-br ${isAdminMode ? "from-zinc-800 to-zinc-900 border border-zinc-700" : String(client.color || "from-blue-600 to-indigo-500")} p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden`}>
              <div className="flex flex-col gap-1 relative z-10">
                 {isAdminMode ? (
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
              <Zap className="absolute -bottom-4 -right-4 w-32 h-32 opacity-10 rotate-12" />
            </div>

            {isAdminMode && (
              <div className="bg-zinc-900 p-6 rounded-[2rem] border border-zinc-800 shadow-2xl space-y-6">
                <div className="flex justify-between items-center text-[10px] font-black uppercase text-zinc-500">
                  <div className="flex items-center gap-2"><Users size={14} className="text-amber-500" /> Clientes</div>
                  <button onClick={() => setShowAddClientModal(true)} className="bg-zinc-800 text-amber-500 px-3 py-1.5 rounded-lg active:scale-95"><Plus size={12}/> Nuevo</button>
                </div>
                <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
                  {Object.keys(db).map(id => (
                    <button key={id} onClick={() => { setCurrentClientId(id); setShowEditor(false); }} className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase shrink-0 ${currentClientId === id ? 'bg-amber-500 text-black shadow-lg scale-105' : 'bg-zinc-800 text-zinc-500'}`}>{String(db[id].name || id)}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                   <button onClick={() => setShowEditor(!showEditor)} className={`${showEditor ? "bg-amber-500 text-black" : "bg-zinc-800 text-white"} w-full py-4 rounded-xl text-[10px] font-black uppercase border border-zinc-700 flex items-center justify-center gap-2`}><Edit3 size={14}/> {showEditor ? 'Cerrar Edición' : 'Editar Rutina'}</button>
                   <button onClick={removeClientAccount} className="bg-red-500/10 text-red-500 py-4 rounded-xl text-[10px] font-black uppercase border border-red-500/20 flex justify-center items-center gap-2"><Trash2 size={14}/> Eliminar</button>
                </div>

                {showEditor && (
                   <div className="space-y-4 animate-in slide-in-from-top-4 border-t border-zinc-800 pt-4">
                     <div className="flex gap-2 bg-zinc-800 p-1 rounded-xl">
                       <button onClick={() => setEditorTab("day")} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase ${editorTab === "day" ? "bg-zinc-700 text-amber-500" : "text-zinc-500"}`}>Días</button>
                       <button onClick={() => setEditorTab("exercise")} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase ${editorTab === "exercise" ? "bg-zinc-700 text-amber-500" : "text-zinc-500"}`}>Ejercicios</button>
                       <button onClick={() => setEditorTab("template")} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase ${editorTab === "template" ? "bg-zinc-700 text-amber-500" : "text-zinc-500"}`}>Copiar</button>
                     </div>
                     {editorTab === "day" && (
                       <div className="space-y-4">
                         {validDays.map(d => (
                            <div key={d.id} className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700 space-y-2">
                               <div className="flex justify-between items-center"><span className="text-[9px] text-zinc-500 font-bold uppercase">Día</span><button onClick={() => removeDayFromRoutine(d.id)} className="text-red-500"><Trash2 size={14}/></button></div>
                               <input defaultValue={String(d.title || "")} onBlur={e => actDay(d.id, 'title', e.target.value)} className="w-full bg-zinc-900 rounded-lg p-2 text-xs font-bold text-white outline-none" />
                            </div>
                         ))}
                         <input type="text" placeholder="Nombre Nuevo Día..." className="w-full bg-zinc-800 p-3 rounded-xl text-xs text-white outline-none" value={newDay.title} onChange={e => setNewDay({...newDay, title: e.target.value})} />
                         <button onClick={createNewDay} className="w-full bg-amber-500 text-black font-black py-3 rounded-xl text-[10px]">CREAR DÍA</button>
                       </div>
                     )}
                     {editorTab === "exercise" && (
                       <div className="space-y-4">
                         <select value={targetDayId} onChange={e => setTargetDayId(e.target.value)} className="w-full bg-zinc-900 p-3 rounded-xl text-xs font-bold text-amber-500 outline-none">
                           <option value="">Selecciona el día...</option>
                           {validDays.map(d => <option key={d.id} value={d.id}>{String(d.title || "Día")}</option>)}
                         </select>
                         {targetDayId && validDays.find(d => d.id.toString() === targetDayId)?.exercises?.map((ex, idx) => (
                           <div key={idx} className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700 space-y-2">
                              <div className="flex justify-between items-center"><span className="text-[9px] text-zinc-500 font-bold">Ejercicio {idx + 1}</span><button onClick={() => removeExerciseFromDay(parseInt(targetDayId), idx)} className="text-red-500"><Trash2 size={12}/></button></div>
                              <input defaultValue={String(ex.name || "")} onBlur={e => modifyExerciseData(parseInt(targetDayId), idx, 'name', e.target.value)} className="w-full bg-zinc-900 rounded-lg p-2 text-xs font-bold text-white outline-none" />
                              <div className="grid grid-cols-2 gap-2"><input defaultValue={String(ex.s || "")} onBlur={e => modifyExerciseData(parseInt(targetDayId), idx, 's', e.target.value)} className="w-full bg-zinc-900 rounded-lg p-2 text-xs text-white outline-none" /><input defaultValue={String(ex.r || "")} onBlur={e => modifyExerciseData(parseInt(targetDayId), idx, 'r', e.target.value)} className="w-full bg-zinc-900 rounded-lg p-2 text-xs text-white outline-none" /></div>
                              <textarea defaultValue={String(ex.tip || "")} onBlur={e => modifyExerciseData(parseInt(targetDayId), idx, 'tip', e.target.value)} className="w-full bg-zinc-900 rounded-lg p-2 text-[10px] italic text-white outline-none" />
                           </div>
                         ))}
                         {targetDayId && (
                           <>
                             <input type="text" placeholder="Nombre del Ejercicio" className="w-full bg-zinc-800 p-3 rounded-xl text-xs text-white outline-none" value={newEx.name} onChange={e => setNewEx({...newEx, name: e.target.value})} />
                             <button onClick={appendNewExercise} className="w-full bg-amber-500 text-black font-black py-3 rounded-xl text-[10px]">AÑADIR EJERCICIO</button>
                           </>
                         )}
                       </div>
                     )}
                     {editorTab === "template" && (
                       <div className="space-y-4">
                         <select value={sourceClientToCopy} onChange={e => setSourceClientToCopy(e.target.value)} className="w-full bg-zinc-900 p-3 rounded-xl text-xs text-white outline-none mb-3">
                            <option value="">Copia rutina desde...</option>
                            {(Array.isArray(db.entrenador?.templates) ? db.entrenador.templates : []).map(t => <option key={t.id} value={`tmpl_${t.id}`}>Plantilla: {String(t.name || "")}</option>)}
                            {Object.keys(db).map(id => <option key={id} value={`client_${id}`}>Cliente: {String(db[id].name || id)}</option>)}
                         </select>
                         <button onClick={() => applyTemplateRoutine(sourceClientToCopy)} disabled={!sourceClientToCopy} className="w-full bg-blue-600 text-white font-black py-3 rounded-xl text-[10px]">SOBRESCRIBIR RUTINA</button>
                         <div className="bg-zinc-800 p-4 rounded-xl mt-4">
                             <input type="text" placeholder="Nombre para guardar plantilla..." className="w-full bg-zinc-900 p-3 rounded-xl text-xs text-white outline-none mb-2" value={templateNameInput} onChange={e => setTemplateNameInput(e.target.value)} />
                             <button onClick={saveRoutineTemplate} className="w-full bg-amber-500 text-black font-black py-2 rounded-lg text-[10px]">GUARDAR COMO PLANTILLA</button>
                         </div>
                       </div>
                     )}
                   </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
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
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 relative pb-24 mt-4">
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
                <ExerciseCard key={i} ex={ex} workoutLogs={workoutLogs} isAdmin={isAdminMode} onAddLog={addLogRecord} onDeleteLog={deleteLogRecord} onStartTimer={startTimerHook} accentColor={client.color} onUpdateImage={updateImageHook} dayId={selectedDay.id} />
              ))}
            </div>
          </div>
        )}

        {/* --- STATS --- */}
        {activeTab === "stats" && (
          <div className="space-y-6 animate-in fade-in duration-500 mt-4">
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
                 </div>
               );
            }))}
          </div>
        )}

        {/* --- DIARIO --- */}
        {activeTab === "journal" && (
          <div className="space-y-6 animate-in fade-in duration-500 mt-4">
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

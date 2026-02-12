import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot, addDoc, query, deleteDoc, updateDoc } from 'firebase/firestore';
import { 
  Trophy, Users, PlusCircle, History, ClipboardList, UserPlus, Trash2, Star,
  Calendar, Zap, Award, TrendingUp, AlertCircle, CheckCircle2, RefreshCcw,
  XCircle, ChevronUp, ChevronDown, Camera, User as UserIcon, Lock, Unlock,
  Edit2, Save, X, ChevronRight, Target, ShieldAlert
} from 'lucide-react';

// --- Reemplaza esto con tus credenciales de Firebase ---
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_ID",
  appId: "TU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'roca-2026-app'; 

const ADMIN_PASSWORD = "Taladro123";

const App = () => {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('stats'); 
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Admin State
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [passError, setPassError] = useState(false);

  // Profile & Forms State
  const [selectedPlayerProfile, setSelectedPlayerProfile] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'points', direction: 'desc' });
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerPhoto, setNewPlayerPhoto] = useState(null);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef(null);

  // Match Form States
  const [registrationMode, setRegistrationMode] = useState('whatsapp'); 
  const [whatsappText, setWhatsappText] = useState('');
  const [parsedTeams, setParsedTeams] = useState({ dark: [], light: [] });
  const [selectedDark, setSelectedDark] = useState([]);
  const [selectedLight, setSelectedLight] = useState([]);
  const [scoreDark, setScoreDark] = useState(0);
  const [scoreLight, setScoreLight] = useState(0);
  const [matchDate, setMatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingMatch, setEditingMatch] = useState(null);

  // --- Auth ---
  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error("Auth Error:", err));
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- Real-time Data ---
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    
    const unsubPlayers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'players'), (snapshot) => {
      const pList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPlayers(pList.sort((a, b) => a.name.localeCompare(b.name)));
    });

    const unsubMatches = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'matches'), (snapshot) => {
      const mList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMatches(mList.sort((a, b) => new Date(b.date) - new Date(a.date)));
      setLoading(false);
    });

    return () => { unsubPlayers(); unsubMatches(); };
  }, [user]);

  // --- Lógica de Negocio (Igual a tu código original) ---
  const handleAdminAuth = (e) => {
    e.preventDefault();
    if (passInput === ADMIN_PASSWORD) {
      setIsAdmin(true); setShowPassModal(false); setPassInput(''); setPassError(false);
    } else { setPassError(true); }
  };

  const checkAdminAction = (callback) => isAdmin ? callback() : setShowPassModal(true);

  const handlePhotoUpload = (e, callback) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 150;
        let width = img.width; let height = img.height;
        if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } }
        else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        callback(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // --- WhatsApp Parsing ---
  useEffect(() => {
    if (registrationMode !== 'whatsapp' || !whatsappText) return;
    const lines = whatsappText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let currentTeam = null; const dark = []; const light = [];
    lines.forEach(line => {
      const upperLine = line.toUpperCase();
      if (upperLine.includes('OSCURO') || upperLine.includes('DARK')) { currentTeam = 'dark'; return; }
      if (upperLine.includes('CLARO') || upperLine.includes('LIGHT') || upperLine.includes('BLANCO')) { currentTeam = 'light'; return; }
      if (currentTeam) {
        const cleanName = line.replace(/^\d+[\.\)\s-]+/, '').trim();
        if (cleanName) {
          const matchedPlayer = players.find(p => p.name.toLowerCase() === cleanName.toLowerCase());
          const entry = { originalText: cleanName, playerId: matchedPlayer ? matchedPlayer.id : null, playerName: matchedPlayer ? matchedPlayer.name : cleanName, status: matchedPlayer ? 'found' : 'missing' };
          if (currentTeam === 'dark') dark.push(entry); else light.push(entry);
        }
      }
    });
    setParsedTeams({ dark, light });
  }, [whatsappText, players, registrationMode]);

  const updateParsedPlayer = (team, idx, playerId) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    const newTeams = { ...parsedTeams };
    newTeams[team][idx] = { ...newTeams[team][idx], playerId: player.id, playerName: player.name, status: 'found' };
    setParsedTeams(newTeams);
  };

  // --- Stats Engine ---
  const { playerStats, historicalHighlights, monthlyWinners } = useMemo(() => {
    const stats = {}; const monthlyData = {};
    players.forEach(p => { stats[p.name] = { name: p.name, photo: p.photo || null, played: 0, won: 0, drawn: 0, lost: 0, points: 0, pct: 0, goalsFor: 0, goalsAgainst: 0 }; });
    matches.forEach(m => {
      const mDate = new Date(m.date);
      const monthKey = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[monthKey]) monthlyData[monthKey] = { wins: {} };
      const isDarkWin = parseInt(m.scoreDark) > parseInt(m.scoreLight);
      const isLightWin = parseInt(m.scoreLight) > parseInt(m.scoreDark);
      const isDraw = parseInt(m.scoreDark) === parseInt(m.scoreLight);
      const processTeam = (team, oppS, teamS, win, draw, lost) => {
        team.forEach(pName => {
          if (!stats[pName]) return;
          stats[pName].played += 1; stats[pName].goalsFor += parseInt(teamS); stats[pName].goalsAgainst += parseInt(oppS);
          if (win) { stats[pName].won += 1; stats[pName].points += 3; monthlyData[monthKey].wins[pName] = (monthlyData[monthKey].wins[pName] || 0) + 1; }
          else if (draw) { stats[pName].drawn += 1; stats[pName].points += 2; }
          else { stats[pName].lost += 1; stats[pName].points += 1; }
        });
      };
      processTeam(m.darkTeam, m.scoreLight, m.scoreDark, isDarkWin, isDraw, isLightWin);
      processTeam(m.lightTeam, m.scoreDark, m.scoreLight, isLightWin, isDraw, isDarkWin);
    });
    Object.keys(stats).forEach(k => { stats[k].pct = stats[k].played > 0 ? (stats[k].won / stats[k].played) * 100 : 0; });
    const statsArray = Object.values(stats);
    const minMatches = matches.length * 0.4; // Ajustado a 40% para competitividad
    const highlights = {
      mostWon: [...statsArray].sort((a, b) => b.won - a.won)[0],
      mostPlayed: [...statsArray].sort((a, b) => b.played - a.played)[0],
      bestPct: [...statsArray].filter(p => p.played >= minMatches).sort((a, b) => b.pct - a.pct)[0],
    };
    const winnersByMonth = Object.entries(monthlyData).map(([key, data]) => {
      const playersInMonth = Object.entries(data.wins);
      if (playersInMonth.length === 0) return { month: key, winners: [] };
      const maxWins = Math.max(...playersInMonth.map(p => p[1]));
      const winners = playersInMonth.filter(p => p[1] === maxWins).map(p => ({ name: p[0], wins: p[1], photo: stats[p[0]]?.photo }));
      return { month: key, winners };
    }).sort((a, b) => b.month.localeCompare(a.month));
    return { playerStats: statsArray, historicalHighlights: highlights, monthlyWinners: winnersByMonth };
  }, [players, matches]);

  const sortedStats = useMemo(() => {
    return [...playerStats].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [playerStats, sortConfig]);

  const requestSort = (key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc' }));
  };

  const getPlayerMatchHistory = (playerName) => matches.filter(m => m.darkTeam.includes(playerName) || m.lightTeam.includes(playerName));

  // --- CRUD Actions ---
  const addPlayer = async (e) => {
    e.preventDefault();
    checkAdminAction(async () => {
      const name = newPlayerName.trim();
      if (!name || players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        setErrorMessage("Nombre inválido o ya existe"); setTimeout(() => setErrorMessage(''), 3000); return;
      }
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'players'), { name, photo: newPlayerPhoto, createdAt: new Date().toISOString() });
      setNewPlayerName(''); setNewPlayerPhoto(null);
    });
  };

  const updatePlayer = async () => {
    if (!editingPlayer) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', editingPlayer.id), { name: editingPlayer.name, photo: editingPlayer.photo });
    setEditingPlayer(null);
  };

  const saveMatch = async (e) => {
    e.preventDefault();
    checkAdminAction(async () => {
      let finalDark, finalLight;
      if (registrationMode === 'whatsapp') {
        finalDark = parsedTeams.dark.filter(p => p.playerId).map(p => p.playerName);
        finalLight = parsedTeams.light.filter(p => p.playerId).map(p => p.playerName);
      } else { finalDark = selectedDark; finalLight = selectedLight; }
      if (finalDark.length === 0 || finalLight.length === 0) return;
      const mData = { date: matchDate, darkTeam: finalDark, lightTeam: finalLight, scoreDark: parseInt(scoreDark), scoreLight: parseInt(scoreLight), timestamp: new Date().toISOString() };
      if (editingMatch) { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'matches', editingMatch.id), mData); setEditingMatch(null); }
      else { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'matches'), mData); }
      setSelectedDark([]); setSelectedLight([]); setWhatsappText(''); setScoreDark(0); setScoreLight(0); setActiveTab('stats');
    });
  };

  const startEditMatch = (m) => {
    checkAdminAction(() => {
      setEditingMatch(m); setRegistrationMode('manual'); setSelectedDark(m.darkTeam); setSelectedLight(m.lightTeam);
      setScoreDark(m.scoreDark); setScoreLight(m.scoreLight); setMatchDate(m.date); setActiveTab('register');
    });
  };

  // --- UI Components ---
  const Avatar = ({ src, name, size = "md" }) => {
    const sizes = { xs: "w-6 h-6 text-[8px]", sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-16 h-16 text-xl", xl: "w-24 h-24 text-3xl", profile: "w-32 h-32 text-4xl" };
    if (src) return <img src={src} alt={name} className={`${sizes[size]} rounded-full object-cover shadow-sm border-2 border-white flex-shrink-0`} />;
    return <div className={`${sizes[size]} rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black border-2 border-white uppercase flex-shrink-0`}>{name?.charAt(0) || <UserIcon size={16}/>}</div>;
  };

  const Modal = ({ isOpen, onClose, title, children, maxWidth = "max-w-md" }) => {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div className={`bg-white rounded-3xl w-full ${maxWidth} overflow-hidden shadow-2xl animate-in zoom-in duration-200 flex flex-col max-h-[90vh]`}>
          <div className="p-6 border-b flex justify-between items-center bg-slate-50 flex-shrink-0">
            <h3 className="font-black uppercase italic text-slate-800">{title}</h3>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition"><X size={20}/></button>
          </div>
          <div className="p-6 overflow-y-auto">{children}</div>
        </div>
      </div>
    );
  };

  if (loading && !user) return <div className="flex items-center justify-center h-screen bg-slate-50"><RefreshCcw className="animate-spin text-indigo-600" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-12">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40 border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-200"><Trophy className="text-white w-6 h-6" /></div>
            <h1 className="text-2xl font-black tracking-tighter text-slate-800 italic uppercase">ROCA 2026</h1>
          </div>
          <button onClick={() => isAdmin ? setIsAdmin(false) : setShowPassModal(true)} className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${isAdmin ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-400'}`}>
            {isAdmin ? <Unlock size={18} /> : <Lock size={18} />}
            <span className="text-[10px] font-black uppercase hidden sm:block">Admin</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:pt-10">
        {/* Navigation */}
        <div className="flex gap-2 mb-10 bg-white p-2 rounded-[2rem] shadow-sm border border-slate-200 w-fit mx-auto md:mx-0 overflow-x-auto no-scrollbar">
          {[
            { id: 'stats', label: 'Estadísticas', icon: Star },
            { id: 'history', label: 'Historial', icon: History },
            { id: 'register', label: editingMatch ? 'Editando' : 'Cargar', icon: PlusCircle },
            { id: 'players', label: 'Jugadores', icon: Users },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-6 py-3 rounded-2xl flex items-center gap-2 font-black text-sm whitespace-nowrap transition-all duration-300 ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 -translate-y-0.5' : 'text-slate-400 hover:bg-slate-50'}`}>
              <tab.icon size={18} strokeWidth={3} /> {tab.label}
            </button>
          ))}
        </div>

        {/* --- Tab: Estadísticas --- */}
        {activeTab === 'stats' && (
          <div className="space-y-12 animate-in fade-in duration-700">
            <section>
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2"><Award size={14} className="text-indigo-500" /> Olimpo ROCA 2026</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: 'Pichichi Histórico', player: historicalHighlights.mostWon, bg: 'bg-slate-900', accent: 'text-indigo-400', val: 'won', unit: 'VICTORIAS' },
                  { label: 'Asistencia Perfecta', player: historicalHighlights.mostPlayed, bg: 'bg-white border-2 border-slate-100', accent: 'text-indigo-600', val: 'played', unit: 'PARTIDOS' },
                  { label: 'Efectividad (Compitiendo)', player: historicalHighlights.bestPct, bg: 'bg-indigo-600', accent: 'text-white', val: 'pct', unit: '%', isPct: true }
                ].map((h, i) => (
                  <div key={i} onClick={() => h.player && setSelectedPlayerProfile(h.player)} className={`${h.bg} p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group cursor-pointer transition-transform hover:scale-[1.02]`}>
                    <div className="relative z-10 flex flex-col items-center text-center">
                      <p className={`font-black text-[10px] uppercase tracking-widest mb-4 ${h.bg.includes('white') ? 'text-slate-400' : 'text-white/60'}`}>{h.label}</p>
                      <Avatar src={h.player?.photo} name={h.player?.name} size="xl" />
                      <h3 className={`text-2xl font-black mt-4 mb-1 ${h.bg.includes('white') ? 'text-slate-800' : 'text-white'}`}>{h.player?.name || '-'}</h3>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-4xl font-black ${h.accent}`}>{h.isPct ? (h.player?.[h.val]?.toFixed(0) || 0) : (h.player?.[h.val] || 0)}</span>
                        <span className={`text-[10px] font-bold ${h.bg.includes('white') ? 'text-slate-400' : 'text-white/40'}`}>{h.unit}</span>
                      </div>
                    </div>
                    <Star className={`absolute -right-6 -bottom-6 w-32 h-32 ${h.bg.includes('white') ? 'text-slate-50' : 'text-white/5'}`} />
                  </div>
                ))}
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
              <aside className="lg:col-span-1 space-y-6">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Calendar size={14} className="text-indigo-500" /> Mejores del Mes</h3>
                <div className="space-y-4">
                  {monthlyWinners.map((month) => (
                    <div key={month.month} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm transition">
                      <p className="text-[10px] font-black text-indigo-500 uppercase mb-4">{new Date(month.month + "-02").toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</p>
                      <div className="space-y-3">
                        {month.winners.map((w, idx) => (
                          <div key={idx} onClick={() => setSelectedPlayerProfile(playerStats.find(ps => ps.name === w.name))} className="flex justify-between items-center cursor-pointer group">
                            <div className="flex items-center gap-3">
                              <Avatar src={w.photo} name={w.name} size="sm" />
                              <span className="font-bold text-slate-700 text-sm group-hover:text-indigo-600 transition">{w.name}</span>
                            </div>
                            <div className="bg-slate-50 px-2 py-1 rounded-lg text-[10px] font-black text-slate-500">{w.wins}W</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </aside>

              <div className="lg:col-span-3">
                <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-8 border-b border-slate-50">
                    <h2 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter">Tabla General</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">G:3 • E:2 • P:1</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black">
                        <tr>
                          <th className="px-6 py-5">Jugador</th>
                          {[{ key: 'played', label: 'PJ' }, { key: 'won', label: 'G' }, { key: 'drawn', label: 'E' }, { key: 'lost', label: 'P' }, { key: 'pct', label: '%' }, { key: 'points', label: 'Pts' }].map(col => (
                            <th key={col.key} onClick={() => requestSort(col.key)} className="px-4 py-5 text-center cursor-pointer hover:text-indigo-600 transition select-none">
                              <div className="flex items-center justify-center gap-1">
                                {col.label} {sortConfig.key === col.key && (sortConfig.direction === 'asc' ? <ChevronUp size={12}/> : <ChevronDown size={12}/>)}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {sortedStats.map((row, idx) => (
                          <tr key={row.name} onClick={() => setSelectedPlayerProfile(row)} className="hover:bg-slate-50/50 transition cursor-pointer">
                            <td className="px-6 py-4 flex items-center gap-4">
                              <span className={`w-4 text-xs font-black ${idx < 3 ? 'text-indigo-600' : 'text-slate-300'}`}>{idx + 1}</span>
                              <Avatar src={row.photo} name={row.name} size="md" />
                              <span className="font-bold text-slate-700">{row.name}</span>
                            </td>
                            <td className="px-4 py-4 text-center text-slate-500 font-bold">{row.played}</td>
                            <td className="px-4 py-4 text-center text-green-600 font-black">{row.won}</td>
                            <td className="px-4 py-4 text-center text-slate-400 font-medium">{row.drawn}</td>
                            <td className="px-4 py-4 text-center text-red-300 font-medium">{row.lost}</td>
                            <td className="px-4 py-4 text-center font-mono text-xs text-slate-400 font-bold">{row.pct.toFixed(0)}%</td>
                            <td className="px-6 py-4 text-center">
                              <span className="bg-indigo-600 text-white px-4 py-1.5 rounded-xl font-black shadow-md">{row.points}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- Otros Tabs (Manual/Historial/Cargar) resumidos para el espacio --- */}
        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            {matches.map(m => (
              <div key={m.id} className="bg-white p-8 rounded-[3.5rem] shadow-sm border border-slate-100 group hover:shadow-xl hover:-translate-y-1 transition-all">
                <div className="flex flex-col md:flex-row gap-8 items-center">
                  <div className="flex items-center gap-10">
                    <div className="text-center min-w-[60px]">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{new Date(m.date).toLocaleDateString('es-AR', {day: 'numeric', month: 'short'})}</p>
                      <p className="text-2xl font-black text-slate-800 tracking-tighter">{new Date(m.date).getFullYear()}</p>
                    </div>
                    <div className="flex items-center gap-6 bg-slate-50 px-8 py-5 rounded-[2.5rem] border-2 border-slate-100 font-black text-3xl shadow-inner">
                      <span className="text-slate-900">{m.scoreDark}</span>
                      <span className="text-slate-300 italic text-xl">VS</span>
                      <span className="text-indigo-600">{m.scoreLight}</span>
                    </div>
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-6 w-full md:border-l md:pl-8 border-slate-100">
                    <div className="space-y-2">
                      <p className="text-[9px] font-black text-slate-400 uppercase italic">Oscuro</p>
                      <div className="flex flex-wrap gap-1">
                        {m.darkTeam.map(name => <Avatar key={name} src={players.find(p => p.name === name)?.photo} name={name} size="xs" />)}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[9px] font-black text-slate-400 uppercase italic text-right">Claro</p>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {m.lightTeam.map(name => <Avatar key={name} src={players.find(p => p.name === name)?.photo} name={name} size="xs" />)}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEditMatch(m)} className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition"><Edit2 size={20}/></button>
                    <button onClick={() => checkAdminAction(() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'matches', m.id)))} className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition"><Trash2 size={20}/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- Tab: Registro (WhatsApp & Manual) --- */}
        {activeTab === 'register' && (
          <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-[3rem] shadow-2xl p-10 border border-slate-100">
              <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
                <h2 className="text-3xl font-black flex items-center gap-4 italic uppercase"><ClipboardList className="text-indigo-600" size={32} /> {editingMatch ? 'EDITAR' : 'CARGAR'} PARTIDO</h2>
                <div className="flex bg-slate-100 p-1.5 rounded-[1.5rem]">
                  {!editingMatch && <button onClick={() => setRegistrationMode('whatsapp')} className={`px-6 py-2.5 rounded-[1.2rem] text-xs font-black transition-all ${registrationMode === 'whatsapp' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400'}`}>WhatsApp</button>}
                  <button onClick={() => setRegistrationMode('manual')} className={`px-6 py-2.5 rounded-[1.2rem] text-xs font-black transition-all ${registrationMode === 'manual' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400'}`}>Manual</button>
                </div>
              </div>
              
              <form onSubmit={saveMatch} className="space-y-12">
                {registrationMode === 'whatsapp' ? (
                  <div className="space-y-8">
                    <textarea className="w-full p-6 bg-slate-50 border-2 border-transparent focus:border-indigo-300 rounded-3xl outline-none transition text-sm font-bold min-h-[150px]" placeholder="OSCURO:\n1. Juan\n2. Pedro\nCLARO:\n1. Luis..." value={whatsappText} onChange={(e) => setWhatsappText(e.target.value)} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      {['dark', 'light'].map(team => (
                        <div key={team} className="space-y-4">
                          <h4 className="text-[10px] font-black uppercase text-slate-400 italic">Equipo {team === 'dark' ? 'Oscuro' : 'Claro'}</h4>
                          <div className="space-y-3">
                            {parsedTeams[team].map((p, idx) => (
                              <div key={idx} className={`flex items-center justify-between p-4 rounded-2xl border-2 ${p.status === 'found' ? 'bg-white border-slate-50' : 'bg-red-50 border-red-100'}`}>
                                <div className="flex items-center gap-3">
                                  <Avatar src={players.find(pl => pl.name === p.playerName)?.photo} name={p.playerName} size="sm" />
                                  <span className={`text-sm font-black ${p.status === 'found' ? 'text-slate-700' : 'text-red-700'}`}>{p.playerName}</span>
                                </div>
                                {p.status === 'missing' && (
                                  <select className="text-[10px] p-2 bg-white border rounded-xl font-black w-32" onChange={(e) => updateParsedPlayer(team, idx, e.target.value)} defaultValue="">
                                    <option value="" disabled>¿Quién es?</option>
                                    {players.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}
                                  </select>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    {['dark', 'light'].map(team => (
                      <div key={team} className="space-y-6">
                        <label className="flex items-center gap-3 font-black text-slate-900 uppercase italic">
                          <div className={`w-5 h-5 rounded-full ${team === 'dark' ? 'bg-slate-900' : 'bg-white border-2 border-slate-300'}`}></div> Equipo {team === 'dark' ? 'Oscuro' : 'Claro'}
                        </label>
                        <div className="flex flex-wrap gap-2 p-6 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 min-h-[200px]">
                          {players.map(p => {
                            const isSel = team === 'dark' ? selectedDark.includes(p.name) : selectedLight.includes(p.name);
                            return (
                              <button key={p.id} type="button" onClick={() => (team === 'dark' ? setSelectedDark(isSel ? selectedDark.filter(n => n !== p.name) : [...selectedDark, p.name]) : setSelectedLight(isSel ? selectedLight.filter(n => n !== p.name) : [...selectedLight, p.name]))}
                                className={`pl-2 pr-4 py-2 rounded-2xl flex items-center gap-2 text-xs font-black transition-all ${isSel ? 'bg-indigo-600 text-white shadow-xl' : 'bg-white text-slate-500 border border-slate-200'}`}>
                                <Avatar src={p.photo} name={p.name} size="sm" /> {p.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-12 border-t space-y-12">
                  <div className="flex justify-center items-center gap-16">
                    <div className="text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-4">Oscuro</p>
                      <input type="number" value={scoreDark} onChange={(e) => setScoreDark(e.target.value)} className="w-28 text-5xl font-black text-center py-6 bg-slate-50 rounded-[2.5rem] outline-none border-4 border-transparent focus:border-slate-900" />
                    </div>
                    <span className="text-4xl font-black text-slate-200 italic">VS</span>
                    <div className="text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-4">Claro</p>
                      <input type="number" value={scoreLight} onChange={(e) => setScoreLight(e.target.value)} className="w-28 text-5xl font-black text-center py-6 bg-slate-50 rounded-[2.5rem] outline-none border-4 border-transparent focus:border-indigo-600" />
                    </div>
                  </div>
                  <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
                    <input type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} className="p-5 border-2 border-slate-100 rounded-3xl bg-white font-black text-slate-700" />
                    <button type="submit" className="px-16 py-6 bg-indigo-600 text-white text-xl font-black rounded-[2.5rem] hover:bg-indigo-700 shadow-2xl transition transform active:scale-95">GUARDAR RESULTADO</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- Tab: Jugadores (Listado) --- */}
        {activeTab === 'players' && (
          <div className="max-w-2xl mx-auto space-y-10 animate-in fade-in duration-500">
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
              <h2 className="text-2xl font-black mb-8 italic uppercase">Añadir Jugador</h2>
              <form onSubmit={addPlayer} className="space-y-6 text-center">
                <div className="relative inline-block group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <div className="w-32 h-32 rounded-[2rem] bg-slate-100 border-4 border-dashed border-slate-300 flex items-center justify-center overflow-hidden transition group-hover:border-indigo-400">
                    {newPlayerPhoto ? <img src={newPlayerPhoto} className="w-full h-full object-cover" /> : <Camera className="text-slate-400" size={32} />}
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handlePhotoUpload(e, setNewPlayerPhoto)} />
                </div>
                <div className="flex gap-3">
                  <input type="text" placeholder="Nombre..." value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} className="flex-1 p-5 bg-slate-50 border-2 border-slate-100 rounded-3xl font-bold" />
                  <button type="submit" className="bg-indigo-600 text-white px-10 rounded-3xl font-black uppercase">ALTA</button>
                </div>
                {errorMessage && <div className="text-red-600 text-[10px] font-black uppercase">{errorMessage}</div>}
              </form>
            </div>

            <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-8 bg-slate-50 border-b flex justify-between items-center">
                <h3 className="font-black uppercase italic">Padrón</h3>
                <span className="bg-slate-800 text-white px-4 py-1.5 rounded-full text-[10px] font-black">{players.length} TOTAL</span>
              </div>
              <div className="divide-y divide-slate-100">
                {players.map(p => (
                  <div key={p.id} onClick={() => setSelectedPlayerProfile(playerStats.find(ps => ps.name === p.name))} className="p-6 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer group">
                    <div className="flex items-center gap-5">
                      <Avatar src={p.photo} name={p.name} size="lg" />
                      <div className="flex flex-col">
                        <span className="font-black text-slate-800 text-xl uppercase">{p.name}</span>
                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">VER PERFIL <ChevronRight size={10}/></span>
                      </div>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={(e) => { e.stopPropagation(); checkAdminAction(() => setEditingPlayer({...p})); }} className="p-3 bg-white border border-slate-200 rounded-xl text-indigo-600 transition"><Edit2 size={20}/></button>
                      <button onClick={(e) => { e.stopPropagation(); checkAdminAction(() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', p.id))); }} className="p-3 bg-white border border-slate-200 rounded-xl text-red-500 transition"><Trash2 size={20}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- Modales --- */}
      <Modal isOpen={!!selectedPlayerProfile} onClose={() => setSelectedPlayerProfile(null)} title={`Ficha: ${selectedPlayerProfile?.name}`} maxWidth="max-w-2xl">
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row items-center gap-8 bg-slate-900 p-8 rounded-[2.5rem] text-white">
            <Avatar src={selectedPlayerProfile?.photo} name={selectedPlayerProfile?.name} size="profile" />
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-3xl font-black uppercase italic mb-2">{selectedPlayerProfile?.name}</h2>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="bg-white/10 p-3 rounded-2xl"><p className="text-[10px] font-black text-indigo-300">PTS</p><p className="text-xl font-black">{selectedPlayerProfile?.points}</p></div>
                <div className="bg-white/10 p-3 rounded-2xl"><p className="text-[10px] font-black text-green-300">WR</p><p className="text-xl font-black">{selectedPlayerProfile?.pct.toFixed(0)}%</p></div>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><History size={14} /> Últimos Partidos</h4>
            <div className="space-y-2">
              {getPlayerMatchHistory(selectedPlayerProfile?.name).slice(0, 10).map(m => (
                <div key={m.id} className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 w-12">{new Date(m.date).toLocaleDateString('es-AR', {day: 'numeric', month: 'short'})}</span>
                  <div className={`px-2 py-1 rounded-lg text-[10px] font-black ${m.darkTeam.includes(selectedPlayerProfile.name) ? 'bg-slate-900 text-white' : 'bg-white text-slate-800 border'}`}>{m.darkTeam.includes(selectedPlayerProfile.name) ? 'Oscuro' : 'Claro'}</div>
                  <div className="flex items-center gap-3 font-black"><span>{m.scoreDark}</span><span className="text-slate-300">-</span><span>{m.scoreLight}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showPassModal} onClose={() => { setShowPassModal(false); setPassInput(''); setPassError(false); }} title="Acceso Admin">
        <form onSubmit={handleAdminAuth} className="space-y-6">
          <input autoFocus type="password" placeholder="Contraseña..." value={passInput} onChange={(e) => setPassInput(e.target.value)} className={`w-full p-5 bg-slate-50 border-2 rounded-2xl outline-none font-black text-center text-xl transition-all ${passError ? 'border-red-500 animate-shake' : 'border-slate-100 focus:border-indigo-600'}`} />
          <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-xl uppercase">AUTENTICAR</button>
        </form>
      </Modal>

      <Modal isOpen={!!editingPlayer} onClose={() => setEditingPlayer(null)} title="Editar Jugador">
        <div className="space-y-6 text-center">
          <div className="relative inline-block cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <Avatar src={editingPlayer?.photo} name={editingPlayer?.name} size="xl" />
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition"><Camera className="text-white" size={24} /></div>
          </div>
          <input type="text" value={editingPlayer?.name || ''} onChange={(e) => setEditingPlayer({...editingPlayer, name: e.target.value})} className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-center" />
          <button onClick={updatePlayer} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2"><Save size={20} /> GUARDAR</button>
        </div>
      </Modal>

      {/* Nav Mobile */}
      <nav className="md:hidden fixed bottom-6 left-6 right-6 bg-white shadow-2xl border border-slate-100 px-6 py-4 flex justify-between items-center z-50 rounded-[2.5rem]">
        {[{ id: 'stats', label: 'Tabla', icon: Star }, { id: 'history', label: 'Log', icon: History }, { id: 'register', label: 'Nuevo', icon: PlusCircle }, { id: 'players', label: 'Gente', icon: Users }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-1 transition-all ${activeTab === tab.id ? 'text-indigo-600 scale-125' : 'text-slate-400'}`}>
            <tab.icon size={22} strokeWidth={activeTab === tab.id ? 4 : 2} />
            <span className="text-[8px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;

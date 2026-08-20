import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Users, Search, Shield, ShieldOff, Edit2, Check, X,
    Building, Anchor, Wifi, WifiOff, RefreshCw, UserPlus,
    ChevronDown, AlertTriangle, Clock, Map as MapIcon, BookOpen, Globe, Lock, Unlock, Layers,
    Eye, EyeOff, Calendar, Rewind, Target, Cloud, Box, Database, Bot
} from 'lucide-react';
import { userService } from '../services/api/userService';
import { useFleet } from '../context/DataContext';
import { can, getRoleLabel, getRoleColor, ALL_ROLES_ORDERED } from '../lib/permissions';
import AddUserModal from './AddUserModal';

// ── Helpers ────────────────────────────────────────────────────────────────────
const isOnline = (lastSeen) => {
    if (!lastSeen) return false;
    return (Date.now() - new Date(lastSeen).getTime()) < 2 * 60 * 1000;
};

const fmtDate = (ts) => {
    if (!ts) return '—';
    try {
        return new Date(ts).toLocaleString('it-IT', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    } catch { return '—'; }
};

function RoleBadge({ role }) {
    const { bg, text } = getRoleColor(role);
    return (
        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest inline-block" style={{ backgroundColor: `${bg}20`, color: text }}>
            {getRoleLabel(role)}
        </span>
    );
}

/** Converte lastSeen in etichetta leggibile. Funzione pura — non usa Date.now() nel render. */
const fmtLastSeen = (lastSeen) => {
    if (!lastSeen) return 'NEVER';
    return `${Math.round((Date.now() - new Date(lastSeen)) / 60000)}m ago`;
};

function OnlineStatus({ lastSeen }) {
    const online = isOnline(lastSeen);
    return (
        <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
            <span className={`text-[11px] font-bold ${online ? 'text-green-600' : 'text-slate-400'}`}>
                {online ? 'ONLINE' : fmtLastSeen(lastSeen)}
            </span>
        </div>
    );
}

export default function UserManagementTab() {
    const { vessels } = useFleet();
    const [users, setUsers] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterRole, setFilterRole] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [editingId, setEditingId] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);
    const [error, setError] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const { data: usersData, error: uErr } = await userService.fetchUsersWithRelations();
            const companiesData = await userService.fetchCompanies();
            
            if (uErr) {
                console.error("User Load Detail:", uErr);
                if (uErr.message.includes('custom_overrides')) {
                    setError('⚠️ Schema Database non sincronizzato. I permessi speciali non saranno visibili finché lo schema non viene ricaricato in Supabase.');
                    const { data: fallbackData } = await userService.fetchUsersFallback();
                    setUsers(fallbackData || []);
                } else {
                    throw uErr;
                }
            } else {
                setUsers(usersData || []);
            }
            
            setCompanies(companiesData);
        } catch (err) {
            setError('Failed to load users: ' + err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const matchSearch = !search || [u.email, u.display_name, u.mmsi, u.vessels?.name].some(f => f?.toLowerCase().includes(search.toLowerCase()));
            const matchRole = filterRole === 'all' || u.role === filterRole;
            const matchStatus = filterStatus === 'all' || (filterStatus === 'online' && isOnline(u.last_seen_at)) || (filterStatus === 'blocked' && u.is_blocked);
            return matchSearch && matchRole && matchStatus;
        });
    }, [users, search, filterRole, filterStatus]);

    // FIX TOGGLE BLOCK: Forza il valore opposto correttamente
    const toggleBlock = async (user) => {
        if (user.id === 'master-id' || user.role === 'operation_admin') return alert('Cannot block Operation Admin account');
        const nextStatus = !user.is_blocked;
        setActionLoading(user.id);
        try {
            await userService.toggleBlock(user.id, nextStatus);
            await loadData();
        } catch (err) { 
            setError(err.message); 
        } finally { 
            setActionLoading(null); 
        }
    };

    const saveUser = async (userId, form) => {
        setActionLoading(userId);
        setError('');
        try {
            await userService.updateUser(userId, form);
            setEditingId(null);
            await loadData();
        } catch (err) { 
            setError(err.message); 
        } finally { 
            setActionLoading(null); 
        }
    };

    const stats = useMemo(() => ({
        total: users.length,
        online: users.filter(u => isOnline(u.last_seen_at)).length,
        blocked: users.filter(u => u.is_blocked).length,
        crew: users.filter(u => u.role === 'crew').length,
    }), [users]);

    // ── Edit Row Component (Inline Form) ───────────────────────────────────────
    const EditRow = ({ user, companies, vessels, onSave, onCancel }) => {
        const [form, setForm] = useState({
            display_name: user.display_name || '',
            email: user.email || '',
            password: user.password_plain || '',
            role: user.role || 'crew',
            company_id: user.company_id || '',
            vessel_id: user.vessel_id || '',
            mmsi: user.mmsi || '',
            custom_overrides: user.custom_overrides || {}
        });

        const [showPassword, setShowPassword] = useState(false);

        const toggleOverride = (key) => setForm(p => ({
            ...p,
            custom_overrides: { ...p.custom_overrides, [key]: !p.custom_overrides?.[key] }
        }));

        return (
            <tr className="bg-primary/5">
                <td className="px-6 py-6 rounded-l-[2rem]">
                    <div className="space-y-2">
                        <input className="w-full bg-white border border-primary/20 rounded-full px-5 py-3 text-sm font-bold shadow-xl shadow-primary/5 outline-none focus:ring-2 focus:ring-primary/20" value={form.display_name} onChange={e => setForm({...form, display_name: e.target.value})} placeholder="Full Name" />
                        <div className="grid grid-cols-2 gap-2">
                            <input className="bg-white border border-primary/10 rounded-full px-4 py-2 text-[10px] font-bold outline-none" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="New Email" />
                            <div className="relative">
                                <input 
                                    className="w-full bg-white border border-primary/10 rounded-full px-4 py-2 pr-10 text-[10px] font-bold outline-none font-mono" 
                                    type={showPassword ? "text" : "password"} 
                                    value={form.password} 
                                    onChange={e => setForm({...form, password: e.target.value})} 
                                    placeholder="Password" 
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/30 hover:text-primary transition-colors"
                                >
                                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </td>
                <td className="px-6 py-6">
                    <div className="space-y-2">
                        <select className="w-full bg-white border border-primary/20 rounded-full px-5 py-2 text-xs font-black uppercase outline-none" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                            {ALL_ROLES_ORDERED.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        <select className="w-full bg-white border border-primary/20 rounded-full px-5 py-2 text-[10px] font-black uppercase text-on-surface/40 outline-none" value={form.company_id} onChange={e => setForm({...form, company_id: e.target.value})}>
                            <option value="">No Company</option>
                            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                </td>
                <td className="px-6 py-6" colSpan={2}>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                           <select 
                                className="grow bg-white border border-primary/20 rounded-full px-5 py-3 text-xs font-bold outline-none" 
                                value={form.vessel_id} 
                                onChange={e => {
                                    const vId = e.target.value;
                                    const v = vessels.find(x => x.id === vId);
                                    setForm({ ...form, vessel_id: vId, mmsi: v?.mmsi || '' });
                                }}
                           >
                                <option value="">Select Assigned Vessel</option>
                                {vessels.map(v => <option key={v.id} value={v.id}>{v.name} ({v.mmsi})</option>)}
                           </select>
                           <input className="w-32 bg-white border border-primary/20 rounded-full px-5 py-3 text-xs font-mono font-bold outline-none" placeholder="Custom MMSI" value={form.mmsi} onChange={e => setForm({...form, mmsi: e.target.value})} />
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2 max-w-lg">
                                {[
                                    { id: 'show_map', icon: MapIcon, title: 'Mappa Flotta Live' },
                                    { id: 'access_logbook', icon: BookOpen, title: 'Logbook & Sottomissione' },
                                    { id: 'see_all_vessels', icon: Globe, title: 'Visibilità Tutta la Flotta' },
                                    { id: 'admin_dashboard', icon: Shield, title: 'Accesso Dashboard Admin' },
                                    { id: 'see_logbook_submitted', icon: Edit2, title: 'Visibilità Tab Submitted Logbooks' },
                                    { id: 'see_schedule', icon: Calendar, title: 'Visibilità Tab Schedule' },
                                    { id: 'edit_schedule', icon: Unlock, title: 'Abilita Modifica Schedule' },
                                    { id: 'see_rewind', icon: Rewind, title: 'Visibilità Tab Rewind' },
                                    { id: 'see_copilot', icon: Bot, title: 'Visibilità Copilot IA' },
                                    { id: 'see_production', icon: Target, title: 'Visibilità Tab Production Targets' },
                                    { id: 'see_weather', icon: Cloud, title: 'Visibilità Tab Weather Analytics' },
                                    { id: 'see_3d', icon: Box, title: 'Visibilità Tab 3D Viewer' },
                                    { id: 'see_dbmanager', icon: Database, title: 'Visibilità Tab DB Manager' }
                                ].map(p => (
                                    <button key={p.id} title={p.title} type="button" onClick={() => toggleOverride(p.id)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${form.custom_overrides?.[p.id] ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white border border-surface-low text-on-surface/10 hover:text-on-surface/30'}`}>
                                        <p.icon size={14} />
                                    </button>
                                ))}
                        </div>
                    </div>
                </td>
                <td className="px-6 py-6 rounded-r-[2rem] text-right">
                    <div className="flex items-center justify-end gap-3">
                        <button onClick={() => onSave(user.id, form)} className="bg-primary text-white h-12 px-8 rounded-full text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all">Save Profile</button>
                        <button onClick={onCancel} className="bg-surface-low/30 text-on-surface/40 h-12 px-8 rounded-full text-xs font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-500 transition-all">Cancel</button>
                    </div>
                </td>
            </tr>
        );
    };

    return (
        <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-1000 pb-20">
            {/* Header Kinetic */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                   <h2 className="font-manrope font-extrabold text-2xl text-on-surface tracking-tight leading-none uppercase">User Management</h2>
                   <p className="text-[10px] font-black text-on-surface/40 uppercase tracking-widest mt-2">Gestione accessi flotta e permessi granulari</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={loadData} className="w-12 h-12 rounded-full bg-white border border-surface-low/30 flex items-center justify-center text-on-surface/40 hover:text-primary transition-all shadow-sm">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button 
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-3 bg-primary hover:bg-primary-dark text-white h-12 px-8 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-primary/10 hover:-translate-y-0.5"
                    >
                        <UserPlus size={18} /> Add New User
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Users', value: stats.total, color: 'text-blue-500', bg: 'bg-blue-50', icon: Users },
                    { label: 'Online Now', value: stats.online, color: 'text-green-500', bg: 'bg-green-50', icon: Wifi },
                    { label: 'Blocked', value: stats.blocked, color: 'text-red-500', bg: 'bg-red-50', icon: Lock },
                    { label: 'Crew Members', value: stats.crew, color: 'text-amber-500', bg: 'bg-amber-50', icon: Anchor },
                ].map((s, i) => (
                    <div key={i} className="bg-white rounded-[2rem] p-6 border border-white shadow-sm flex items-center gap-5">
                        <div className={`w-12 h-12 rounded-2xl ${s.bg} flex items-center justify-center`}>
                            <s.icon size={22} className={s.color} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-on-surface/40 uppercase tracking-widest leading-none mb-1">{s.label}</p>
                            <h3 className="text-2xl font-manrope font-extrabold text-on-surface tracking-tight leading-none">{s.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* Toolbar Filtri Kinetic */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-4 bg-white/50 backdrop-blur-md rounded-[3rem] p-2 lg:p-3 border border-white shadow-sm">
                <div className="flex items-center gap-3 px-8 py-3 bg-white rounded-full flex-1 border border-surface-low/30 shadow-inner max-w-sm ml-1">
                    <Search size={16} className="text-on-surface/20" />
                    <input 
                        type="text" 
                        placeholder="Search users..." 
                        className="bg-transparent border-none outline-none text-[11px] font-bold text-on-surface w-full placeholder:text-on-surface/20"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex flex-wrap items-center gap-2 pr-1 ml-auto">
                    <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="bg-white border border-surface-low/30 px-6 py-3 rounded-full text-[9px] font-black uppercase text-on-surface outline-none">
                        <option value="all">Ruoli: Tutti</option>
                        {ALL_ROLES_ORDERED.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-white border border-surface-low/30 px-6 py-3 rounded-full text-[9px] font-black uppercase text-on-surface outline-none">
                        <option value="all">Status: Tutti</option>
                        <option value="online">Online</option>
                        <option value="blocked">Bloccati</option>
                    </select>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-6 flex items-center gap-4 text-red-600 animate-in slide-in-from-top">
                    <AlertTriangle size={20} />
                    <span className="text-xs font-black uppercase tracking-widest">{error}</span>
                    <button onClick={() => setError('')} className="ml-auto text-red-300 hover:text-red-500"><X size={18} /></button>
                </div>
            )}

            {/* Table Kinetic */}
            <div className="bg-white/50 backdrop-blur-md rounded-[3rem] p-4 lg:p-10 border border-white shadow-sm overflow-x-auto mt-4">
                <table className="w-full text-left border-separate border-spacing-y-2">
                    <thead>
                        <tr className="text-[10px] font-black text-on-surface/20 uppercase tracking-[0.2em]">
                            <th className="px-8 py-4">Dati Utente</th>
                            <th className="px-8 py-4">Ruolo & Compagnia</th>
                            <th className="px-8 py-4">Status</th>
                            <th className="px-8 py-4">Permessi</th>
                            <th className="px-8 py-4 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.length === 0 ? (
                            <tr><td colSpan={5} className="py-20 text-center text-on-surface/30 font-bold italic">{loading ? 'Loading...' : 'Nessun utente trovato'}</td></tr>
                        ) : filteredUsers.map(user => (
                            editingId === user.id ? (
                                <EditRow key={user.id} user={user} companies={companies} vessels={vessels} onSave={saveUser} onCancel={() => setEditingId(null)} />
                            ) : (
                                <tr key={user.id} className={`group ${user.is_blocked ? 'opacity-40 grayscale' : ''}`}>
                                    <td className="px-8 py-5 bg-white rounded-l-[2rem]">
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary text-white flex items-center justify-center font-black text-sm border-4 border-white shadow-sm relative">
                                                {(user.display_name || user.email || '?')[0].toUpperCase()}
                                                {user.is_blocked && <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-1 text-white shadow-lg"><Lock size={10} /></div>}
                                            </div>
                                            <div>
                                                <div className="font-extrabold text-sm text-on-surface leading-none mb-1.5 uppercase tracking-tight">{user.display_name || 'Not Set'}</div>
                                                <div className="text-[10px] font-bold text-on-surface/40 leading-none">{user.email}</div>
                                                <div className="text-[10px] font-extrabold text-primary mt-2 flex items-center gap-1.5 uppercase tracking-wider font-mono bg-primary/10 px-2.5 py-1 rounded-full w-fit border border-primary/20 shadow-sm">
                                                    <Lock size={10} /> PWD: {user.password_plain || 'GeoKanban2026!'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 bg-white">
                                         <div className="flex flex-col gap-2">
                                             <RoleBadge role={user.role} />
                                             <div className="flex items-center gap-1.5 opacity-30 text-[9px] font-black uppercase tracking-widest">
                                                 <Building size={10} /> {user.companies?.name || 'GeoKanban Fleet'}
                                             </div>
                                             {user.role === 'crew' && (
                                                 <div className="flex items-center gap-1.5 text-primary text-[9px] font-black uppercase tracking-widest bg-primary/5 px-2 py-1 rounded-md w-fit">
                                                     <Anchor size={10} /> {user.vessels?.name || 'No Vessel'} ({user.mmsi || user.vessels?.mmsi || 'N/A'})
                                                 </div>
                                             )}
                                         </div>
                                     </td>
                                    <td className="px-8 py-5 bg-white">
                                        <OnlineStatus lastSeen={user.last_seen_at} />
                                        {user.last_seen_at && <div className="text-[9px] font-black text-on-surface/20 mt-1.5 uppercase tracking-widest">{fmtDate(user.last_seen_at)}</div>}
                                    </td>
                                    <td className="px-8 py-5 bg-white">
                                        <div className="flex flex-wrap items-center gap-1 max-w-[200px]">
                                            {[
                                                { id: 'show_map', icon: MapIcon, title: 'Mappa Flotta Live' },
                                                { id: 'access_logbook', icon: BookOpen, title: 'Logbook & Sottomissione' },
                                                { id: 'see_all_vessels', icon: Globe, title: 'Visibilità Tutta la Flotta' },
                                                { id: 'admin_dashboard', icon: Shield, title: 'Accesso Dashboard Admin' },
                                                { id: 'see_logbook_submitted', icon: Edit2, title: 'Visibilità Tab Submitted Logbooks' },
                                                { id: 'see_schedule', icon: Calendar, title: 'Visibilità Tab Schedule' },
                                                { id: 'edit_schedule', icon: Unlock, title: 'Abilita Modifica Schedule' },
                                                { id: 'see_rewind', icon: Rewind, title: 'Visibilità Tab Rewind' },
                                                { id: 'see_copilot', icon: Bot, title: 'Visibilità Copilot IA' },
                                                { id: 'see_production', icon: Target, title: 'Visibilità Tab Production Targets' },
                                                { id: 'see_weather', icon: Cloud, title: 'Visibilità Tab Weather Analytics' },
                                                { id: 'see_3d', icon: Box, title: 'Visibilità Tab 3D Viewer' },
                                                { id: 'see_dbmanager', icon: Database, title: 'Visibilità Tab DB Manager' }
                                            ].map(p => {
                                                // Calcola il permesso effettivo (Base + Override)
                                                const effectivePerms = can(user.role, user.custom_overrides || {});
                                                // Mappa gli ID delle icone ai nomi dei permessi in permissions.js
                                                const mapping = {
                                                    'show_map': effectivePerms.showMap,
                                                    'access_logbook': effectivePerms.submitLogbook,
                                                    'see_all_vessels': effectivePerms.seeAllVessels,
                                                    'admin_dashboard': effectivePerms.adminDashboard,
                                                    'see_logbook_submitted': effectivePerms.seeSubmittedLogbooks,
                                                    'see_schedule': effectivePerms.seeSchedule,
                                                    'edit_schedule': effectivePerms.editSchedule,
                                                    'see_rewind': effectivePerms.seeRewindMap,
                                                    'see_copilot': effectivePerms.seeCopilot,
                                                    'see_production': effectivePerms.seeProductionTargets,
                                                    'see_weather': effectivePerms.seeWeatherAnalytics,
                                                    'see_3d': effectivePerms.seePointCloud,
                                                    'see_dbmanager': effectivePerms.accessDBManager
                                                };
                                                const isActive = mapping[p.id];

                                                return (
                                                    <div 
                                                        key={p.id} 
                                                        title={`${p.title} (${isActive ? 'ATTIVO' : 'DISATTIVO'})`}
                                                        className={`w-6 h-6 rounded flex items-center justify-center transition-all ${isActive ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20' : 'bg-surface-low/10 text-on-surface/5'}`}
                                                    >
                                                        <p.icon size={11} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 bg-white rounded-r-[2rem] text-right">
                                        <div className="flex items-center justify-end gap-2 pr-2">
                                            {/* BLINDATURA: Nascondi controlli per Operation Admin Profilo Master */}
                                            {user.role !== 'operation_admin' && (
                                                <>
                                                    <button 
                                                        title="Modifica Profilo"
                                                        onClick={() => setEditingId(user.id)}
                                                        className="w-10 h-10 rounded-full bg-surface-low/20 flex items-center justify-center text-on-surface/20 hover:bg-primary/10 hover:text-primary transition-all"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button 
                                                        title={user.is_blocked ? "Sblocca Utente" : "Blocca Accesso Utente"}
                                                        onClick={() => toggleBlock(user)}
                                                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${user.is_blocked ? 'bg-green-500 text-white shadow-lg' : 'bg-surface-low/20 text-red-400 hover:bg-red-50 hover:text-red-500'}`}
                                                    >
                                                        {user.is_blocked ? <Unlock size={16} /> : <Lock size={16} />}
                                                    </button>
                                                </>
                                            )}
                                            {user.role === 'operation_admin' && (
                                                <div className="w-10 h-10 flex items-center justify-center text-primary/20" title="Super Admin Account - Inviolabile">
                                                    <Shield size={20} />
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )
                        ))}
                    </tbody>
                </table>
            </div>

            {showAddModal && <AddUserModal onClose={() => setShowAddModal(false)} onUserAdded={loadData} companies={companies} vessels={vessels} />}
        </div>
    );
}

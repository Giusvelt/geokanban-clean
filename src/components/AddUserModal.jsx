import React, { useState } from 'react';
import { X, UserPlus, Mail, User, Shield, Anchor, Map as MapIcon, BookOpen, Layers, Globe, CheckCircle2, AlertCircle, Eye, EyeOff, RefreshCw, Calendar, Rewind, Target, Cloud, Box, Database, Unlock, Edit2 } from 'lucide-react';
import { userService } from '../services/api/userService';

export default function AddUserModal({ onClose, onUserAdded, companies, vessels = [] }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    // Form State
    const [form, setForm] = useState({
        email: '',
        displayName: '',
        role: 'crew',
        companyId: '',
        vesselId: '',
        mmsi: '',
        password: Math.random().toString(36).slice(-8) // Password random iniziale
    });

    // Custom Permissions (Ibridi)
    const [perms, setPerms] = useState({
        show_map: false,
        access_logbook: true,
        see_all_vessels: false,
        admin_dashboard: false,
        see_logbook_submitted: true,
        see_schedule: true,
        edit_schedule: true,
        see_rewind: false,
        see_production: false,
        see_weather: true,
        see_3d: true,
        see_dbmanager: false
    });

    const [showPassword, setShowPassword] = useState(false);

    const togglePerm = (k) => setPerms(p => ({ ...p, [k]: !p[k] }));

    const handleInvite = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // STEP 1: Creazione utente tramite RPC (Richiede funzione DB specifica 'invite_user_v3')
            // Se la RPC non esiste ancora, usiamo l'inserimento diretto nel profilo come simulazione (o gestiamo l'invito vero)
            const { data, error: inviteError } = await userService.createUser({
                email: form.email,
                password: form.password,
                displayName: form.displayName,
                role: form.role,
                companyId: form.companyId,
                vesselId: form.vesselId,
                mmsi: form.mmsi,
                customOverrides: perms
            });

            setSuccess(true);
            setTimeout(() => {
                onUserAdded();
                onClose();
            }, 2000);

        } catch (err) {
            setError(err.message || 'Errore durante la creazione utente. Assicurati che l\'email sia univoca.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-on-surface/20 backdrop-blur-sm" onClick={onClose} />
            
            <div className="relative bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                {/* Header */}
                <div className="bg-primary p-8 text-white relative">
                    <button onClick={onClose} className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all">
                        <X size={20} />
                    </button>
                    <div className="w-16 h-16 rounded-3xl bg-white/10 flex items-center justify-center mb-4">
                        <UserPlus size={32} />
                    </div>
                    <h2 className="text-3xl font-manrope font-extrabold tracking-tight">Add New User</h2>
                    <p className="text-white/60 text-sm font-bold uppercase tracking-widest mt-1">Configura credenziali e permessi ibridi</p>
                </div>

                <form onSubmit={handleInvite} className="p-8 lg:p-12 space-y-8 max-h-[70vh] overflow-y-auto scrollbar-hide">
                    {success ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in">
                            <div className="w-20 h-20 rounded-full bg-green-500 text-white flex items-center justify-center mb-6 shadow-xl shadow-green-200">
                                <CheckCircle2 size={40} />
                            </div>
                            <h3 className="text-2xl font-manrope font-extrabold text-on-surface">User Created!</h3>
                            <p className="text-on-surface/40 font-bold mt-2">Le credenziali sono state salvate con successo.</p>
                        </div>
                    ) : (
                        <>
                            {/* Section: Anagrafica */}
                            <div className="space-y-4">
                                <div className="text-[10px] font-black text-on-surface/20 uppercase tracking-[0.2em] mb-4">Account Information</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-on-surface/40 uppercase tracking-widest ml-4">Full Name</label>
                                        <div className="flex items-center gap-3 px-6 py-4 bg-surface-low/30 rounded-full border border-surface-low/50">
                                            <User size={18} className="text-on-surface/20" />
                                            <input required type="text" placeholder="Giacomo Rossi" className="bg-transparent border-none outline-none w-full font-bold text-sm" value={form.displayName} onChange={e => setForm({...form, displayName: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-on-surface/40 uppercase tracking-widest ml-4">Email Address</label>
                                        <div className="flex items-center gap-3 px-6 py-4 bg-surface-low/30 rounded-full border border-surface-low/50">
                                            <Mail size={18} className="text-on-surface/20" />
                                            <input required type="email" placeholder="user@gmail.com" className="bg-transparent border-none outline-none w-full font-bold text-sm" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-on-surface/40 uppercase tracking-widest ml-4">Initial Password</label>
                                        <div className="relative flex items-center gap-3 px-6 py-4 bg-surface-low/30 rounded-full border border-surface-low/50">
                                            <Shield size={18} className="text-on-surface/20" />
                                            <input 
                                                required 
                                                type={showPassword ? "text" : "password"} 
                                                placeholder="Password" 
                                                className="bg-transparent border-none outline-none w-full font-black text-sm text-primary pr-10" 
                                                value={form.password} 
                                                onChange={e => setForm({...form, password: e.target.value})} 
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-6 text-primary/30 hover:text-primary transition-colors"
                                            >
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-on-surface/40 uppercase tracking-widest ml-4">Primary Role</label>
                                        <div className="flex items-center gap-3 px-6 py-4 bg-surface-low/30 rounded-full border border-surface-low/50">
                                            <Globe size={18} className="text-on-surface/20" />
                                            <select className="bg-transparent border-none outline-none w-full font-bold text-sm" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                                                <option value="crew">Crew Member</option>
                                                <option value="crew_admin">Crew Admin (Fleet)</option>
                                                <option value="operation">Operations Member</option>
                                                <option value="operation_admin">Operations Admin</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section: Hybrid Permissions */}
                            <div className="space-y-4">
                                <div className="text-[10px] font-black text-on-surface/20 uppercase tracking-[0.2em] mb-4">Hybrid Permissions (Overlays)</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {[
                                        { id: 'show_map', label: 'View Live Map', desc: 'Sblocca mappa flotta live', icon: MapIcon },
                                        { id: 'access_logbook', label: 'Certified Logbook', desc: 'Invio ed edit per sottomissione', icon: BookOpen },
                                        { id: 'see_all_vessels', label: 'Global Fleet View', desc: 'Vede tutte le navi', icon: Globe },
                                        { id: 'admin_dashboard', label: 'Admin Dashboard', desc: 'Accesso a Dashboard Admin', icon: Shield },
                                        { id: 'see_logbook_submitted', label: 'Submitted Logbooks Tab', desc: 'Visibilità logbooks sottomessi', icon: Edit2 },
                                        { id: 'see_schedule', label: 'Schedule Tab', desc: 'Visibilità tab pianificazione', icon: Calendar },
                                        { id: 'edit_schedule', label: 'Edit Schedule', desc: 'Abilita modifiche a calendario', icon: Unlock },
                                        { id: 'see_rewind', label: 'Rewind Tab', desc: 'Visibilità tab Mission Rewind', icon: Rewind },
                                        { id: 'see_production', label: 'Production Tab', desc: 'Visibilità tab Production Targets', icon: Target },
                                        { id: 'see_weather', label: 'Weather Tab', desc: 'Visibilità tab Weather Analytics', icon: Cloud },
                                        { id: 'see_3d', label: '3D Tab', desc: 'Visibilità tab 3D Viewer', icon: Box },
                                        { id: 'see_dbmanager', label: 'DB Manager Tab', desc: 'Visibilità tab DB Manager', icon: Database }
                                    ].map(p => (
                                        <button 
                                            key={p.id}
                                            type="button"
                                            onClick={() => togglePerm(p.id)}
                                            className={`flex items-center gap-4 p-4 rounded-3xl border transition-all text-left ${perms[p.id] ? 'bg-primary/5 border-primary/20 shadow-sm' : 'bg-white border-surface-low/30 opacity-60'}`}
                                        >
                                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${perms[p.id] ? 'bg-primary text-white' : 'bg-surface-low text-on-surface/20'}`}>
                                                <p.icon size={20} />
                                            </div>
                                            <div className="flex-1">
                                                <div className={`text-xs font-black uppercase tracking-tight ${perms[p.id] ? 'text-primary' : 'text-on-surface/40'}`}>{p.label}</div>
                                                <div className="text-[10px] font-bold text-on-surface/30 leading-none mt-0.5">{p.desc}</div>
                                            </div>
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${perms[p.id] ? 'bg-primary border-primary text-white' : 'border-surface-low'}`}>
                                                {perms[p.id] && <CheckCircle2 size={12} />}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Nav / MMSI Optional */}
                            {form.role === 'crew' && (
                                <div className="bg-green-600 rounded-3xl p-6 flex gap-4 border border-green-700 shadow-xl shadow-green-600/20 text-white text-xs font-bold animate-in slide-in-from-top duration-500">
                                    <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 backdrop-blur-sm border border-white/30"><Anchor size={24} className="text-white" /></div>
                                    <div className="w-full">
                                        <span className="text-green-50 tracking-wide">Associando un MMSI, l'utente sarà automaticamente vincolato a quella nave nelle notifiche e nei filtri di default.</span>
                                        <select 
                                            className="mt-3 block w-full bg-white border-2 border-white rounded-full px-5 py-3 text-sm outline-none text-green-900 font-black shadow-inner cursor-pointer hover:bg-green-50 transition-colors"
                                            value={form.vesselId}
                                            onChange={e => {
                                                const vId = e.target.value;
                                                const v = vessels.find(x => x.id === vId);
                                                setForm({...form, vesselId: vId, mmsi: v?.mmsi || ''});
                                            }}
                                        >
                                            <option value="">Nessuna Nave Associata</option>
                                            {vessels.map(v => (
                                                <option key={v.id} value={v.id}>{v.name} ({v.mmsi})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-50 border border-red-100 rounded-3xl p-4 flex items-center gap-3 text-red-600">
                                    <AlertCircle size={18} />
                                    <span className="text-xs font-extrabold uppercase tracking-tight">{error}</span>
                                </div>
                            )}

                            {/* Submit */}
                            <button 
                                disabled={loading}
                                className="w-full bg-primary hover:bg-primary-dark text-white p-6 rounded-[2rem] font-manrope font-extrabold text-lg uppercase tracking-widest shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-3"
                            >
                                {loading ? <RefreshCw size={24} className="animate-spin" /> : <><UserPlus size={24} /> Create User Account</>}
                            </button>
                        </>
                    )}
                </form>
            </div>
        </div>
    );
}

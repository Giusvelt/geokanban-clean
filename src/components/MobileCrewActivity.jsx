import React, { useState, useRef } from 'react';
import { 
  Ship, MapPin, Clock, ShieldCheck, Wind, MessageSquare,
  Edit3, Save, Send, X, AlertCircle, ChevronRight, Search, Calendar, Filter, RefreshCw
} from 'lucide-react';
import { useOperations } from '../context/DataContext';
import { useUserProfile } from '../hooks/useUserProfile';
import LogbookEntryModal from './LogbookEntryModal';
import ActivityChatModal from './ActivityChatModal';
import { formatTimeShort } from '../utils/timeFormatters';
import { activityColor } from '../utils/activityUtils';




export default function MobileCrewActivity({ tab = 'all' }) {
  const {
    activities, loading, fetchActivities,
    selectedMonth, setSelectedMonth, selectedYear, setSelectedYear
  } = useOperations();
  const { profile } = useUserProfile();

  const [searchTerm, setSearchTerm] = useState('');
  const [logbookModal, setLogbookModal] = useState(null);
  const [chatModal, setChatModal] = useState(null);
  const [menuActivity, setMenuActivity] = useState(null);
  const [pressingId, setPressingId] = useState(null);
  const longPressTimer = useRef(null);
  const pressStartTime = useRef(null);

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const filtered = (activities || []).filter(a => {
    const isSubmitted = a.logbookStatus === 'submitted' || a.logbookStatus === 'approved';
    if (tab === 'submitted' && !isSubmitted) return false;
    if (tab === 'all' && isSubmitted) return false;
    if (searchTerm && !a.activity.toLowerCase().includes(searchTerm.toLowerCase()) && !a.vessel.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  }).sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

  // ─── Long Press Handlers ───────────────────────────────────────
  const handleTouchStart = (activity, e) => {
    pressStartTime.current = Date.now();
    setPressingId(activity.id);
    longPressTimer.current = setTimeout(() => {
      setMenuActivity(activity);
      setPressingId(null);
      if (window.navigator.vibrate) window.navigator.vibrate([40, 10, 40]);
    }, 550);
  };
  const handleTouchEnd = (e) => {
    const duration = Date.now() - (pressStartTime.current || 0);
    clearTimeout(longPressTimer.current);
    if (duration < 550) setPressingId(null);
  };
  const handleTouchMove = () => {
    clearTimeout(longPressTimer.current);
    setPressingId(null);
  };

  if (loading && !activities.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-on-surface/40 font-black text-xs uppercase tracking-widest">Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Header Filters */}
      <div className="sticky top-0 z-20 bg-[#f7f9fb]/95 backdrop-blur-md px-1 pt-2 pb-4 space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface/30" />
          <input 
            type="text" 
            placeholder="Cerca attività..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-surface-low/50 rounded-2xl pl-10 pr-4 py-3 text-xs font-bold text-on-surface placeholder:text-on-surface/20 shadow-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
          {tab === 'submitted' && (
            <div className="flex items-center gap-1.5 bg-white border border-surface-low/50 rounded-xl px-3 py-2 shadow-sm shrink-0">
               <Calendar size={12} className="text-primary/60" />
               <select 
                 value={selectedMonth} 
                 onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                 className="bg-transparent text-[10px] font-black uppercase tracking-widest text-on-surface/60 outline-none"
               >
                 {months.map((m, i) => <option key={m} value={i}>{m.substring(0, 3)}</option>)}
               </select>
               <div className="w-px h-3 bg-surface-low/30 mx-1" />
               <select 
                 value={selectedYear} 
                 onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                 className="bg-transparent text-[10px] font-black uppercase tracking-widest text-on-surface/60 outline-none"
               >
                 {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
               </select>
            </div>
          )}
          <button onClick={fetchActivities} className="w-10 h-10 bg-white border border-surface-low/50 rounded-xl flex items-center justify-center text-on-surface/30 active:bg-surface-low shadow-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {!filtered.length ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-4">
          <div className="w-16 h-16 rounded-full bg-surface-low flex items-center justify-center">
            <AlertCircle size={28} className="text-on-surface/20" />
          </div>
          <div>
            <p className="font-manrope font-extrabold text-on-surface/40">Nessuna attività</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3 px-1">
            {filtered.map((a) => {
            const isActive = a.status === 'in-progress';
            const isSubmitted = a.logbookStatus === 'submitted' || a.logbookStatus === 'approved';
            const isPressing = pressingId === a.id;
            const color = activityColor(a.activity);

            return (
                <div
                    key={a.id}
                    onTouchStart={(e) => handleTouchStart(a, e)}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchMove}
                    className={`relative bg-surface-lowest rounded-2xl overflow-hidden shadow-sm border border-surface-low/40 transition-all ${isPressing ? 'scale-[0.97] brightness-95' : 'scale-100'} ${isActive ? 'ring-2 ring-primary/25' : ''}`}
                >
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: color }} />
                <div className="pl-4 pr-4 py-4 ml-1">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 pr-2">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h3 className="font-manrope font-extrabold text-[16px] text-on-surface leading-tight">{a.activity}</h3>
                                {isSubmitted && (
                                    <span className="flex items-center gap-1 bg-green-50 text-green-600 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                                    <ShieldCheck size={9}/> Inviato
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <MapPin size={11} className="text-on-surface/30 shrink-0" />
                                <span className="text-xs font-bold text-on-surface/50 truncate">{a.geofence || '—'}</span>
                            </div>
                        </div>
                        <div className="shrink-0 text-right">
                            <div className="text-[10px] font-manrope font-bold text-on-surface">
                            {formatTimeShort(a.startTime)} › <span>{formatTimeShort(a.endTime)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-surface-low/40">
                        <div className="flex items-center gap-2">
                            <Ship size={12} className="text-on-surface/30" />
                            <span className="text-[11px] font-bold text-on-surface/50">{a.vessel}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button 
                                onClick={(e) => { e.stopPropagation(); setChatModal(a); }}
                                className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${a.totalMsgCount > 0 ? 'bg-blue-500 text-white' : 'bg-surface-low text-on-surface/40'}`}
                            >
                                <MessageSquare size={18} />
                                {a.unreadMsgCount > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-secondary rounded-full border-2 border-white" />}
                            </button>
                            
                            {!isSubmitted ? (
                                <button 
                                    onClick={() => setLogbookModal(a)}
                                    className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md shadow-primary/20 active:scale-95 transition-all"
                                >
                                    <Edit3 size={12} /> Edit
                                </button>
                            ) : (
                                <button 
                                    onClick={() => setLogbookModal(a)}
                                    className="flex items-center gap-2 bg-green-50 text-green-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-green-100 active:scale-95 transition-all"
                                >
                                    <ShieldCheck size={12} /> View
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                </div>
            );
            })}
        </div>
      )}

      {/* ─── BOTTOM SHEET MENU (LONG PRESS) ────────────────────────── */}
      {menuActivity && (
        <>
          <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={() => setMenuActivity(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-[100] bg-surface-lowest rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom pb-safe">
            <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 bg-on-surface/15 rounded-full" /></div>
            <div className="px-6 py-4 border-b border-surface-low/40">
              <h3 className="font-manrope font-extrabold text-lg text-on-surface">{menuActivity.activity}</h3>
              <p className="text-xs font-bold text-on-surface/40">{menuActivity.vessel} · {menuActivity.geofence}</p>
            </div>
            <div className="px-4 py-4 space-y-3">
              <button
                onClick={() => { setLogbookModal(menuActivity); setMenuActivity(null); }}
                className="w-full flex items-center justify-between bg-primary/8 rounded-2xl px-5 py-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center"><Edit3 size={18} /></div>
                  <p className="font-extrabold text-on-surface">Gestione Logbook</p>
                </div>
                <ChevronRight size={20} className="text-on-surface/30" />
              </button>
            </div>
            <div className="px-4 pb-8">
              <button onClick={() => setMenuActivity(null)} className="w-full py-4 rounded-2xl border border-surface-low text-on-surface/40 font-black text-xs uppercase tracking-widest">Chiudi</button>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      {logbookModal && <LogbookEntryModal activity={logbookModal} profile={profile} entryMeta={logbookModal.logbookEntry} onClose={() => setLogbookModal(null)} onSaved={fetchActivities} />}
      {chatModal && <ActivityChatModal activity={chatModal} profile={profile} onClose={() => { setChatModal(null); fetchActivities(); }} />}
    </div>
  );
}

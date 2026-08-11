import React, { useState, useMemo, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { scheduleService } from '../services/api/scheduleService';
import { Calendar, ChevronLeft, ChevronRight, AlertCircle, Clock, X, Plus, Wind } from 'lucide-react';
import '../logbook-writer.css';
import { can } from '../lib/permissions';
import SectionHeader from './SectionHeader';

// Palette colori fissa mappata per nome nave
const VESSEL_COLOR_MAPPING = {
    'SIDER BUFFALO': '#00FFFF', // Ciano brillante
    'SIDER ORION': '#00FF00',   // Verde fluo
    'SIDER RODI': '#FF6600',    // Arancio
    'ANNAMARIA Z': '#FF00FF',   // Fucsia / Magenta
    'FABIO DUO Z': '#FFFF00',   // Giallo acceso
    'MARIA VITTORIA Z': '#1D4ED8', // Blu primario / Oltremare
    'SIDER ABIDJAN': '#FF0000', // Rosso vivo
    'SIDER DONUT': '#6366F1',   // Blu-Viola
    'SIDER REBECCA': '#FFFFFF', // Bianco
};

export default function StandbySchedule() {
    const { profile, vessels, standbyReasons, schedules, fetchSchedules, companyVesselIds, approveSchedule, rejectSchedule, activities } = useData();
    const perms = can(profile?.role);

    const visibleVessels = useMemo(() => {
        if (perms.seeAllVessels) return (vessels || []).filter(v => v.tracking_active);
        if (perms.seeCompanyVessels && companyVesselIds) {
            return (vessels || []).filter(v => companyVesselIds.includes(v.id) && v.tracking_active);
        }
        return (vessels || []).filter(v => v.id === profile?.vesselId && v.tracking_active);
    }, [vessels, perms, companyVesselIds, profile?.vesselId]);

    // Mappa vessel_id → colore stabile
    const vesselColorMap = useMemo(() => {
        const map = {};
        visibleVessels.forEach((v, i) => { 
            map[v.id] = VESSEL_COLOR_MAPPING[v.name?.toUpperCase()] || '#94a3b8'; 
        });
        return map;
    }, [visibleVessels]);

    const [currentDate, setCurrentDate] = useState(new Date());
    // Default: nessuna nave selezionata (fleet view)
    const [selectedVesselId, setSelectedVesselId] = useState(
        perms.seeOwnVesselOnly ? profile?.vesselId : null
    );

    // Se è crew forza la propria nave dopo il caricamento
    React.useEffect(() => {
        if (perms.seeOwnVesselOnly && !selectedVesselId && profile?.vesselId) {
            setSelectedVesselId(profile.vesselId);
        }
    }, [profile?.vesselId, perms.seeOwnVesselOnly, selectedVesselId]);

    // Helper to get today's date in YYYY-MM-DD format (local time)
    const getTodayStr = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    };
    const toDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    // Modal & Sidebar state
    const [showRangeForm, setShowRangeForm] = useState(false);
    const [rangeData, setRangeData] = useState({
        startDate: getTodayStr(),
        endDate: getTodayStr(),
        allDay: true,
        startTime: '08:00',
        endTime: '17:00',
        reasonId: '',
        notes: '',
    });
    const [selectedDate, setSelectedDate] = useState(null); // per edit giorno singolo (click su giorno)
    const [modalData, setModalData] = useState({ reasonId: '', notes: '' });
    const [saving, setSaving] = useState(false);
    
    const [sidebarTab, setSidebarTab] = useState('upcoming');
    const [inspectedDateStr, setInspectedDateStr] = useState(getTodayStr());


    // Helpers for calendar
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    // For Admin: Calculate upcoming 7 days standbys for Sidebar
    const upcomingStandbys = useMemo(() => {
        if (perms.seeOwnVesselOnly) return [];
        const next7Days = new Date(today);
        next7Days.setDate(today.getDate() + 7);

        return (schedules || []).filter(s => {
            if (!perms.seeAllVessels && companyVesselIds && !companyVesselIds.includes(s.vessel_id)) return false;
            const d = new Date(s.standby_date);
            return d >= today && d <= next7Days;
        }).sort((a, b) => new Date(a.standby_date) - new Date(b.standby_date));
    }, [schedules, perms, today, companyVesselIds]);

    // For Admin: Calculate daily standbys across fleet for selected date
    const dailyStandbys = useMemo(() => {
        if (perms.seeOwnVesselOnly || !inspectedDateStr) return [];
        return (schedules || []).filter(s => {
            if (!perms.seeAllVessels && companyVesselIds && !companyVesselIds.includes(s.vessel_id)) return false;
            return s.standby_date === inspectedDateStr;
        }).sort((a, b) => a.vessels?.name.localeCompare(b.vessels?.name));
    }, [schedules, perms, companyVesselIds, inspectedDateStr]);

    // Fleet view: per ogni giorno del mese, tutte le navi in standby
    const fleetSchedulesByDate = useMemo(() => {
        return (schedules || []).reduce((acc, s) => {
            if (!acc[s.standby_date]) acc[s.standby_date] = [];
            acc[s.standby_date].push(s);
            return acc;
        }, {});
    }, [schedules]);

    // Calcola i giorni in cui il weather standby auto era attivo
    // Usa le vere 'Weather Stand-by' activities automatiche dalla telemetria
    const weatherStandbyDates = useMemo(() => {
        const dates = new Set();
        
        // 1. Estrai le vere attività automatiche (isFleetEvent)
        if (activities && activities.length > 0) {
            const fleetWeatherActivities = activities.filter(a => a.isFleetEvent && a.activity === 'Weather Stand-by');
            fleetWeatherActivities.forEach(a => {
                const start = new Date(a.startTime);
                const end = a.endTime ? new Date(a.endTime) : new Date(); // If still active, show up to today
                
                const curr = new Date(start);
                curr.setHours(0, 0, 0, 0);
                const endDay = new Date(end);
                endDay.setHours(0, 0, 0, 0);
                
                while (curr <= endDay) {
                    const dStr = `${curr.getFullYear()}-${String(curr.getMonth()+1).padStart(2,'0')}-${String(curr.getDate()).padStart(2,'0')}`;
                    dates.add(dStr);
                    curr.setDate(curr.getDate() + 1);
                }
            });
        }

        // 2. Legacy fallback
        // Un giorno è "weather fleet" se TUTTE le navi visibili hanno standby WEATHER
        // Oppure se c'è almeno 1 vessel_standby_schedule con reason WEATHER per 3+ navi
        const byDate = fleetSchedulesByDate;
        Object.entries(byDate).forEach(([date, sArr]) => {
            const weatherCount = sArr.filter(s => s.standby_reasons?.code === 'WEATHER' || s.standby_reasons?.code === 'SUD_WTHR').length;
            if (weatherCount >= Math.max(2, visibleVessels.length * 0.5)) dates.add(date);
        });
        return dates;
    }, [activities, fleetSchedulesByDate, visibleVessels.length]);

    // Pending approvals count
    const pendingSchedules = useMemo(() => {
        if (perms.seeOwnVesselOnly) return [];
        return (schedules || []).filter(s => s.is_approved === false || s.is_approved === null);
    }, [schedules, perms.seeOwnVesselOnly]);

    // Current vessel schedules (per singola nave selezionata)
    const vesselSchedules = useMemo(() => {
        if (!selectedVesselId) return {};
        return (schedules || []).filter(s => s.vessel_id === selectedVesselId).reduce((acc, s) => {
            acc[s.standby_date] = s;
            return acc;
        }, {});
    }, [schedules, selectedVesselId]);

    const handleDayClick = (day) => {
        const dateClicked = new Date(year, month, day);
        const dateStr = toDateStr(dateClicked);
        setInspectedDateStr(dateStr);
        setSidebarTab('daily');
        // Edit singolo giorno solo se una nave è selezionata
        if (perms.editSchedule && selectedVesselId) {
            setSelectedDate(dateClicked);
            const existing = vesselSchedules[dateStr];
            setModalData({
                reasonId: existing?.standby_reason_id || '',
                notes: existing?.notes || ''
            });
        }
    };

    // Salva standby singolo giorno (legacy click su giorno)
    const handleSaveStandby = async () => {
        if (!selectedDate || !modalData.reasonId || !selectedVesselId) return;
        setSaving(true);
        try {
            const dateStr = toDateStr(selectedDate);
            const existing = vesselSchedules[dateStr];
            if (existing) {
                await scheduleService.updateSchedule(existing.id, { standbyReasonId: modalData.reasonId, notes: modalData.notes });
            } else {
                await scheduleService.insertSchedule({
                    vesselId: selectedVesselId,
                    standbyDate: dateStr,
                    standbyReasonId: modalData.reasonId,
                    notes: modalData.notes,
                    createdBy: profile.id
                });
            }
            await fetchSchedules();
            setSelectedDate(null);
        } catch (error) {
            console.error('Failed to save standby', error);
            alert(`Error: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    // Salva standby da form range
    const handleSaveRange = async () => {
        if (!rangeData.reasonId || !selectedVesselId) return;
        setSaving(true);
        try {
            await scheduleService.insertScheduleRange({
                vesselId: selectedVesselId,
                startDate: rangeData.startDate,
                endDate: rangeData.endDate,
                standbyReasonId: rangeData.reasonId,
                notes: rangeData.notes,
                createdBy: profile.id,
                allDay: rangeData.allDay,
                startTime: rangeData.startTime ? rangeData.startTime + ':00' : null,
                endTime: rangeData.endTime ? rangeData.endTime + ':00' : null,
            });
            await fetchSchedules();
            setShowRangeForm(false);
            setRangeData({ startDate: getTodayStr(), endDate: getTodayStr(), allDay: true, startTime: '08:00', endTime: '17:00', reasonId: '', notes: '' });
        } catch (error) {
            console.error('Failed to save range standby', error);
            alert(`Error: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteStandby = async () => {
        if (!selectedDate) return;
        setSaving(true);
        try {
            const dateStr = toDateStr(selectedDate);
            const existing = vesselSchedules[dateStr];
            if (existing) {
                await scheduleService.deleteSchedule(existing.id);
                await fetchSchedules();
            }
            setSelectedDate(null);
        } catch (error) {
            console.error('Failed to delete standby', error);
            alert(`Error: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    // Render giorni del calendario
    const renderCalendarDays = () => {
        const blks = [];
        const isFleetView = !selectedVesselId;
        for (let i = 0; i < firstDay; i++) {
            blks.push(<div key={`empty-${i}`} className="cal-day empty"></div>);
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const dateStr = toDateStr(date);
            const isToday = date.getTime() === today.getTime();
            const isPast = date < today;
            const isWeatherDay = weatherStandbyDates.has(dateStr);

            const isSelected = dateStr === inspectedDateStr;

            if (isFleetView) {
                // Fleet view: mostra tutti i pallini delle navi
                const daySchedules = fleetSchedulesByDate[dateStr] || [];
                blks.push(
                    <div
                        key={d}
                        className={`cal-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${isPast ? 'past' : ''} clickable`}
                        onClick={() => { setInspectedDateStr(dateStr); setSidebarTab('daily'); }}
                        style={{
                            position: 'relative',
                            minHeight: 64,
                            border: isSelected 
                                ? '2.5px solid #2563eb' 
                                : (isToday ? '1.5px dashed #3b82f6' : '1px solid #e2e8f0'),
                            backgroundColor: isSelected 
                                ? '#f8fafc' 
                                : (isToday ? '#eff6ff' : '#ffffff'),
                            boxShadow: isSelected ? '0 4px 6px -1px rgba(0, 0, 0, 0.05), inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)' : 'none',
                            transition: 'all 0.15s'
                        }}
                    >
                        {/* Barra grigia weather fleet standby */}
                        {isWeatherDay && (
                            <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0,
                                height: '4px', background: '#94a3b8', borderRadius: '2px 2px 0 0',
                                zIndex: 1
                            }} title="Weather Stand-by (All Vessels)" />
                        )}
                        <span className="day-num font-black text-[10px]">{d}</span>
                        {/* Pallini colorati per ogni nave */}
                        {daySchedules.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginTop: '4px' }}>
                                {daySchedules.map(s => (
                                    <div
                                        key={s.id}
                                        title={s.vessels?.name + ' — ' + (s.standby_reasons?.code || '')}
                                        style={{
                                            width: 14, height: 14,
                                            borderRadius: '50%',
                                            background: vesselColorMap[s.vessel_id] || '#94a3b8',
                                            flexShrink: 0
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );
            } else {
                // Single-vessel view: comportamento precedente
                const data = vesselSchedules[dateStr];
                blks.push(
                    <div
                        key={d}
                        className={`cal-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${isPast ? 'past' : ''} ${data ? 'has-event' : ''} ${perms.editSchedule ? 'clickable group relative' : ''}`}
                        onClick={() => handleDayClick(d)}
                        style={{
                            position: 'relative',
                            minHeight: 64,
                            border: isSelected 
                                ? '2.5px solid #2563eb' 
                                : (isToday ? '1.5px dashed #3b82f6' : '1px solid #e2e8f0'),
                            backgroundColor: isSelected 
                                ? '#f8fafc' 
                                : (isToday ? '#eff6ff' : '#ffffff'),
                            boxShadow: isSelected ? '0 4px 6px -1px rgba(0, 0, 0, 0.05), inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)' : 'none',
                            transition: 'all 0.15s'
                        }}
                    >
                        {/* Barra grigia weather fleet (anche in singola nave) */}
                        {isWeatherDay && (
                            <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0,
                                height: '4px', background: '#94a3b8', borderRadius: '2px 2px 0 0'
                            }} title="Weather Stand-by (All Vessels)" />
                        )}
                        <div className="flex justify-between items-start w-full">
                            <span className="day-num font-black text-[10px]">{d}</span>
                            {perms.editSchedule && (
                                <div className="w-6 h-6 flex items-center justify-center text-slate-300 bg-white rounded-md border border-slate-100 shadow-sm hover:text-primary hover:border-primary/30 active:scale-95 transition-all cursor-pointer z-10 opacity-0 group-hover:opacity-100">
                                    <Plus size={14} strokeWidth={2.5} />
                                </div>
                            )}
                        </div>
                        {data && (
                            <div
                                className="day-event tooltip-trigger"
                                style={{ marginTop: 'auto', width: '100%', cursor: 'pointer' }}
                                onClick={(e) => { e.stopPropagation(); setInspectedDateStr(dateStr); setSidebarTab('daily'); }}
                            >
                                <div className="event-pill" style={{ background: vesselColorMap[data.vessel_id] || '#f59e0b', color: 'white', fontSize: '10px', padding: '2px 4px', borderRadius: '4px', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {data.standby_reasons?.code || 'Standby'}
                                </div>
                            </div>
                        )}
                    </div>
                );
            }
        }
        return blks;
    };

    return (
        <div className="pt-tab-container">
            <SectionHeader 
                title="Schedule & Stand-by" 
                subtitle="Fleet availability and planned maintenance windows" 
                icon={Calendar}
                actions={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* Selettore nave */}
                        <select
                            value={selectedVesselId || ''}
                            onChange={(e) => setSelectedVesselId(e.target.value || null)}
                            className="bg-white/50 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest text-on-surface outline-none focus:ring-2 ring-primary/20"
                        >
                            {!perms.seeOwnVesselOnly && <option value="">🌍 All Vessels</option>}
                            {visibleVessels.map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                        </select>
                        {/* Bottone Aggiungi Standby (solo se nave selezionata e permesso) */}
                        {perms.editSchedule && selectedVesselId && (
                            <button
                                onClick={() => setShowRangeForm(true)}
                                className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full px-4 py-2 transition-colors"
                            >
                                <Plus size={12} /> Aggiungi Standby
                            </button>
                        )}
                    </div>
                }
            />

            <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
                {/* Calendario */}
                <div style={{ flex: 1, background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '16px', flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <button onClick={prevMonth} className="btn-icon w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-low transition-colors"><ChevronLeft size={16} /></button>
                            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                            </h3>
                            <button onClick={nextMonth} className="btn-icon w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-low transition-colors"><ChevronRight size={16} /></button>
                        </div>

                        <div className="cal-grid">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} className="cal-header-day text-[10px] uppercase font-black opacity-30 tracking-widest">{day}</div>
                            ))}
                            {renderCalendarDays()}
                        </div>
                    </div>
                </div>

                {/* Sidebar for Operations/Crew Admin */}
                {!perms.seeOwnVesselOnly && (
                    <div style={{ width: '420px', display: 'flex', flexDirection: 'column', gap: '16px', flexShrink: 0 }}>
                        {/* Box Legenda Colori Navi */}
                        {visibleVessels.length > 0 && (
                            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
                                <div style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Legenda Navi</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                                    {visibleVessels.map(v => (
                                        <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: vesselColorMap[v.id], flexShrink: 0 }} />
                                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>{v.name}</span>
                                        </div>
                                    ))}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', gridColumn: 'span 2', marginTop: '4px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                                        <div style={{ width: 24, height: 4, borderRadius: 2, background: '#94a3b8', flexShrink: 0 }} />
                                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8' }}>Weather Stand-by Flotta (Cantiere)</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Contenitore Tabs originali */}
                        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            {/* Tab Headers */}
                            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                <div 
                                    onClick={() => setSidebarTab('upcoming')}
                                    style={{ flex: 1, padding: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderBottom: sidebarTab === 'upcoming' ? '2px solid #f59e0b' : '2px solid transparent', background: sidebarTab === 'upcoming' ? '#fff' : 'transparent', transition: 'all 0.2s' }}
                                >
                                    <Clock size={14} color={sidebarTab === 'upcoming' ? '#f59e0b' : '#94a3b8'} />
                                    <span style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', color: sidebarTab === 'upcoming' ? '#0f172a' : '#94a3b8' }}>Upcoming</span>
                                </div>
                                <div 
                                    onClick={() => setSidebarTab('daily')}
                                    style={{ flex: 1, padding: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderBottom: sidebarTab === 'daily' ? '2px solid #3b82f6' : '2px solid transparent', background: sidebarTab === 'daily' ? '#fff' : 'transparent', transition: 'all 0.2s' }}
                                >
                                    <Calendar size={14} color={sidebarTab === 'daily' ? '#3b82f6' : '#94a3b8'} />
                                    <span style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', color: sidebarTab === 'daily' ? '#0f172a' : '#94a3b8' }}>Daily Details</span>
                                </div>
                                <div 
                                    onClick={() => setSidebarTab('approvals')}
                                    style={{ flex: 1, padding: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderBottom: sidebarTab === 'approvals' ? '2px solid #ef4444' : '2px solid transparent', background: sidebarTab === 'approvals' ? '#fff' : 'transparent', transition: 'all 0.2s', position: 'relative' }}
                                >
                                    <AlertCircle size={14} color={sidebarTab === 'approvals' ? '#ef4444' : '#94a3b8'} />
                                    <span style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', color: sidebarTab === 'approvals' ? '#0f172a' : '#94a3b8' }}>Approvals</span>
                                    {pendingSchedules.length > 0 && (
                                        <div style={{ position: 'absolute', top: '4px', right: '4px', width: '12px', height: '12px', background: '#ef4444', borderRadius: '50%', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="animate-pulse">
                                            <div style={{ width: '4px', height: '4px', background: 'white', borderRadius: '50%' }} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Content */}
                            <div style={{ padding: '12px', flex: 1, overflowY: 'auto', maxHeight: '400px' }}>
                                {sidebarTab === 'upcoming' && (
                                    <>
                                        {upcomingStandbys.length === 0 ? (
                                            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '11px', marginTop: '20px', fontStyle: 'italic' }}>
                                                No stand-bys scheduled.
                                            </div>
                                        ) : (
                                            upcomingStandbys.map(s => {
                                                const d = new Date(s.standby_date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
                                                return (
                                                    <div key={s.id} onClick={() => { setInspectedDateStr(s.standby_date); setSidebarTab('daily'); }} style={{ marginBottom: '8px', padding: '8px', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fde68a', cursor: 'pointer', transition: 'transform 0.1s' }} className="hover:scale-[1.02]">
                                                        <div style={{ fontSize: '9px', fontWeight: '900', color: '#b45309', marginBottom: '2px', textTransform: 'uppercase' }}>
                                                            {d}
                                                        </div>
                                                        <div style={{ fontSize: '12px', fontWeight: '900', color: '#0f172a' }}>
                                                            {s.vessels?.name}
                                                        </div>
                                                        <div style={{ fontSize: '10px', color: '#475569', marginTop: '1px', fontWeight: '700' }}>
                                                            {s.standby_reasons?.code}
                                                        </div>
                                                    </div>
                                                )
                                            })
                                        )}
                                    </>
                                )}
                                
                                {sidebarTab === 'daily' && (
                                    <>
                                        {!inspectedDateStr ? (
                                            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '11px', marginTop: '40px', padding: '0 20px', fontStyle: 'italic', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                <Calendar size={24} color="#cbd5e1" />
                                                Click an event on the calendar to view fleet details for that day.
                                            </div>
                                        ) : (
                                            <>
                                                <div style={{ marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #e2e8f0' }}>
                                                    <div style={{ fontSize: '10px', fontWeight: '900', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        {new Date(inspectedDateStr).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                                        {dailyStandbys.length} vessel{dailyStandbys.length !== 1 && 's'} in Stand-by
                                                    </div>
                                                </div>
                                                
                                                {dailyStandbys.length === 0 ? (
                                                    <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '11px', marginTop: '20px', fontStyle: 'italic' }}>
                                                        No stand-bys found for this day.
                                                    </div>
                                                ) : (
                                                    dailyStandbys.map(s => (
                                                        <div key={s.id} style={{ marginBottom: '8px', padding: '10px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                                                            <div style={{ fontSize: '12px', fontWeight: '900', color: '#1e3a8a', marginBottom: '4px' }}>
                                                                {s.vessels?.name}
                                                            </div>
                                                            <div style={{ display: 'inline-block', background: '#3b82f6', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', marginBottom: '6px' }}>
                                                                {s.standby_reasons?.code}
                                                            </div>
                                                            <div style={{ fontSize: '11px', color: '#334155' }}>
                                                                <strong>{s.standby_reasons?.name}</strong>
                                                                {s.notes && <p style={{ margin: '4px 0 0 0', paddingLeft: '8px', borderLeft: '2px solid #93c5fd' }}>{s.notes}</p>}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </>
                                        )}
                                    </>
                                )}

                                {sidebarTab === 'approvals' && (
                                    <>
                                        {pendingSchedules.length === 0 ? (
                                            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '11px', marginTop: '40px', padding: '0 20px', fontStyle: 'italic', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                <AlertCircle size={24} color="#cbd5e1" />
                                                No pending standby requests.
                                            </div>
                                        ) : (
                                            <>
                                                <div style={{ marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #e2e8f0' }}>
                                                    <div style={{ fontSize: '10px', fontWeight: '900', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        Pending Approval
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                                        {pendingSchedules.length} request{pendingSchedules.length !== 1 && 's'} waiting
                                                    </div>
                                                </div>
                                                
                                                {pendingSchedules.map(s => (
                                                    <div key={s.id} style={{ marginBottom: '12px', padding: '12px', background: '#fff1f2', borderRadius: '12px', border: '1px solid #fecdd3' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                            <span style={{ fontSize: '9px', fontWeight: '900', color: '#e11d48', textTransform: 'uppercase' }}>
                                                                {new Date(s.standby_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                            </span>
                                                            <span style={{ fontSize: '9px', fontWeight: '900', color: '#94a3b8' }}>
                                                                {new Date(s.created_at).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: '13px', fontWeight: '900', color: '#1e293b', marginBottom: '4px' }}>
                                                            {s.vessels?.name}
                                                        </div>
                                                        <div style={{ display: 'inline-block', background: '#e11d48', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', marginBottom: '8px' }}>
                                                            {s.standby_reasons?.code}
                                                        </div>
                                                        {s.notes && (
                                                            <div style={{ fontSize: '11px', color: '#475569', marginBottom: '12px', padding: '8px', background: 'white', borderRadius: '6px', border: '1px solid #fecdd3' }}>
                                                                {s.notes}
                                                            </div>
                                                        )}
                                                        {perms.editSchedule && (
                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                <button 
                                                                    onClick={() => approveSchedule(s.id, profile.id)}
                                                                    className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white text-[10px] font-black uppercase rounded-lg transition-colors"
                                                                >
                                                                    Approve
                                                                </button>
                                                                <button 
                                                                    onClick={() => rejectSchedule(s.id)}
                                                                    className="flex-1 py-2 bg-white border border-red-200 text-red-500 hover:bg-red-50 text-[10px] font-black uppercase rounded-lg transition-colors"
                                                                >
                                                                    Reject
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal for Crew to Edit/Add */}
            {selectedDate && (
                <div className="lem-overlay">
                    <div className="lem-modal" style={{ maxWidth: '400px' }}>
                        <div className="lem-header">
                            <div>
                                <h2>Stand-by Declaration</h2>
                                <p style={{ fontSize: '12px', color: '#64748b' }}>
                                    Date: {selectedDate.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
                            </div>
                            <button className="lem-close" onClick={() => setSelectedDate(null)}><X size={18} /></button>
                        </div>
                        <div className="lem-body" style={{ padding: '20px' }}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Stand-by Reason</label>
                                <select
                                    className="edit-select"
                                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                    value={modalData.reasonId}
                                    onChange={e => setModalData({ ...modalData, reasonId: e.target.value })}
                                >
                                    <option value="">-- Select Reason --</option>
                                    {standbyReasons.map(r => (
                                        <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Notes (Optional)</label>
                                <textarea
                                    className="lem-narrative"
                                    style={{ width: '100%', minHeight: '80px', padding: '8px' }}
                                    placeholder="Enter additional details..."
                                    value={modalData.notes}
                                    onChange={e => setModalData({ ...modalData, notes: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="lem-footer" style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', borderTop: '1px solid #e2e8f0' }}>
                            {vesselSchedules[`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`] ? (
                                <button
                                    className="lem-btn-cancel"
                                    onClick={handleDeleteStandby}
                                    disabled={saving}
                                    style={{ color: '#ef4444', borderColor: '#ef4444' }}
                                >
                                    Remove
                                </button>
                            ) : (
                                <div />
                            )}
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="lem-btn-cancel" onClick={() => setSelectedDate(null)} disabled={saving}>Cancel</button>
                                <button className="lem-btn-submit" onClick={handleSaveStandby} disabled={saving || !modalData.reasonId}>
                                    {saving ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal for Range Stand-by */}
            {showRangeForm && (
                <div className="lem-overlay">
                    <div className="lem-modal" style={{ maxWidth: '450px' }}>
                        <div className="lem-header">
                            <div>
                                <h2>Aggiungi Stand-by Multi-giorno</h2>
                                <p style={{ fontSize: '12px', color: '#64748b' }}>
                                    Imposta un periodo di standby per la nave selezionata
                                </p>
                            </div>
                            <button className="lem-close" onClick={() => setShowRangeForm(false)}><X size={18} /></button>
                        </div>
                        <div className="lem-body" style={{ padding: '20px' }}>
                            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="checkbox"
                                    id="allDayCheckbox"
                                    checked={rangeData.allDay}
                                    onChange={e => setRangeData({ ...rangeData, allDay: e.target.checked })}
                                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                />
                                <label htmlFor="allDayCheckbox" style={{ fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                                    Giornata intera (All Day)
                                </label>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '6px', textTransform: 'uppercase', color: '#64748b' }}>Data Inizio</label>
                                    <input
                                        type="date"
                                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                        value={rangeData.startDate}
                                        onChange={e => setRangeData({ ...rangeData, startDate: e.target.value })}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '6px', textTransform: 'uppercase', color: '#64748b' }}>Data Fine</label>
                                    <input
                                        type="date"
                                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                        value={rangeData.endDate}
                                        onChange={e => setRangeData({ ...rangeData, endDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            {!rangeData.allDay && (
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '6px', textTransform: 'uppercase', color: '#64748b' }}>Ora Inizio</label>
                                        <input
                                            type="time"
                                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                            value={rangeData.startTime}
                                            onChange={e => setRangeData({ ...rangeData, startTime: e.target.value })}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '6px', textTransform: 'uppercase', color: '#64748b' }}>Ora Fine</label>
                                        <input
                                            type="time"
                                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                            value={rangeData.endTime}
                                            onChange={e => setRangeData({ ...rangeData, endTime: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Motivazione Stand-by</label>
                                <select
                                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                    value={rangeData.reasonId}
                                    onChange={e => setRangeData({ ...rangeData, reasonId: e.target.value })}
                                >
                                    <option value="">-- Seleziona Motivazione --</option>
                                    {standbyReasons.map(r => (
                                        <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Note (Opzionale)</label>
                                <textarea
                                    className="lem-narrative"
                                    style={{ width: '100%', minHeight: '80px', padding: '8px' }}
                                    placeholder="Inserisci dettagli aggiuntivi..."
                                    value={rangeData.notes}
                                    onChange={e => setRangeData({ ...rangeData, notes: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="lem-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '16px 20px', borderTop: '1px solid #e2e8f0' }}>
                            <button className="lem-btn-cancel" onClick={() => setShowRangeForm(false)} disabled={saving}>Annulla</button>
                            <button className="lem-btn-submit" onClick={handleSaveRange} disabled={saving || !rangeData.reasonId}>
                                {saving ? 'Salvataggio...' : 'Salva'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

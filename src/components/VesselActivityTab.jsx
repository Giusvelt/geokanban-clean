import React, { useState, useMemo } from 'react';
import { useFleet, useOperations, useConfig } from '../context/DataContext';
import { messagesService } from '../services/api/messagesService';
import { activityService } from '../services/api/activityService';
import { formatDate, formatHour, formatTime, calcDuration } from '../utils/timeFormatters';
import { activityColor, getVesselActivities, countActivitiesByType } from '../utils/activityUtils';
import { exportActivitiesToExcel } from '../utils/excelExporter';
import {
    Ship, MapPin, Clock, Filter, RefreshCw, Anchor, Navigation,
    ArrowDownRight, ArrowUpRight, Search, Edit3, Check, X, Trash2, Plus,
    BookOpen, ShieldCheck, Wind, BarChart2, CalendarDays, MessageSquare, ChevronRight, FileText, CheckCircle, Eye,
    Target, TrendingUp, Package, AlertTriangle
} from 'lucide-react';
import LogbookEntryModal from './LogbookEntryModal';
import ActivityChatModal from './ActivityChatModal';
import ManualActivityModal from './ManualActivityModal';
import EditActivityModal from './EditActivityModal';
import { useUserProfile } from '../hooks/useUserProfile';
import { can } from '../lib/permissions';
import complianceData from '../data/compliance_kpi_data.json';





export default function VesselActivityTab({ 
    view = 'all',
    vesselFilter, setVesselFilter
}) {
    const { vessels, geofences, crewVesselId, companyVesselIds } = useFleet();
    const { activities, lastUpdate, loading, fetchActivities, productionPlans, selectedMonth, setSelectedMonth, selectedYear, setSelectedYear } = useOperations();
    const { profile: userProfile } = useConfig();
    const perms = userProfile?.permissions || can(userProfile?.role);

    const [showKpiArchive, setShowKpiArchive] = useState(false);
    const [showComplianceArchive, setShowComplianceArchive] = useState(false);
    const [search, setSearch] = useState('');
    const [logbookActivity, setLogbookActivity] = useState(null);
    const [chatActivity, setChatActivity] = useState(null);
    const [isChatReadOnly, setIsChatReadOnly] = useState(false);
    const [hoverData, setHoverData] = useState({ id: null, messages: [], loading: false });
    const [showManualModal, setShowManualModal] = useState(false);
    const [editAdminActivity, setEditAdminActivity] = useState(null);

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    const { aisStats, activitiesInPeriod } = useMemo(() => {
        if (!activities) return { aisStats: { total: 0, submitted: 0 }, activitiesInPeriod: [] };
        
        let total = 0;
        let submittedCount = 0;

        const filtered = activities.filter(a => {
            // Filtro Permission (Check di base)
            let isVisible = true;
            if (a.vesselId !== null) {
                if (perms.seeCompanyVessels && companyVesselIds) isVisible = companyVesselIds.includes(a.vesselId);
                if (perms.seeOwnVesselOnly && crewVesselId) isVisible = a.vesselId === crewVesselId;
            }
            
            if (!isVisible) return false;

            // Logica Contatori (su base visibile/permessa)
            total++;
            const isSubmitted = ['submitted', 'approved'].includes(a.logbookStatus);
            if (isSubmitted) submittedCount++;

            // Filtro Vista
            if (view === 'submitted' && !isSubmitted) return false;
            // ADMIN PERSISTENCE: Se admin (Operations/Admin), vede tutto nel tab Vessel Activity (view === 'to-submit')
            if (view === 'to-submit' && isSubmitted && !perms.adminDashboard) return false;

            return true;
        });

        return {
            aisStats: { total, submitted: submittedCount },
            activitiesInPeriod: filtered
        };
    }, [activities, perms, crewVesselId, companyVesselIds, view, userProfile]);

    const { filtered, weatherStandbys } = useMemo(() => {
        let base = activitiesInPeriod || [];
        
        const globalStandbys = base.filter(a => a.vesselId === null && a.activity === 'Weather Stand-by');
        // Do not filter out global standbys, we want them to show in the table
        
        const q = search.toLowerCase().trim();
        if (vesselFilter === 'IN_PROGRESS') {
            base = base.filter(a => !a.endTime || a.status === 'in-progress');
        } else if (vesselFilter !== 'All') {
            base = base.filter(a => a.vessel === vesselFilter);
        }
        if (q) base = base.filter(a => 
            a.vessel?.toLowerCase().includes(q) || 
            a.activity?.toLowerCase().includes(q) || 
            (a.geofence || '').toLowerCase().includes(q)
        );

        base = base.map(a => {
            const aStart = new Date(a.startTime).getTime();
            const aEnd = a.endTime ? new Date(a.endTime).getTime() : new Date().getTime();
            
            const overlaps = globalStandbys.filter(ws => {
                if (a.vesselId === null) return false;
                const wsStart = new Date(ws.startTime).getTime();
                const wsEnd = ws.endTime ? new Date(ws.endTime).getTime() : new Date().getTime();
                return aStart < wsEnd && aEnd > wsStart;
            });
            
            return { ...a, overlappingStandbys: overlaps };
        });

        return { filtered: base, weatherStandbys: globalStandbys };
    }, [activitiesInPeriod, vesselFilter, search]);

    const kpiByMonth = useMemo(() => {
        const groups = {};
        
        // Group data exclusively from productionPlans (Source of Truth)
        (productionPlans || []).forEach(p => {
            if (!p.period_name) return;
            
            const [mName, yStr] = p.period_name.split(' ');
            const mIdx = MONTHS.indexOf(mName);
            if (mIdx === -1) return;
            
            const year = Number(yStr);
            const key = `${year}-${mIdx}`;
            
            if (!groups[key]) {
                groups[key] = { month: mIdx, year, loading: 0, navigation: 0, unloading: 0, deliveredTons: 0, goalTons: 0 };
            }

            if (p.vessel_id === null) {
                // Global goal
                groups[key].goalTons = p.target_quantity || 0;
            } else {
                // Aggregate vessel actuals
                groups[key].unloading += (p.actual_trips || 0);
                groups[key].deliveredTons += (p.actual_quantity || 0);
                groups[key].loading += (p.loading_count || 0);
                groups[key].navigation += (p.navigation_count || 0);
            }
        });
        
        return Object.values(groups).sort((a,b) => b.year - a.year || b.month - a.month);
    }, [productionPlans]);

    const stats = useMemo(() => {
        const current = kpiByMonth.find(k => k.month === selectedMonth && k.year === selectedYear) || {
            loading: 0, navigation: 0, unloading: 0, deliveredTons: 0, goalTons: 0
        };
        // Calcolo reale dinamico: SOMMA (vessel.avg_cargo * loading_count) per ogni nave
        let calculatedDelivered = 0;
        (vessels || []).forEach(v => {
            const vActs = getVesselActivities(activities, v);
            const loadingCount = countActivitiesByType(vActs, 'Loading');
            const cargo = v.avg_cargo || 0;
            calculatedDelivered += (cargo * loadingCount);
        });

        const totalTarget = current.goalTons || 300000;
        const deliveredTotal = calculatedDelivered > 0 ? calculatedDelivered : (current.deliveredTons || 0);
        const remainingTotal = Math.max(0, totalTarget - deliveredTotal);
        const progressPct = totalTarget > 0 ? Math.round((deliveredTotal / totalTarget) * 100) : 0;

        return {
            loading: current.loading,
            navigation: current.navigation,
            unloading: current.unloading,
            totalAis: aisStats.total,
            submittedAis: aisStats.submitted,
            deliveredTons: deliveredTotal,
            goalTons: totalTarget,
            remainingTons: remainingTotal,
            progress: progressPct
        };
    }, [kpiByMonth, selectedMonth, selectedYear, aisStats, vessels, activities]);

    const handleCloseMonth = async () => {
        if (!confirm('Close current month and generate Certified SAL?')) return;
        try {
            const hash = await activityService.certifyMonthlySal(selectedMonth + 1, selectedYear);
            alert('Certification successful! Hash: ' + hash);
            fetchActivities();
        } catch (error) {
            alert(error.message);
        }
    };

    const handleDeleteActivity = async (activity) => {
        const isSubmitted = ['submitted', 'approved'].includes(activity.logbookStatus);
        const warningMsg = isSubmitted 
            ? `⚠️ WARNING: This activity is already SUBMITTED or APPROVED.\nDeleting it will affect Certified SAL totals.\n\nAre you sure you want to delete this activity?`
            : `Are you sure you want to delete this activity? This will also delete any associated chat messages or logbook entries.`;

        if (!confirm(warningMsg)) return;

        try {
            await activityService.deleteActivity(activity.id);
            let targetId = null;
            if (userProfile?.role === 'crew') targetId = crewVesselId;
            else if (userProfile?.role === 'crew_admin') targetId = companyVesselIds;
            fetchActivities(targetId, userProfile?.role);
        } catch (error) {
            alert('Error deleting activity: ' + error.message);
        }
    };

    const handleExportExcel = () => {
        exportActivitiesToExcel(filtered, selectedYear, selectedMonth);
    };

    const handleMessageHover = async (activityId) => {
        if (hoverData.id === activityId) return;
        setHoverData({ id: activityId, messages: [], loading: true });
        try {
            const data = await messagesService.fetchRecentMessages(activityId, 2);
            setHoverData({ id: activityId, messages: data.reverse(), loading: false });
        } catch (err) {
            console.error('Error fetching hover messages:', err);
            setHoverData({ id: null, messages: [], loading: false });
        }
    };

    return (
        <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-1000 pb-20">
            {/* KPI STATS & ARCHIVE visibili solo agli admin nel tab principale o 'all' */}
            {perms.adminDashboard && (view === 'all' || view === 'to-submit') && (
                <>
                    {/* PRODUCTION KPI ROW */}
                    <div className="production-stats-grid">
                        {[
                            { label: 'Monthly Goal', value: stats.goalTons.toLocaleString(), unit: 'tons', icon: Target, color: 'text-primary', bg: 'bg-primary/10', border: 'border-b-primary shadow-sm' },
                            { label: 'Delivered (Est.)', value: stats.deliveredTons.toLocaleString(), unit: 't', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
                            { label: 'Remaining', value: stats.remainingTons.toLocaleString(), unit: 't', icon: Package, color: 'text-amber-600', bg: 'bg-amber-50' },
                            { label: 'Overall Progress', progress: stats.progress, icon: BarChart2, color: 'text-primary', bg: 'bg-primary/5' },
                        ].map((stat, i) => (
                            <div key={i} className={`bg-white rounded-2xl p-5 border border-surface-low ${stat.border || ''} flex items-center gap-4`}>
                                {stat.progress !== undefined ? (
                                    <>
                                        <div className="w-12 h-12 rounded-full border-4 border-primary/20 flex items-center justify-center">
                                            <div className="text-sm font-black text-primary">{stat.progress}%</div>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black text-on-surface/40 uppercase tracking-widest mb-2">{stat.label}</p>
                                            <div className="h-1.5 w-full bg-surface-low rounded-full overflow-hidden">
                                                <div className="h-full bg-primary" style={{ width: `${stat.progress}%` }} />
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className={`w-12 h-12 rounded-full ${stat.bg} flex items-center justify-center ${stat.color}`}>
                                            <stat.icon size={24} />
                                        </div>
                                        <div className="flex-1">
                                             <p className="text-[10px] font-black text-on-surface/40 uppercase tracking-widest mb-1">{stat.label}</p>
                                             <div className="flex items-end gap-1">
                                                 <h3 className={`text-2xl font-manrope font-extrabold ${stat.color} leading-none`}>{stat.value}</h3>
                                                 <span className={`text-xs font-bold ${stat.color}/60 mb-0.5`}>{stat.unit}</span>
                                             </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* COMPACT OPERATIONAL STATS ROW — PHASE 28 */}
                    <div className="stats-row-compact">
                        {[
                            { label: 'Loading', value: stats.loading, color: 'text-green-500' },
                            { label: 'Navigation', value: stats.navigation, color: 'text-blue-500' },
                            { label: 'Unloading', value: stats.unloading, color: 'text-amber-500' },
                            { label: 'Tracked Vessels', value: (vessels || []).filter(v => v.tracking_active).length, color: 'text-purple-500' },
                        ].map((stat, i) => (
                            <div key={i} className="stat-card-compact group">
                                <span className="stat-label">{stat.label}</span>
                                <span className={`stat-value ${stat.color}`}>{stat.value}</span>
                            </div>
                        ))}
                    </div>




                </>
            )}

            {/* TOOLBAR COMPACT - OPTIMIZED */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white/50 backdrop-blur-md rounded-[1.5rem] p-1.5 border border-white shadow-sm">
                        <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-[1.25rem] border border-surface-low/30 shadow-inner max-w-xs flex-1 ml-0.5">
                            <Search size={14} className="text-on-surface/20" />
                            <input type="text" placeholder="Search activities..." className="bg-transparent border-none outline-none text-[11px] font-bold text-on-surface w-full placeholder:text-on-surface/20 uppercase tracking-tight" value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        
                            <div className="flex flex-wrap items-center gap-1.5 pr-0.5">
                                <div className="flex items-center bg-white border border-surface-low/30 rounded-xl overflow-hidden shadow-sm">
                                    <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className="bg-transparent pl-4 pr-2 py-2 text-[9px] font-black uppercase text-on-surface outline-none cursor-pointer hover:bg-surface-low/10 transition-colors">
                                        {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                    </select>
                                    <div className="w-px h-4 bg-surface-low/30" />
                                    <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="bg-transparent px-2 py-2 text-[9px] font-black uppercase text-on-surface outline-none cursor-pointer hover:bg-surface-low/10 transition-colors">
                                        {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                    <div className="w-px h-4 bg-surface-low/30" />
                                    <select value={vesselFilter} onChange={e => setVesselFilter(e.target.value)} className="bg-transparent pl-2 pr-4 py-2 text-[9px] font-black uppercase text-on-surface outline-none cursor-pointer hover:bg-surface-low/10 transition-colors">
                                        <option value="All">All Vessels</option>
                                        <option value="IN_PROGRESS" style={{ fontWeight: 'bold', color: '#0284c7' }}>⚡ IN PROGRESS ACTIVITIES ONLY</option>
                                        {perms.adminDashboard ? (
                                            (vessels || [])
                                                .filter(v => v.tracking_active)
                                                .map(v => <option key={v.id} value={v.name}>{v.name}</option>)
                                        ) : (
                                            <option value={userProfile?.vesselName || 'Crew'}>{userProfile?.vesselName || 'My Vessel'}</option>
                                        )}
                                    </select>
                                </div>
                            
                            {(perms.adminDashboard || view === 'submitted') && (
                                <>
                                    <button onClick={handleExportExcel} className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-surface-low/30 px-4 py-2 rounded-xl text-[9px] font-black text-on-surface/50 uppercase tracking-widest transition-all shadow-sm">
                                        <FileText size={12} className="text-primary/60" /> Export Certified
                                    </button>
                                </>
                            )}
                            
                            {(perms.submitLogbook || perms.approveLogbook) && (
                                <button
                                    onClick={() => setShowManualModal(true)}
                                    className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-sm shadow-amber-500/10 border-none cursor-pointer"
                                >
                                    <Plus size={12} /> Add Activity
                                </button>
                            )}
                            
                            <button onClick={fetchActivities} className={`w-9 h-9 bg-white border border-surface-low/30 text-on-surface/20 rounded-full flex items-center justify-center transition-all hover:text-primary hover:border-primary/30 shadow-sm cursor-pointer ${loading ? 'animate-spin border-primary' : ''}`}>
                                <RefreshCw size={14} />
                            </button>
                        </div>
                    </div>

                    {/* TABLE COMPACT */}
                    <div className="bg-white/50 backdrop-blur-md rounded-2xl p-2 lg:p-4 border border-white shadow-sm overflow-x-auto mt-2">
                        <table className="w-full text-left border-separate border-spacing-y-1">
                            <thead>
                                <tr className="text-[9px] font-black text-on-surface/20 uppercase tracking-[0.1em]">
                                    <th className="px-4 py-3 w-[4%] min-w-[50px] whitespace-nowrap">Ref</th>
                                    {view === 'submitted' ? (
                                        <>
                                            <th className="px-4 py-3 w-[12%] min-w-[110px] whitespace-nowrap">Vessel</th>
                                            <th className="px-4 py-3 w-[15%] min-w-[130px] whitespace-nowrap text-left">Activity</th>
                                            <th className="px-4 py-3 w-[10%] min-w-[110px] whitespace-nowrap">ATA / ATD</th>
                                            <th className="px-4 py-3 w-[8%] min-w-[80px] whitespace-nowrap">Pilots (In/Out)</th>
                                            <th className="px-4 py-3 w-[8%] min-w-[80px] whitespace-nowrap">Moor (In/Out)</th>
                                            <th className="px-4 py-3 w-[10%] min-w-[100px] whitespace-nowrap">Tugs (U / S {'>'} E)</th>
                                            <th className="px-4 py-3 text-left w-[22%] min-w-[180px]">NARRATIVE / NOTES</th>
                                            <th className="px-4 py-3 text-left w-[10%] min-w-[110px] whitespace-nowrap">RESPONSIBLE</th>
                                            <th className="px-4 py-3 text-left w-[8%] min-w-[90px] whitespace-nowrap">HASH</th>
                                            <th className="px-4 py-3 text-center w-[4%] min-w-[60px] whitespace-nowrap">Status</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="px-4 py-3 w-[15%] min-w-[130px] whitespace-nowrap text-left">Activity</th>
                                            <th className="px-4 py-3 w-[12%] min-w-[110px] whitespace-nowrap">Vessel</th>
                                            <th className="px-4 py-3 text-left w-[25%] min-w-[180px] whitespace-nowrap">Geofence / Hub</th>
                                            <th className="px-4 py-3 w-[12%] min-w-[110px] whitespace-nowrap">Arrived (ATA)</th>
                                            <th className="px-4 py-3 w-[12%] min-w-[110px] whitespace-nowrap">Departed (ATD)</th>
                                            <th className="px-4 py-3 w-[10%] min-w-[100px] whitespace-nowrap text-sky-700">AIS Draft (In/Out)</th>
                                            <th className="px-4 py-3 w-[8%] min-w-[80px] whitespace-nowrap">Duration</th>
                                            <th className="px-4 py-3 w-[8%] min-w-[90px] whitespace-nowrap">Weather</th>
                                            <th className="px-4 py-3 text-center w-[4%] min-w-[60px] whitespace-nowrap">Status</th>
                                        </>
                                    )}
                                    <th className="px-4 py-3 text-right w-[4%] min-w-[60px] whitespace-nowrap">MSG</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((a, i) => {
                                    const isSubmitted = ['submitted', 'approved'].includes(a.logbookStatus);
                                    const entry = a.logbookEntry || {};
                                    const sf = entry.structured_fields || {};
                                    
                                    const vesselCell = (
                                        <td className="px-4 py-3 bg-white font-manrope font-extrabold text-xs text-on-surface uppercase tracking-tight">
                                            <div className="flex items-center gap-1.5">
                                                {a.isFleetEvent ? (
                                                    <span className="text-purple-600 bg-purple-50 px-2 py-1 rounded-lg border border-purple-100 flex items-center gap-1.5 shadow-sm">
                                                        {a.vessel}
                                                    </span>
                                                ) : (
                                                    a.vessel
                                                )}
                                                {a.source === 'manual' && (
                                                    <span className="bg-amber-500 text-white text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-0.5" title="Manually Entered Activity">
                                                        <AlertTriangle size={8} /> MANUAL
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    );

                                    const activityCell = (
                                        <td className="px-4 py-3 bg-white">
                                            <div className="flex items-center gap-2">
                                                <span 
                                                    className={`text-[9px] font-black uppercase tracking-tight px-2 py-0.5 rounded-lg border border-current/10 ${a.isFleetEvent ? 'shadow-sm border-purple-200' : ''}`} 
                                                    style={{ 
                                                        backgroundColor: a.isFleetEvent ? '#f3e8ff' : `${activityColor(a.activity)}10`, 
                                                        color: a.isFleetEvent ? '#a855f7' : activityColor(a.activity) 
                                                    }}
                                                >
                                                    {a.activity}
                                                </span>
                                                {a.overlappingStandbys && a.overlappingStandbys.length > 0 && (
                                                    <div className="flex items-center gap-1" title={`${a.overlappingStandbys.length} Stand-by meteo in cantiere durante questa attività`}>
                                                        {a.overlappingStandbys.map((_, idx) => (
                                                            <div key={idx} className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-sm border border-purple-200" />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    );

                                    return (
                                        <tr key={a.id} className={`group ${a.isFleetEvent ? 'bg-purple-50/50' : ''}`}>
                                            <td className="px-4 py-3 bg-white rounded-l-xl text-[10px] font-black text-on-surface/10">{i + 1}</td>
                                            
                                            {view === 'submitted' ? (
                                                <>
                                                    {vesselCell}
                                                    {activityCell}
                                                    <td className="px-4 py-3 bg-white text-[10px] font-bold text-on-surface/60">
                                                        {formatTime(a.startTime)} <br/> {a.endTime ? formatTime(a.endTime) : '...'}
                                                    </td>
                                                    <td className="px-4 py-3 bg-white text-[10px] font-bold text-on-surface/80">
                                                        {sf.arrival_pilot_in ? formatTime(sf.arrival_pilot_in).split(' ')[1] : '—'} <br/>
                                                        {sf.arrival_pilot_out ? formatTime(sf.arrival_pilot_out).split(' ')[1] : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 bg-white text-[10px] font-bold text-on-surface/80">
                                                        {sf.arrival_mooring_in ? formatTime(sf.arrival_mooring_in).split(' ')[1] : '—'} <br/>
                                                        {sf.arrival_mooring_out ? formatTime(sf.arrival_mooring_out).split(' ')[1] : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 bg-white text-[10px] font-bold text-on-surface/80">
                                                        {sf.arrival_tug_count || 0} U {sf.arrival_tug_in ? formatTime(sf.arrival_tug_in).split(' ')[1] : '—'} {'>'} {sf.arrival_tug_out ? formatTime(sf.arrival_tug_out).split(' ')[1] : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 bg-white text-[10px] font-medium text-on-surface/50 italic truncate max-w-[130px]" title={entry.narrative_text || ''}>
                                                        {entry.narrative_text || '—'}
                                                    </td>
                                                    <td className="px-4 py-3 bg-white text-[10px] font-black text-primary whitespace-nowrap">
                                                        {entry.submitted_by_name?.includes('GeoKanban AI') || entry.submitted_by_name?.includes('AI Auto-Pilot') 
                                                            ? '🤖 GeoKanban AI' 
                                                            : (entry.submitted_by_name || '—')}
                                                    </td>
                                                    <td className="px-4 py-3 bg-white text-[10px] font-black text-primary/60 font-mono tracking-tight">
                                                        {entry.document_hash ? entry.document_hash.substring(0, 16).toUpperCase() + '...' : 'PENDING'}
                                                    </td>
                                                    <td className="px-4 py-3 bg-white text-center">
                                                        <div className="flex justify-center items-center gap-2">
                                                            <div className={`${isSubmitted ? 'text-green-500' : 'text-on-surface/20'} transition-transform`} title={isSubmitted ? "Submitted" : "Draft"}>
                                                                <CheckCircle size={18} />
                                                            </div>
                                                            {perms.editActivities && !isSubmitted && (
                                                                <button 
                                                                    onClick={() => setLogbookActivity(a)}
                                                                    disabled={!a.endTime}
                                                                    title={!a.endTime ? "Cannot edit an activity in progress" : ""}
                                                                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all group ${
                                                                        !a.endTime 
                                                                        ? 'bg-surface-low/50 text-on-surface/30 cursor-not-allowed'
                                                                        : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'
                                                                    }`}
                                                                >
                                                                    <Edit3 size={12} className={!a.endTime ? "" : "group-hover:scale-110 transition-transform"} />
                                                                    Edit
                                                                </button>
                                                            )}
                                                            {userProfile?.role === 'operation_admin' && (
                                                                <button 
                                                                    onClick={() => setEditAdminActivity(a)}
                                                                    className="w-8 h-8 rounded-full inline-flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm cursor-pointer"
                                                                    title="Admin Full Edit Override"
                                                                >
                                                                    <Edit3 size={13} className="hover:scale-110 transition-transform" />
                                                                </button>
                                                            )}
                                                            {perms.deleteActivities && (
                                                                <button 
                                                                    onClick={() => handleDeleteActivity(a)}
                                                                    className="w-8 h-8 rounded-full inline-flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all shadow-sm cursor-pointer"
                                                                    title="Delete Activity"
                                                                >
                                                                    <Trash2 size={13} className="hover:scale-110 transition-transform" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    {activityCell}
                                                    {vesselCell}
                                                    <td className="px-4 py-3 bg-white text-[11px] font-bold text-on-surface/40 italic whitespace-nowrap">
                                                        <div className="flex items-center gap-1.5">
                                                            <MapPin size={10} className="opacity-20 flex-shrink-0" />
                                                            {a.geofence || 'Navigation'}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 bg-white text-[10px] font-bold text-on-surface/60 whitespace-nowrap">{formatTime(a.startTime)}</td>
                                                    <td className="px-4 py-3 bg-white text-[10px] font-bold text-on-surface/60 whitespace-nowrap">
                                                        {a.endTime ? formatTime(a.endTime) : <span className="text-primary italic animate-pulse">In Progress...</span>}
                                                    </td>
                                                    <td className="px-4 py-3 bg-white text-[10px] font-extrabold text-sky-700 bg-sky-50/50 whitespace-nowrap text-center">
                                                        {a.aisStartDraught || '—'} / {a.aisEndDraught || '—'}
                                                    </td>
                                                    <td className="px-4 py-3 bg-white text-[9px] font-black text-on-surface/20 uppercase whitespace-nowrap">{calcDuration(a.startTime, a.endTime) || '—'}</td>
                                                    <td className="px-4 py-3 bg-white whitespace-nowrap">
                                                        <div className={`flex flex-col gap-0.5 text-[9px] uppercase ${a.probable_weather_standby ? 'font-extrabold text-red-500' : 'font-black text-on-surface/40'}`}>
                                                            <div className="flex items-center gap-1">
                                                                <Wind size={10} className={a.probable_weather_standby ? 'text-red-500' : 'text-blue-400'} /> {a.weatherWind || '—'}
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <TrendingUp size={10} className={a.probable_weather_standby ? 'text-red-500' : 'text-cyan-400'} /> {a.weatherWave || '—'}
                                                                {a.probable_weather_standby && <AlertTriangle size={10} className="ml-1 animate-pulse text-red-500" title="Possibile Weather Stand-by (Onde > 1m)" />}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 bg-white text-center whitespace-nowrap">
                                                        <div className="flex justify-center items-center gap-2">
                                                            <div className={`${isSubmitted ? 'text-green-500' : 'text-on-surface/20'} transition-transform cursor-pointer`} title={isSubmitted ? "Submitted Entry" : "Draft / Missing"}>
                                                                <CheckCircle size={18} />
                                                            </div>
                                                            {perms.editActivities && !isSubmitted && (
                                                                <button 
                                                                    onClick={() => setLogbookActivity(a)}
                                                                    disabled={!a.endTime}
                                                                    title={!a.endTime ? "Cannot edit an activity in progress" : ""}
                                                                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all group ${
                                                                        !a.endTime 
                                                                        ? 'bg-surface-low/50 text-on-surface/30 cursor-not-allowed'
                                                                        : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'
                                                                    }`}
                                                                >
                                                                    <Edit3 size={12} className={!a.endTime ? "" : "group-hover:scale-110 transition-transform"} />
                                                                    Edit
                                                                </button>
                                                            )}
                                                            {userProfile?.role === 'operation_admin' && (
                                                                <button 
                                                                    onClick={() => setEditAdminActivity(a)}
                                                                    className="w-8 h-8 rounded-full inline-flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm cursor-pointer"
                                                                    title="Admin Full Edit Override"
                                                                >
                                                                    <Edit3 size={13} className="hover:scale-110 transition-transform" />
                                                                </button>
                                                            )}
                                                            {perms.deleteActivities && (
                                                                <button 
                                                                    onClick={() => handleDeleteActivity(a)}
                                                                    className="w-8 h-8 rounded-full inline-flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all shadow-sm cursor-pointer"
                                                                    title="Delete Activity"
                                                                >
                                                                    <Trash2 size={13} className="hover:scale-110 transition-transform" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </>
                                            )}

                                            <td className="px-4 py-3 bg-white rounded-r-xl text-right relative">
                                                <button 
                                                    onClick={() => {
                                                        setIsChatReadOnly(['submitted', 'approved'].includes(a.logbookStatus));
                                                        setChatActivity(a);
                                                    }} 
                                                    onMouseEnter={() => handleMessageHover(a.id)}
                                                    onMouseLeave={() => setHoverData({ id: null, messages: [], loading: false })}
                                                    className={`w-8 h-8 rounded-full inline-flex items-center justify-center transition-all shadow-sm ${
                                                        (a.totalMsgCount > 0)
                                                        ? 'bg-blue-900 text-white hover:bg-blue-800' 
                                                        : 'bg-surface-low text-on-surface/20 hover:bg-secondary hover:text-white'
                                                    }`}
                                                >
                                                    <MessageSquare size={13} />
                                                    {a.unreadMsgCount > 0 && (
                                                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white pointer-events-none" />
                                                    )}
                                                </button>

                                                {/* MESSAGE TOOLTIP (VIGNETTA) */}
                                                {hoverData.id === a.id && !hoverData.loading && hoverData.messages.length > 0 && (
                                                    <div className="absolute bottom-full right-4 mb-2 z-50 w-64 bg-[#002B5B] text-white p-3 rounded-2xl shadow-xl animate-in zoom-in-95 fade-in duration-200 pointer-events-none">
                                                        <div className="space-y-2">
                                                            {hoverData.messages.map((m, idx) => (
                                                                <div key={idx} className="flex items-start gap-2 text-[10px] font-bold leading-tight">
                                                                    <span className="flex-shrink-0 opacity-50 mt-0.5">
                                                                        {m.sender_role === 'crew' ? '📤' : '📥'}
                                                                    </span>
                                                                    <p className="text-left line-clamp-2 italic">{m.message_text}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {/* Triangle pointer */}
                                                        <div className="absolute top-full right-4 -mt-1 w-3 h-3 bg-[#002B5B] rotate-45" />
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {!filtered.length && (
                            <div className="py-12 text-center text-on-surface/40 font-bold text-sm">
                                No activities found in this period.
                            </div>
                        )}
                    </div>

            {logbookActivity && (
                <LogbookEntryModal 
                    activity={logbookActivity} 
                    profile={userProfile}
                    entryMeta={logbookActivity.logbookEntry} // assuming activity has logbookEntry or we just pass empty
                    onClose={() => setLogbookActivity(null)} 
                    onSaved={() => fetchActivities(userProfile?.role === 'crew' ? crewVesselId : null, userProfile?.role)}
                />
            )}
            {editAdminActivity && (
                <EditActivityModal
                    activityToEdit={editAdminActivity}
                    onClose={() => setEditAdminActivity(null)}
                    onSaved={() => fetchActivities(userProfile?.role === 'crew' ? crewVesselId : null, userProfile?.role)}
                />
            )}
            {chatActivity && (
                <ActivityChatModal 
                    activity={chatActivity} 
                    profile={userProfile} 
                    readOnly={isChatReadOnly}
                    onClose={() => { 
                        setChatActivity(null); 
                        fetchActivities(userProfile?.role === 'crew' ? crewVesselId : null, userProfile?.role); 
                    }} 
                />
            )}
            {showManualModal && (
                <ManualActivityModal
                    onClose={() => setShowManualModal(false)}
                    onSaved={() => {
                        let targetId = null;
                        if (userProfile?.role === 'crew') targetId = crewVesselId;
                        else if (userProfile?.role === 'crew_admin') targetId = companyVesselIds;
                        fetchActivities(targetId, userProfile?.role);
                        setShowManualModal(false);
                    }}
                />
            )}
        </div>
    );
}

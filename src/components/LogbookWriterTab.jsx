import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useFleet, useOperations, useConfig } from '../context/DataContext';
import { supabase } from '../lib/supabase';
import {
    Ship, Clock, Check, RefreshCw,
    Edit3, ShieldCheck, Lock, AlertCircle, Download, PenLine, MessageSquare,
    Plus, AlertTriangle, BookOpen
} from 'lucide-react';
import '../logbook-writer.css';
import LogbookEntryModal from './LogbookEntryModal';
import ActivityChatModal from './ActivityChatModal';
import ManualActivityModal from './ManualActivityModal';
import { can } from '../lib/permissions';
import { fmt } from '../utils/timeFormatters';


const PILOT_ID = 'fb7e1193-eb4c-4dbf-a74c-330cc7a10a1e';
const MOORING_ID = '0accb070-55ec-4f33-9e70-43701950872d';
const TUG_ID = 'd9a81b19-98a7-46be-bd10-07777b36eb1f';



export default function LogbookWriterTab() {
    const { vesselPositions, crewVesselId, companyVesselIds } = useFleet();
    const { activities, loading, fetchActivities } = useOperations();
    const { profile } = useConfig();

    const perms = can(profile?.role);

    const [edits, setEdits] = useState({});
    const [savingId, setSavingId] = useState(null);
    const [servicesMap, setServicesMap] = useState({});
    const [editActivity, setEditActivity] = useState(null);
    const [chatActivity, setChatActivity] = useState(null);
    const [showManualModal, setShowManualModal] = useState(false);

    const handleExportLogbook = () => {
        if (!filtered.length) return;

        // 1. Calculate Protocol: [Progressive] / [Last AIS Update]
        const lastAISUpdate = (vesselPositions || []).reduce((latest, pos) => {
            if (!pos.lastUpdate) return latest;
            const d = new Date(pos.lastUpdate);
            return d > latest ? d : latest;
        }, new Date(0));

        const formattedAISDate = lastAISUpdate.getTime() > 0
            ? lastAISUpdate.toLocaleString('en-GB')
            : '—';

        const exportCount = Number(localStorage.getItem('gk_logbook_export_count') || 0) + 1;
        localStorage.setItem('gk_logbook_export_count', exportCount);

        const protocol = `${String(exportCount).padStart(3, '0')} / ${formattedAISDate}`;

        // 2. Prepare Data (AOA style for XLSX)
        const rows = filtered.map(a => {
            const meta = servicesMap[a.id];
            const p = meta?.services?.find(s => s.service_id === PILOT_ID);
            const m = meta?.services?.find(s => s.service_id === MOORING_ID);
            const t = meta?.services?.find(s => s.service_id === TUG_ID);

            return [
                meta?.status || 'draft',
                a.vessel,
                a.activity,
                a.geofence,
                a.startTime ? new Date(a.startTime).toLocaleString('en-GB') : '',
                a.endTime ? new Date(a.endTime).toLocaleString('en-GB') : '',
                a.aisStartDraught || '—',
                a.aisEndDraught || '—',
                p?.start_time ? new Date(p.start_time).toLocaleString('en-GB') : '',
                p?.end_time ? new Date(p.end_time).toLocaleString('en-GB') : '',
                m?.start_time ? new Date(m.start_time).toLocaleString('en-GB') : '',
                m?.end_time ? new Date(m.end_time).toLocaleString('en-GB') : '',
                t?.start_time ? new Date(t.start_time).toLocaleString('en-GB') : '',
                t?.end_time ? new Date(t.end_time).toLocaleString('en-GB') : '',
            ];
        });

        const aoaData = [
            ['PROTOCOL:', protocol],
            [], // spacer
            ['Status', 'Ship', 'Activity', 'Geofence', 'ATA', 'ATD', 'AIS Draft In', 'AIS Draft Out', 'Pilot In', 'Pilot Out', 'Mooring In', 'Mooring Out', 'Tug In', 'Tug Out'],
            ...rows
        ];

        // 3. Create Workbook
        const ws = XLSX.utils.aoa_to_sheet(aoaData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Logbook Registry");

        // Styling: Auto-width columns
        const wscols = [
            { wch: 12 }, { wch: 18 }, { wch: 15 }, { wch: 22 }, { wch: 18 }, { wch: 18 },
            { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }
        ];
        ws['!cols'] = wscols;

        XLSX.writeFile(wb, `GeoKanban_Logbook_Registry_${exportCount}.xlsx`);
    };


    // Fetch services and entry status for all visible activities
    useEffect(() => {
        if (!activities?.length) return;

        const fetchAllServices = async () => {
            const ids = activities.map(a => a.id);
            const { data, error } = await supabase
                .from('logbook_entries')
                .select('id, vessel_activity_id, status, narrative_text, structured_fields, document_hash, message_snapshot, logbook_services(*)')
                .in('vessel_activity_id', ids);

            if (error) {
                console.error('Failed to fetch logbook services:', error);
                return;
            }

            const map = {};
            data.forEach(entry => {
                map[entry.vessel_activity_id] = {
                    entryId: entry.id,
                    status: entry.status,
                    services: entry.logbook_services,
                    structured_fields: entry.structured_fields || {},
                    narrative_text: entry.narrative_text || '',
                    document_hash: entry.document_hash || null,
                    message_snapshot: entry.message_snapshot || [],
                };
            });
            setServicesMap(map);
        };

        fetchAllServices();
    }, [activities]);

    const filtered = useMemo(() => {
        if (loading) return [];
        let base = activities || [];

        let result = [];
        // 1. Filter
        if (perms.approveLogbook) {
            // Operations: Only see submitted or approved logbooks
            result = base.filter(a => {
                const meta = servicesMap[a.id];
                return meta?.status === 'submitted' || meta?.status === 'approved';
            });
        } else {
            // Crew / Crew Admin: see all statuses, but filtered by vessel/fleet
            if (perms.seeCompanyVessels && companyVesselIds && !perms.seeAllVessels) {
                result = base.filter(a => companyVesselIds.includes(a.vesselId));
            } else if (perms.seeOwnVesselOnly && crewVesselId) {
                result = base.filter(a => a.vesselId === crewVesselId);
            } else {
                result = base;
            }
        }

        // 2. Sort: Submitted/Approved at the TOP, then by time DESC
        return [...result].sort((a, b) => {
            const metaA = servicesMap[a.id];
            const metaB = servicesMap[b.id];
            const isSubA = metaA?.status === 'submitted' || metaA?.status === 'approved';
            const isSubB = metaB?.status === 'submitted' || metaB?.status === 'approved';

            if (isSubA && !isSubB) return -1;
            if (!isSubA && isSubB) return 1;

            // Secondary sort: Date descending (newest first)
            const dateA = new Date(a.startTime || 0);
            const dateB = new Date(b.startTime || 0);
            return dateB - dateA;
        });
    }, [activities, perms, crewVesselId, companyVesselIds, servicesMap, loading]);

    const handleRowClick = async (activity) => {
        const existingEntry = servicesMap[activity.id];

        // If Operations and row is unread, mark it as read
        if (perms.approveLogbook && existingEntry?.entryId && !existingEntry?.structured_fields?.admin_reviewed) {
            const updatedFields = { ...existingEntry.structured_fields, admin_reviewed: true };
            supabase
                .from('logbook_entries')
                .update({ structured_fields: updatedFields })
                .eq('id', existingEntry.entryId)
                .then(); // Fire and forget

            // Update local state so it turns color immediately
            setServicesMap(prev => ({
                ...prev,
                [activity.id]: {
                    ...prev[activity.id],
                    structured_fields: updatedFields
                }
            }));
        }

        setEditActivity(activity);
    };

    return (
        <div className="tab-content logbook-writer">
            <div className="filter-bar">
                <div className="filter-group">
                    <Edit3 size={15} />
                    <span className="filter-label">
                        {perms.approveLogbook || perms.isCrewAdmin ? 'Activity Submission Registry (Fleet Monitor)' : 'Formal Activity Submission — Command Responsibility'}
                    </span>
                </div>
                <div className="filter-group" style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                    {(perms.submitLogbook || perms.approveLogbook) && (
                        <button
                            className="btn-certify"
                            onClick={() => setShowManualModal(true)}
                            title="Add Manual Activity"
                            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', border: 'none' }}
                        >
                            <Plus size={14} /> Add Activity
                        </button>
                    )}
                    {(perms.approveLogbook || perms.isCrewAdmin) && (
                        <button
                            className="btn-certify"
                            onClick={handleExportLogbook}
                            title="Export Registry with Protocol"
                        >
                            <Download size={14} /> Export Registry
                        </button>
                    )}
                    <button onClick={fetchActivities} className="btn-icon">
                        <RefreshCw size={15} className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {/* 1. DESKTOP VIEW (Classic Table Layout) */}
            <div className="hidden md:block table-container writer-mode">
                <table className="activity-table writer-table">
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'center' }}>Action</th>
                            <th className="cell-main-info">Ship & Activity</th>
                            <th>ATA (Arrived)</th>
                            <th>ATD (Departed)</th>
                            <th>Cargo (t)</th>
                            <th>AIS Draft (In/Out)</th>
                            <th>Bunker (t)</th>
                            <th>Tugs (In/Out)</th>
                            <th>Notes</th>
                            <th style={{ textAlign: 'center' }}>Msg</th>
                            {(perms.approveLogbook || perms.isCrewAdmin) && <th className="hash-col">Hash (SHA-256)</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={(perms.approveLogbook || perms.isCrewAdmin) ? 10 : 9} className="empty-state">
                                {(perms.approveLogbook || perms.isCrewAdmin) ? 'No submitted activities at the moment.' : 'No activities to report for your vessel.'}
                            </td></tr>
                        ) : (
                            filtered.map((a) => {
                                const entryMeta = servicesMap[a.id];
                                const isSubmitted = entryMeta?.status === 'submitted' || entryMeta?.status === 'approved';
                                const isManual = a.source === 'manual';

                                const rowClass = perms.approveLogbook && isSubmitted && !entryMeta?.structured_fields?.admin_reviewed
                                    ? 'row-admin-unread' : (isSubmitted ? 'row-locked' : '');

                                return (
                                    <tr key={a.id} className={`${rowClass} ${isManual ? 'bg-amber-500/[0.02]' : ''}`}>
                                        <td className="actions-cell" style={{ textAlign: 'center', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
                                            {isSubmitted ? (
                                                <div
                                                    className="status-certified"
                                                    style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                                                    title="View Certified Logbook"
                                                    onClick={() => handleRowClick(a)}
                                                >
                                                    <Lock size={14} /> <span>CERTIFIED</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <div
                                                        className="status-certified"
                                                        style={{ background: '#f8fafc', color: '#64748b', borderColor: '#cbd5e1', cursor: 'default' }}
                                                        title="Logbook needs to be filled"
                                                    >
                                                        <PenLine size={14} /> <span>TO SUBMIT</span>
                                                    </div>
                                                    {perms.submitLogbook ? (
                                                        <button
                                                            className="btn-edit-row"
                                                            onClick={() => handleRowClick(a)}
                                                            title="Edit Formal Entry"
                                                            style={{
                                                                display: 'flex', alignItems: 'center', gap: '4px',
                                                                color: '#6366f1', background: 'white',
                                                                border: '1px solid #c7d2fe', padding: '5px 10px',
                                                                borderRadius: '6px', fontSize: '12px', fontWeight: 'bold',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            <Edit3 size={14} /> Edit
                                                        </button>
                                                    ) : (
                                                        <button
                                                            className="btn-edit-row"
                                                            onClick={() => handleRowClick(a)}
                                                            title="View Draft"
                                                            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
                                                        >
                                                            <BookOpen size={14} /> View
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </td>
                                        <td className="cell-main-info">
                                            <div className="v-label flex items-center gap-1.5">
                                                <Ship size={14} /> {a.vessel}
                                                {isManual && (
                                                    <span className="bg-amber-500 text-white text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-0.5" title="Manually Entered Activity">
                                                        <AlertTriangle size={8} /> MANUAL
                                                    </span>
                                                )}
                                            </div>
                                            <div className="a-label">
                                                <span className="badge-mini">{a.activity}</span> @ {a.geofence}
                                            </div>
                                        </td>
                                        <td>{a.startTime ? fmt(a.startTime).replace('T', ' ') : '—'}</td>
                                        <td>{a.endTime ? fmt(a.endTime).replace('T', ' ') : '—'}</td>
                                        <td style={{ fontWeight: 'bold' }}>{entryMeta?.structured_fields?.actual_cargo_tonnes || '—'}</td>
                                        <td style={{ fontSize: '11px', color: '#0369a1', fontWeight: 'bold', background: 'rgba(2, 132, 199, 0.05)', textAlign: 'center', borderRadius: '4px' }}>
                                            {a.aisStartDraught || '—'} / {a.aisEndDraught || '—'}
                                        </td>
                                        <td style={{ fontWeight: 'bold' }}>{entryMeta?.structured_fields?.actual_bunker_tonnes || '—'}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            {entryMeta?.structured_fields?.arrival_tug_count || 0} / {entryMeta?.structured_fields?.departure_tug_count || 0}
                                        </td>
                                        <td style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '11px', color: '#64748b' }} title={entryMeta?.narrative_text}>
                                            {entryMeta?.narrative_text || '—'}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button
                                                className="btn-chat-bubble"
                                                onClick={(e) => { e.stopPropagation(); setChatActivity(a); }}
                                                title="Open Communications"
                                                style={{ margin: '0 auto', opacity: isSubmitted ? 0.7 : 1 }}
                                            >
                                                <MessageSquare size={14} />
                                                {a.msgCount > 0 && <span className="msg-badge">{a.msgCount}</span>}
                                            </button>
                                        </td>
                                        {/* Admin Hash column */}
                                        {(perms.approveLogbook || perms.isCrewAdmin) && (
                                            <td className="hash-cell">
                                                {entryMeta?.document_hash ? (
                                                    <span className="hash-display" title={entryMeta.document_hash}>
                                                        {entryMeta.document_hash.substring(0, 8)}…
                                                    </span>
                                                ) : '—'}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* 2. MOBILE VIEW (Adaptive Glassmorphic Cards Layout) */}
            <div className="block md:hidden space-y-4">
                {filtered.length === 0 ? (
                    <div className="bg-white/80 backdrop-blur-md border border-surface-low/30 rounded-[1.5rem] p-8 text-center text-xs font-bold text-on-surface/40 uppercase tracking-wider">
                        {(perms.approveLogbook || perms.isCrewAdmin) ? 'No submitted activities at the moment.' : 'No activities to report for your vessel.'}
                    </div>
                ) : (
                    filtered.map((a) => {
                        const entryMeta = servicesMap[a.id];
                        const isSubmitted = entryMeta?.status === 'submitted' || entryMeta?.status === 'approved';
                        const isManual = a.source === 'manual';

                        return (
                            <div 
                                key={a.id} 
                                className={`bg-white/70 backdrop-blur-md p-5 rounded-[1.5rem] border ${isSubmitted ? 'border-emerald-500/20 shadow-emerald-500/5' : 'border-slate-200/60'} shadow-sm flex flex-col gap-4 relative overflow-hidden transition-all hover:shadow-md`}
                            >
                                {isManual && (
                                    <div className="absolute top-0 right-0 bg-amber-500 text-white text-[8px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-xl flex items-center gap-1 shadow-sm">
                                        <AlertTriangle size={8} />
                                        <span>Manual Entry</span>
                                    </div>
                                )}

                                {/* Top Row: Vessel & Activity Name */}
                                <div className="flex items-start justify-between">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-black text-on-surface/30 uppercase tracking-wider flex items-center gap-1">
                                            <Ship size={10} /> {a.vessel}
                                        </span>
                                        <span className="text-sm font-manrope font-black text-on-surface uppercase tracking-tight">
                                            {a.activity} <span className="text-on-surface/50 text-[10px] font-bold">@ {a.geofence}</span>
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        {isSubmitted ? (
                                            <span className="bg-emerald-500/10 text-emerald-600 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
                                                <Lock size={10} /> Certified
                                            </span>
                                        ) : (
                                            <span className="bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-slate-200 flex items-center gap-1">
                                                <PenLine size={10} /> Draft
                                            </span>
                                        )}

                                        <button
                                            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 relative active:scale-95 transition-transform"
                                            onClick={(e) => { e.stopPropagation(); setChatActivity(a); }}
                                        >
                                            <MessageSquare size={13} />
                                            {a.msgCount > 0 && <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white">{a.msgCount}</span>}
                                        </button>
                                    </div>
                                </div>

                                {/* Middle: Details Grid */}
                                <div className="grid grid-cols-2 gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 text-[11px] font-bold">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">ATA (Arrived)</span>
                                        <span className="text-slate-700">{a.startTime ? fmt(a.startTime).replace('T', ' ') : '—'}</span>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">ATD (Departed)</span>
                                        <span className="text-slate-700">{a.endTime ? fmt(a.endTime).replace('T', ' ') : '—'}</span>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Cargo / Bunker</span>
                                        <span className="text-slate-800 font-extrabold">
                                            {entryMeta?.structured_fields?.actual_cargo_tonnes || 0}t / {entryMeta?.structured_fields?.actual_bunker_tonnes || 0}t
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Tugboats (In/Out)</span>
                                        <span className="text-slate-800">
                                            {entryMeta?.structured_fields?.arrival_tug_count || 0} / {entryMeta?.structured_fields?.departure_tug_count || 0}
                                        </span>
                                    </div>
                                </div>

                                {/* Bottom Button */}
                                {isSubmitted ? (
                                    <button
                                        onClick={() => handleRowClick(a)}
                                        className="w-full bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 font-black text-[10px] uppercase tracking-widest py-3 rounded-xl transition-all border border-emerald-500/10 flex items-center justify-center gap-1.5"
                                    >
                                        <ShieldCheck size={14} /> View Certified Log
                                    </button>
                                ) : (
                                    perms.submitLogbook ? (
                                        <button
                                            onClick={() => handleRowClick(a)}
                                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest py-3 rounded-xl transition-all shadow-md shadow-indigo-600/15 flex items-center justify-center gap-1.5"
                                        >
                                            <Edit3 size={14} /> Edit & Submit Draft
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleRowClick(a)}
                                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest py-3 rounded-xl transition-all flex items-center justify-center gap-1.5"
                                        >
                                            <BookOpen size={14} /> View Draft
                                        </button>
                                    )
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Logbook Entry Modal */}
            {editActivity && (
                <LogbookEntryModal
                    activity={editActivity}
                    profile={profile}
                    entryMeta={servicesMap[editActivity.id]}
                    onClose={() => setEditActivity(null)}
                    onSaved={() => {
                        fetchActivities();
                        setEditActivity(null);
                    }}
                />
            )}

            {/* Manual Activity Creator Modal */}
            {showManualModal && (
                <ManualActivityModal
                    onClose={() => setShowManualModal(false)}
                    onSaved={() => {
                        fetchActivities();
                        setShowManualModal(false);
                    }}
                />
            )}

            {chatActivity && (
                <ActivityChatModal
                    activity={chatActivity}
                    onClose={() => setChatActivity(null)}
                />
            )}
        </div>
    );
}



import React, { useState, useMemo, useEffect } from 'react';
import { X, Ship, Clock, MapPin, Activity, Check, AlertCircle } from 'lucide-react';
import { useFleet, useConfig } from '../context/DataContext';
import { activityService } from '../services/api/activityService';
import { formatTime } from '../utils/timeFormatters';
import { HOURS, MINUTES } from '../constants/timeConstants';

const ACTIVITY_TYPES = [
    'Loading', 'Unloading', 'Navigation', 'Stand-by', 'Port Operations', 'Mooring'
];

export default function EditActivityModal({ activityToEdit, onClose, onSaved }) {
    const { vessels, geofences } = useFleet();
    const { profile } = useConfig();

    // Must be operation_admin
    const isOperationAdmin = profile?.role === 'operation_admin';

    const getLocalParts = (dStr) => {
        if (!dStr) return { date: '', hour: '00', minute: '00' };
        const d = new Date(dStr);
        if (isNaN(d.getTime())) return { date: '', hour: '00', minute: '00' };
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return {
            date: `${yyyy}-${mm}-${dd}`,
            hour: hh,
            minute: min
        };
    };

    const [vesselId, setVesselId] = useState('');
    const [activityType, setActivityType] = useState('Loading');
    const [geofenceId, setGeofenceId] = useState('');
    const [geofenceFromId, setGeofenceFromId] = useState('');
    const [geofenceToId, setGeofenceToId] = useState('');

    const [ataDate, setAtaDate] = useState('');
    const [ataHour, setAtaHour] = useState('00');
    const [ataMinute, setAtaMinute] = useState('00');

    const [atdDate, setAtdDate] = useState('');
    const [atdHour, setAtdHour] = useState('00');
    const [atdMinute, setAtdMinute] = useState('00');
    const [hasAtd, setHasAtd] = useState(false);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Initialize state from activityToEdit
    useEffect(() => {
        if (activityToEdit) {
            setVesselId(activityToEdit.vessel_id || activityToEdit.vesselId || '');
            setActivityType(activityToEdit.activity_type || activityToEdit.activity || 'Loading');
            setGeofenceId(activityToEdit.geofence_id || activityToEdit.geofenceId || '');
            setGeofenceFromId(activityToEdit.geofence_from_id || activityToEdit.geofenceFromId || '');
            setGeofenceToId(activityToEdit.geofence_to_id || activityToEdit.geofenceToId || '');

            const startParts = getLocalParts(activityToEdit.start_time || activityToEdit.startTime);
            setAtaDate(startParts.date);
            setAtaHour(startParts.hour);
            setAtaMinute(startParts.minute);

            const endStr = activityToEdit.end_time || activityToEdit.endTime;
            if (endStr) {
                setHasAtd(true);
                const endParts = getLocalParts(endStr);
                setAtdDate(endParts.date);
                setAtdHour(endParts.hour);
                setAtdMinute(endParts.minute);
            } else {
                setHasAtd(false);
                const endParts = getLocalParts(); // now
                setAtdDate(endParts.date);
                setAtdHour(endParts.hour);
                setAtdMinute(endParts.minute);
            }
        }
    }, [activityToEdit]);

    // Build ISO timestamps
    const startTimeISO = useMemo(() => {
        if (!ataDate || !ataHour || !ataMinute) return null;
        try {
            const dateObj = new Date(`${ataDate}T${ataHour}:${ataMinute}:00`);
            return isNaN(dateObj.getTime()) ? null : dateObj.toISOString();
        } catch (e) {
            return null;
        }
    }, [ataDate, ataHour, ataMinute]);

    const endTimeISO = useMemo(() => {
        if (!hasAtd || !atdDate || !atdHour || !atdMinute) return null;
        try {
            const dateObj = new Date(`${atdDate}T${atdHour}:${atdMinute}:00`);
            return isNaN(dateObj.getTime()) ? null : dateObj.toISOString();
        } catch (e) {
            return null;
        }
    }, [hasAtd, atdDate, atdHour, atdMinute]);

    // Calculate real-time duration
    const durationText = useMemo(() => {
        if (!startTimeISO) return '—';
        if (!hasAtd) return 'In Progress (Active)';
        if (!endTimeISO) return '—';
        const start = new Date(startTimeISO);
        const end = new Date(endTimeISO);
        const diffMs = end - start;
        if (diffMs < 0) return 'Invalid Range';
        const diffMins = Math.floor(diffMs / 60000);
        const hrs = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return `${hrs}h ${mins}m`;
    }, [startTimeISO, endTimeISO, hasAtd]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isOperationAdmin) return setError('Permission denied.');
        if (!vesselId) return setError('Please select a vessel.');
        if (!activityType) return setError('Please select an activity.');

        if (activityType === 'Navigation') {
            if (!geofenceFromId) return setError('Please select departure geofence (Geofence From).');
            if (!geofenceToId) return setError('Please select arrival geofence (Geofence To).');
        } else {
            if (!geofenceId) return setError('Please select the location / geofence hub.');
        }

        if (!startTimeISO) return setError('Please select a valid arrival time (ATA).');
        if (hasAtd && !endTimeISO) return setError('Please select a valid departure time (ATD).');

        if (hasAtd && startTimeISO && endTimeISO && new Date(startTimeISO) >= new Date(endTimeISO)) {
            return setError('Arrival time (ATA) must be before Departure time (ATD).');
        }

        setSubmitting(true);
        setError(null);

        try {
            const updates = {
                vessel_id: vesselId,
                activity_type: activityType,
                geofence_id: activityType === 'Navigation' ? null : (geofenceId || null),
                geofence_from_id: activityType === 'Navigation' ? (geofenceFromId || null) : (geofenceId || null),
                geofence_to_id: activityType === 'Navigation' ? (geofenceToId || null) : (geofenceId || null),
                start_time: startTimeISO,
                end_time: hasAtd ? endTimeISO : null,
                status: hasAtd ? 'completed' : 'active'
            };

            await activityService.updateActivity(activityToEdit.id, updates);

            onSaved();
            onClose();
        } catch (err) {
            console.error('Error editing activity:', err);
            setError(err.message || 'An error occurred while editing the activity.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOperationAdmin) return null;

    return (
        <div className="lem-overlay animate-in fade-in duration-200" onClick={onClose}>
            <div className="lem-modal max-w-md w-full glassmorphic rounded-[1.5rem] border border-white/20 shadow-2xl p-4 md:p-5 animate-in zoom-in-95 duration-200" style={{ maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-surface-low/10 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
                            <Activity size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-manrope font-black text-on-surface uppercase tracking-tight">Edit Activity</h2>
                            <p className="text-[10px] text-on-surface/40 uppercase tracking-widest font-black">Admin Override</p>
                        </div>
                    </div>
                    <button className="w-8 h-8 rounded-full bg-surface-low/10 flex items-center justify-center text-on-surface/40 hover:text-on-surface hover:bg-surface-low/20 transition-all" onClick={onClose}>
                        <X size={16} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-3">
                    {error && (
                        <div className="flex items-center gap-2 bg-red-50 text-red-600 p-3 rounded-xl text-xs font-semibold border border-red-100 animate-in shake duration-300">
                            <AlertCircle size={14} className="flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Vessel Dropdown */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase text-on-surface/40 tracking-wider flex items-center gap-1">
                            <Ship size={12} /> Vessel / Ship Name
                        </label>
                        <select 
                            value={vesselId} 
                            onChange={e => setVesselId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 outline-none focus:border-blue-500 transition-all cursor-pointer" style={{ color: '#64748b' }}
                            required
                        >
                            <option value="">Select vessel</option>
                            {(vessels || []).map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Activity Type Dropdown */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase text-on-surface/40 tracking-wider flex items-center gap-1">
                            <Activity size={12} /> Activity Type
                        </label>
                        <select 
                            value={activityType} 
                            onChange={e => setActivityType(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 outline-none focus:border-blue-500 transition-all cursor-pointer" style={{ color: '#64748b' }}
                            required
                        >
                            {ACTIVITY_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>

                    {/* Geofence Selector(s) */}
                    {activityType === 'Navigation' ? (
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black uppercase text-on-surface/40 tracking-wider flex items-center gap-1">
                                    <MapPin size={12} /> Geofence From
                                </label>
                                <select 
                                    value={geofenceFromId} 
                                    onChange={e => setGeofenceFromId(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 outline-none focus:border-blue-500 transition-all cursor-pointer" style={{ color: '#64748b' }}
                                    required
                                >
                                    <option value="">Select departure</option>
                                    {(geofences || []).map(g => (
                                        <option key={g.id} value={g.id}>{g.name} ({g.nature})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black uppercase text-on-surface/40 tracking-wider flex items-center gap-1">
                                    <MapPin size={12} /> Geofence To
                                </label>
                                <select 
                                    value={geofenceToId} 
                                    onChange={e => setGeofenceToId(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 outline-none focus:border-blue-500 transition-all cursor-pointer" style={{ color: '#64748b' }}
                                    required
                                >
                                    <option value="">Select arrival</option>
                                    {(geofences || []).map(g => (
                                        <option key={g.id} value={g.id}>{g.name} ({g.nature})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase text-on-surface/40 tracking-wider flex items-center gap-1">
                                <MapPin size={12} /> Location / Geofence Hub
                            </label>
                            <select 
                                value={geofenceId} 
                                onChange={e => setGeofenceId(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 outline-none focus:border-blue-500 transition-all cursor-pointer" style={{ color: '#64748b' }}
                                required
                            >
                                <option value="">Select geofence</option>
                                {(geofences || []).map(g => (
                                    <option key={g.id} value={g.id}>{g.name} ({g.nature})</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Arrival ATA */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase text-on-surface/40 tracking-wider flex items-center gap-1">
                            <Clock size={12} /> Start Time (ATA)
                        </label>
                        <div className="grid grid-cols-12 gap-2">
                            <div className="col-span-6">
                                <input 
                                    type="date" 
                                    value={ataDate} 
                                    onChange={e => setAtaDate(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 outline-none focus:border-blue-500 transition-all cursor-pointer" style={{ color: '#64748b' }}
                                    required
                                />
                            </div>
                            <div className="col-span-3">
                                <select 
                                    value={ataHour} 
                                    onChange={e => setAtaHour(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 outline-none focus:border-blue-500 transition-all cursor-pointer" style={{ color: '#64748b' }}
                                    required
                                >
                                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>
                            <div className="col-span-3">
                                <select 
                                    value={ataMinute} 
                                    onChange={e => setAtaMinute(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 outline-none focus:border-blue-500 transition-all cursor-pointer" style={{ color: '#64748b' }}
                                    required
                                >
                                    {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Activity Status Toggle */}
                    <div className="flex items-center justify-between bg-slate-100 border border-slate-200 p-3 rounded-xl mt-4 mb-2 shadow-sm">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-2">
                            <Activity size={14} className="text-blue-500" /> Activity Status
                        </span>
                        <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={!hasAtd} 
                                onChange={e => setHasAtd(!e.target.checked)} 
                                className="w-4 h-4 text-blue-500 rounded border-slate-300 focus:ring-blue-500 cursor-pointer" 
                            />
                            <span className={`text-[11px] font-black uppercase tracking-wide ${!hasAtd ? 'text-blue-600' : 'text-slate-400'}`}>
                                SET TO "IN PROGRESS"
                            </span>
                        </label>
                    </div>

                    {/* Departure ATD Fields */}
                    {hasAtd && (
                        <div className="flex flex-col gap-1 mt-2">
                            <label className="text-[10px] font-black uppercase text-on-surface/40 tracking-wider flex items-center gap-1">
                                <Clock size={12} /> End Time (ATD)
                            </label>
                            <div className="grid grid-cols-12 gap-2">
                                <div className="col-span-6">
                                    <input 
                                        type="date" 
                                        value={atdDate} 
                                        onChange={e => setAtdDate(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 outline-none focus:border-blue-500 transition-all cursor-pointer" style={{ color: '#64748b' }}
                                        required
                                    />
                                </div>
                                <div className="col-span-3">
                                    <select 
                                        value={atdHour} 
                                        onChange={e => setAtdHour(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 outline-none focus:border-blue-500 transition-all cursor-pointer" style={{ color: '#64748b' }}
                                        required
                                    >
                                        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-3">
                                    <select 
                                        value={atdMinute} 
                                        onChange={e => setAtdMinute(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 outline-none focus:border-blue-500 transition-all cursor-pointer" style={{ color: '#64748b' }}
                                        required
                                    >
                                        {MINUTES.map(m => <option key={m} value={m}>{m}</option>
                                        )}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Metadata Preview */}
                    {vesselId && startTimeISO && (
                        <div className="grid grid-cols-1 gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-200/60 text-[11px] font-bold animate-in fade-in duration-300">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] uppercase font-black text-on-surface/40 tracking-wider">Duration</span>
                                <span className={`font-extrabold text-[12px] leading-tight ${durationText.includes('Invalid') ? 'text-red-500' : 'text-slate-700'}`}>
                                    {durationText}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Submit / Cancel Buttons */}
                    <div className="flex items-center gap-3 pt-3 border-t border-surface-low/10 mt-4">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="flex-1 bg-slate-100 hover:bg-slate-200 text-on-surface/60 font-black text-[10px] uppercase tracking-widest py-2.5 rounded-xl transition-all"
                            disabled={submitting}
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/20"
                            disabled={submitting || durationText.includes('Invalid')}
                        >
                            {submitting ? 'Saving...' : (
                                <>
                                    <Check size={14} /> Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

import React, { useState, useMemo } from 'react';
import { X, Ship, Clock, MapPin, Activity, Check, AlertCircle, AlertTriangle } from 'lucide-react';
import { useFleet, useOperations, useConfig } from '../context/DataContext';
import { activityService } from '../services/api/activityService';
import { formatTime } from '../utils/timeFormatters';
import { HOURS, MINUTES } from '../constants/timeConstants';

const ACTIVITY_TYPES = [
    'Loading', 'Unloading', 'Navigation', 'Stand-by', 'Port Operations', 'Mooring'
];

export default function ManualActivityModal({ onClose, onSaved }) {
    const { vessels, geofences, crewVesselId, companyVesselIds } = useFleet();
    const { activities, selectedMonth, selectedYear } = useOperations();
    const { profile } = useConfig();

    // 1. Scope allowed vessels strictly based on tenant rules (SOLID)
    const allowedVessels = useMemo(() => {
        if (!vessels || !profile) return [];
        if (profile.role === 'crew' && crewVesselId) {
            return vessels.filter(v => v.id === crewVesselId);
        }
        if (profile.role === 'crew_admin' && companyVesselIds) {
            return vessels.filter(v => companyVesselIds.includes(v.id));
        }
        return vessels; // operations / operation_admin
    }, [vessels, profile, crewVesselId, companyVesselIds]);

    const getLocalParts = (d = new Date()) => {
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

    const initialParts = useMemo(() => getLocalParts(), []);

    const [vesselId, setVesselId] = useState('');
    const [activityType, setActivityType] = useState('Loading');
    const [geofenceId, setGeofenceId] = useState('');
    const [geofenceFromId, setGeofenceFromId] = useState('');
    const [geofenceToId, setGeofenceToId] = useState('');

    const [ataDate, setAtaDate] = useState(initialParts.date);
    const [ataHour, setAtaHour] = useState(initialParts.hour);
    const [ataMinute, setAtaMinute] = useState(initialParts.minute);

    const [atdDate, setAtdDate] = useState(initialParts.date);
    const [atdHour, setAtdHour] = useState(initialParts.hour);
    const [atdMinute, setAtdMinute] = useState(initialParts.minute);
    const [hasAtd, setHasAtd] = useState(true);

    const [submitting, setSubmitting] = useState(false);
    const [splitExisting, setSplitExisting] = useState(true);
    const [error, setError] = useState(null);

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

    const overlappingActivity = useMemo(() => {
        if (!vesselId || !startTimeISO) return null;
        const newStart = new Date(startTimeISO);
        const newEnd = hasAtd && endTimeISO ? new Date(endTimeISO) : null;

        const baseActivities = activities || [];
        const vesselActs = baseActivities.filter(a => a.vesselId === vesselId);

        for (const act of vesselActs) {
            const actStart = new Date(act.startTime);
            const actEnd = act.endTime ? new Date(act.endTime) : null;

            const overlapStart = actStart;
            const overlapEnd = actEnd || new Date('9999-12-31T23:59:59Z');
            
            const rangeStart = newStart;
            const rangeEnd = newEnd || new Date('9999-12-31T23:59:59Z');

            if (overlapStart < rangeEnd && overlapEnd > rangeStart) {
                return act;
            }
        }
        return null;
    }, [vesselId, startTimeISO, endTimeISO, hasAtd, activities]);

    // Predict row number in table list
    const targetRowNumber = useMemo(() => {
        if (!vesselId || !startTimeISO) return { global: null, vesselSpecific: null };
        try {
            const baseActivities = activities || [];
            const newStart = new Date(startTimeISO);
            const targetMonth = newStart.getMonth();
            const targetYear = newStart.getFullYear();

            // Filter overall activities for that month/year (matching user scope)
            const monthlyActs = baseActivities.filter(a => {
                let isVisible = true;
                if (profile.role === 'crew' && crewVesselId) isVisible = a.vesselId === crewVesselId;
                if (profile.role === 'crew_admin' && companyVesselIds) isVisible = companyVesselIds.includes(a.vesselId);
                if (!isVisible) return false;

                const d = new Date(a.startTime);
                return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
            });

            // Selected vessel name
            const selectedVesselObj = allowedVessels.find(v => v.id === vesselId);
            const selectedVesselName = selectedVesselObj ? selectedVesselObj.name : '';

            // Create dummy activity to simulate position
            const dummyActivity = {
                id: 'dummy-temp',
                vesselId: vesselId,
                vessel: selectedVesselName,
                startTime: startTimeISO,
            };

            // Case A: Overall in month
            const listWithNewGlobal = [...monthlyActs, dummyActivity];
            listWithNewGlobal.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
            const globalIndex = listWithNewGlobal.findIndex(a => a.id === 'dummy-temp') + 1;

            // Case B: Specific vessel in month
            const vesselActs = monthlyActs.filter(a => a.vesselId === vesselId);
            const listWithNewVessel = [...vesselActs, dummyActivity];
            listWithNewVessel.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
            const vesselIndex = listWithNewVessel.findIndex(a => a.id === 'dummy-temp') + 1;

            return { global: globalIndex, vesselSpecific: vesselIndex };
        } catch (e) {
            console.error("Error calculating row position:", e);
            return { global: null, vesselSpecific: null };
        }
    }, [vesselId, startTimeISO, activities, profile, crewVesselId, companyVesselIds, allowedVessels]);

    const handleSubmit = async (e) => {
        e.preventDefault();
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
            const payload = {
                vesselId,
                activityType,
                geofenceId: activityType === 'Navigation' ? null : (geofenceId || null),
                geofenceFromId: activityType === 'Navigation' ? (geofenceFromId || null) : (geofenceId || null),
                geofenceToId: activityType === 'Navigation' ? (geofenceToId || null) : (geofenceId || null),
                startTime: startTimeISO,
                endTime: endTimeISO || null,
            };

            if (overlappingActivity && splitExisting) {
                const newStart = new Date(startTimeISO);
                const newEnd = hasAtd && endTimeISO ? new Date(endTimeISO) : null;
                const actStart = new Date(overlappingActivity.startTime);
                const actEnd = overlappingActivity.endTime ? new Date(overlappingActivity.endTime) : null;

                const isInside = newStart > actStart && (actEnd === null || (newEnd !== null && newEnd < actEnd));

                if (isInside) {
                    await activityService.createManualActivityAndSplit(payload, overlappingActivity.id);
                } else {
                    await activityService.createManualActivity(payload);
                }
            } else {
                await activityService.createManualActivity(payload);
            }

            onSaved();
            onClose();
        } catch (err) {
            console.error('Error creating manual activity:', err);
            setError(err.message || 'An error occurred while creating the activity.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="lem-overlay animate-in fade-in duration-200" onClick={onClose}>
            <div className="lem-modal max-w-md w-full glassmorphic rounded-[1.5rem] border border-white/20 shadow-2xl p-4 md:p-5 animate-in zoom-in-95 duration-200" style={{ maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-surface-low/10 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
                            <Activity size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-manrope font-black text-on-surface uppercase tracking-tight">Manual Activity</h2>
                            <p className="text-[10px] text-on-surface/40 uppercase tracking-widest font-black">Add Offline AIS Log</p>
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
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 outline-none focus:border-amber-500 transition-all cursor-pointer" style={{ color: '#64748b' }}
                            required
                        >
                            <option value="">Select vessel</option>
                            {allowedVessels.map(v => (
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
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 outline-none focus:border-amber-500 transition-all cursor-pointer" style={{ color: '#64748b' }}
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
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 outline-none focus:border-amber-500 transition-all cursor-pointer" style={{ color: '#64748b' }}
                                    required
                                >
                                    <option value="">Select departure</option>
                                    {geofences.map(g => (
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
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 outline-none focus:border-amber-500 transition-all cursor-pointer" style={{ color: '#64748b' }}
                                    required
                                >
                                    <option value="">Select arrival</option>
                                    {geofences.map(g => (
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
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 outline-none focus:border-amber-500 transition-all cursor-pointer" style={{ color: '#64748b' }}
                                required
                            >
                                <option value="">Select geofence</option>
                                {geofences.map(g => (
                                    <option key={g.id} value={g.id}>{g.name} ({g.nature})</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Arrival ATA */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase text-on-surface/40 tracking-wider flex items-center gap-1">
                            <Clock size={12} /> ATA (Arrival Date & Time)
                        </label>
                        <div className="grid grid-cols-12 gap-2">
                            <div className="col-span-6">
                                <input 
                                    type="date" 
                                    value={ataDate} 
                                    onChange={e => setAtaDate(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 outline-none focus:border-amber-500 transition-all cursor-pointer" style={{ color: '#64748b' }}
                                    required
                                />
                            </div>
                            <div className="col-span-3">
                                <select 
                                    value={ataHour} 
                                    onChange={e => setAtaHour(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 outline-none focus:border-amber-500 transition-all cursor-pointer" style={{ color: '#64748b' }}
                                    required
                                >
                                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>
                            <div className="col-span-3">
                                <select 
                                    value={ataMinute} 
                                    onChange={e => setAtaMinute(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 outline-none focus:border-amber-500 transition-all cursor-pointer" style={{ color: '#64748b' }}
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
                            <Activity size={14} className="text-amber-500" /> Activity Status
                        </span>
                        <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={!hasAtd} 
                                onChange={e => setHasAtd(!e.target.checked)} 
                                className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-500 cursor-pointer" 
                            />
                            <span className={`text-[11px] font-black uppercase tracking-wide ${!hasAtd ? 'text-amber-600' : 'text-slate-400'}`}>
                                SET TO "IN PROGRESS"
                            </span>
                        </label>
                    </div>

                    {/* Departure ATD Fields */}
                    {hasAtd && (
                        <div className="flex flex-col gap-1 mt-2">
                            <label className="text-[10px] font-black uppercase text-on-surface/40 tracking-wider flex items-center gap-1">
                                <Clock size={12} /> ATD (Departure Date & Time)
                            </label>
                            <div className="grid grid-cols-12 gap-2">
                            <div className="col-span-6">
                                <input 
                                    type="date" 
                                    value={atdDate} 
                                    onChange={e => setAtdDate(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 outline-none focus:border-amber-500 transition-all cursor-pointer" style={{ color: '#64748b' }}
                                    required
                                />
                            </div>
                            <div className="col-span-3">
                                <select 
                                    value={atdHour} 
                                    onChange={e => setAtdHour(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 outline-none focus:border-amber-500 transition-all cursor-pointer" style={{ color: '#64748b' }}
                                    required
                                >
                                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>
                            <div className="col-span-3">
                                <select 
                                    value={atdMinute} 
                                    onChange={e => setAtdMinute(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 outline-none focus:border-amber-500 transition-all cursor-pointer" style={{ color: '#64748b' }}
                                    required
                                >
                                    {MINUTES.map(m => <option key={m} value={m}>{m}</option>
                                    )}
                                </select>
                            </div>
                            </div>
                        </div>
                    )}

                    {/* Overlap Detection Box */}
                    {overlappingActivity && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 space-y-2 animate-in slide-in-from-top-2">
                            <div className="flex gap-2">
                                <AlertTriangle size={14} className="flex-shrink-0 text-amber-600 mt-0.5" />
                                <div>
                                    <span className="font-extrabold uppercase block text-[10px] text-amber-600 tracking-wider">Time Range Overlap</span>
                                    This time range overlaps with an existing activity: <br />
                                    <strong className="text-amber-900">{overlappingActivity.activity} ({overlappingActivity.geofence || 'Navigation'})</strong> <br />
                                    from <span className="underline">{formatTime(overlappingActivity.startTime)}</span> to <span className="underline">{overlappingActivity.endTime ? formatTime(overlappingActivity.endTime) : 'In Progress'}</span>.
                                </div>
                            </div>
                            
                            {(() => {
                                const newStart = new Date(startTimeISO);
                                const newEnd = hasAtd && endTimeISO ? new Date(endTimeISO) : null;
                                const actStart = new Date(overlappingActivity.startTime);
                                const actEnd = overlappingActivity.endTime ? new Date(overlappingActivity.endTime) : null;

                                const isInside = newStart > actStart && (actEnd === null || (newEnd !== null && newEnd < actEnd));
                                
                                if (isInside) {
                                    return (
                                        <div className="flex items-center gap-2 pt-2 border-t border-amber-200/50">
                                            <input 
                                                type="checkbox" 
                                                id="splitActivity" 
                                                checked={splitExisting} 
                                                onChange={e => setSplitExisting(e.target.checked)} 
                                                className="w-3.5 h-3.5 text-amber-600 border-amber-300 rounded focus:ring-amber-500 cursor-pointer"
                                            />
                                            <label htmlFor="splitActivity" className="font-extrabold text-amber-900 cursor-pointer select-none">
                                                Split existing activity into two legs around this
                                            </label>
                                        </div>
                                    );
                                } else {
                                    return (
                                        <div className="text-[10px] text-red-600 font-bold pt-1">
                                            Note: Partial overlap. Saving may cause overlapping durations. Adjust or delete the existing activity first.
                                        </div>
                                    );
                                }
                            })()}
                        </div>
                    )}

                    {/* Metadata Preview Grid (Row Number & Duration) */}
                    {vesselId && startTimeISO && (
                        <div className="grid grid-cols-2 gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-200/60 text-[11px] font-bold animate-in fade-in duration-300">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] uppercase font-black text-on-surface/40 tracking-wider">Estimated Ref (Row)</span>
                                <span className="text-primary font-black text-[12px] leading-tight">
                                    {targetRowNumber.global !== null 
                                        ? `#${targetRowNumber.global} (Overall) / #${targetRowNumber.vesselSpecific} (Vessel)`
                                        : 'Calculating...'}
                                </span>
                            </div>
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
                            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] uppercase tracking-widest py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/20"
                            disabled={submitting || durationText.includes('Invalid')}
                        >
                            {submitting ? 'Creating...' : (
                                <>
                                    <Check size={14} /> Create Activity
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

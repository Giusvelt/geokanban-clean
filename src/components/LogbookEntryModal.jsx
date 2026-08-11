import React, { useState } from 'react';
import {
    X, Ship, Clock, ShieldCheck, Lock, Anchor, Navigation,
    Package, Fuel, Users, AlertCircle, ChevronDown, ChevronUp, MessageSquare, CalendarDays
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useActivities } from '../hooks/useActivities';
import ActivityChatModal from './ActivityChatModal';
import { TimeInput } from './common/TimeInput';
import { getDeviceFingerprint } from '../utils/deviceUtils';
import { fmt } from '../utils/timeFormatters';
import { logbookService } from '../services/api/logbookService';
import { auditService } from '../services/api/auditService';
import { NEEDS_SERVICES, NO_MOORING, NEEDS_CARGO, NEEDS_BUNKER, ACTIVITY_COLORS } from '../constants/logbookConstants';



export default function LogbookEntryModal({ activity, profile, entryMeta, onClose, onSaved }) {
    const { activities } = useData();
    const { activityTypes } = useActivities();

    const isSubmitted = entryMeta?.status === 'submitted' || entryMeta?.status === 'approved';
    const sf = entryMeta?.structured_fields || {};

    const [selectedActivityType, setSelectedActivityType] = useState(activity?.activity || 'Navigation');

    const [navFrom, setNavFrom] = useState('—');
    const [navTo, setNavTo] = useState('—');

    React.useEffect(() => {
        if (activity?.activity === 'Navigation' && activities?.length) {
            const vesselActs = activities
                .filter(a => a.vesselId === activity.vesselId)
                .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

            const idx = vesselActs.findIndex(a => a.id === activity.id);
            if (idx >= 0) {
                const prev = idx > 0 ? vesselActs[idx - 1].geofence : 'Unknown';
                const next = idx < vesselActs.length - 1 ? vesselActs[idx + 1].geofence : 'Unknown';
                setNavFrom(prev && prev !== '—' ? prev : 'Open Sea');
                setNavTo(next && next !== '—' ? next : 'Open Sea');
            }
        }
    }, [activity, activities]);

    const baseDate = activity?.startTime || new Date();
    const depBaseDate = activity?.endTime || new Date();

    const [form, setForm] = useState({
        ata: fmt(activity?.startTime),
        atd: fmt(activity?.endTime),
        actual_cargo: sf.actual_cargo_tonnes != null ? String(sf.actual_cargo_tonnes) : '',
        actual_bunker: sf.actual_bunker_tonnes != null ? String(sf.actual_bunker_tonnes) : '',
        // Arrival maneuver - Default to activity base date if empty
        arr_pilot_call: sf.arrival_pilot_call || activity?.startTime || null,
        arr_pilot_in: sf.arrival_pilot_in || activity?.startTime || null,
        arr_pilot_out: sf.arrival_pilot_out || activity?.startTime || null,
        arr_mooring_in: sf.arrival_mooring_in || activity?.startTime || null,
        arr_mooring_out: sf.arrival_mooring_out || activity?.startTime || null,
        arr_tug_in: sf.arrival_tug_in || activity?.startTime || null,
        arr_tug_out: sf.arrival_tug_out || activity?.startTime || null,
        arr_tug_count: sf.arrival_tug_count != null ? String(sf.arrival_tug_count) : '0',
        // Departure maneuver
        dep_pilot_call: sf.departure_pilot_call || activity?.endTime || null,
        dep_pilot_in: sf.departure_pilot_in || activity?.endTime || null,
        dep_pilot_out: sf.departure_pilot_out || activity?.endTime || null,
        dep_mooring_in: sf.departure_mooring_in || activity?.endTime || null,
        dep_mooring_out: sf.departure_mooring_out || activity?.endTime || null,
        dep_tug_in: sf.departure_tug_in || activity?.endTime || null,
        dep_tug_out: sf.departure_tug_out || activity?.endTime || null,
        dep_tug_count: sf.departure_tug_count != null ? String(sf.departure_tug_count) : '0',
        // Narrative
        narrative: entryMeta?.narrative_text || '',
    });

    const [saving, setSaving] = useState(false);
    const [autoSaveStatus, setAutoSaveStatus] = useState(null); // 'saving', 'saved', 'error'
    const [showArrival, setShowArrival] = useState(true);
    const [showDeparture, setShowDeparture] = useState(true);
    const [showChat, setShowChat] = useState(false);

    const set = (f, v) => setForm(prev => ({ ...prev, [f]: v }));

    // Auto-save logic
    React.useEffect(() => {
        if (isSubmitted) return;

        const timer = setTimeout(() => {
            handleSave(false, true); // silent auto-save
        }, 3000);

        return () => clearTimeout(timer);
    }, [form]);

    const needsServices = NEEDS_SERVICES.includes(selectedActivityType);
    const noMooring = NO_MOORING.includes(selectedActivityType);
    const needsCargo = NEEDS_CARGO.includes(selectedActivityType);
    const needsBunker = NEEDS_BUNKER.includes(selectedActivityType);

    const handleSave = async (submit = false, isAutoSave = false) => {
        if (submit && !confirm('WARNING: You are about to CERTIFY and LOCK this logbook entry. This operation is irreversible and constitutes an assumption of Command responsibility. Proceed?')) return;
        
        if (isAutoSave) setAutoSaveStatus('saving');
        else setSaving(true);
        
        try {
            // 1. Update vessel_activity times and type
            const vaUpdates = {};
            if (form.ata) vaUpdates.start_time = new Date(form.ata).toISOString();
            if (form.atd) vaUpdates.end_time = new Date(form.atd).toISOString();
            if (selectedActivityType !== activity?.activity) {
                vaUpdates.activity_type = selectedActivityType;
            }
            if (Object.keys(vaUpdates).length > 0) {
                await logbookService.updateActivityTimes(activity.id, vaUpdates);
            }

            // 2. Build structured_fields
            const structuredFields = {
                actual_cargo_tonnes: form.actual_cargo ? Number(form.actual_cargo) : null,
                actual_bunker_tonnes: form.actual_bunker ? Number(form.actual_bunker) : null,
                arrival_pilot_call: form.arr_pilot_call,
                arrival_pilot_in: form.arr_pilot_in,
                arrival_pilot_out: form.arr_pilot_out,
                arrival_mooring_in: form.arr_mooring_in,
                arrival_mooring_out: form.arr_mooring_out,
                arrival_tug_count: Number(form.arr_tug_count) || 0,
                arrival_tug_in: form.arr_tug_in,
                arrival_tug_out: form.arr_tug_out,
                departure_pilot_call: form.dep_pilot_call,
                departure_pilot_in: form.dep_pilot_in,
                departure_pilot_out: form.dep_pilot_out,
                departure_mooring_in: form.dep_mooring_in,
                departure_mooring_out: form.dep_mooring_out,
                departure_tug_count: Number(form.dep_tug_count) || 0,
                departure_tug_in: form.dep_tug_in,
                departure_tug_out: form.dep_tug_out,
            };

            // 3. Logbook entry upsert
            const existingId = entryMeta?.id;
            const entryPayload = {
                vessel_activity_id: activity.id,
                vessel_id: activity.vesselId,
                crew_id: profile?.id,
                narrative_text: form.narrative,
                structured_fields: structuredFields,
                status: submit ? 'submitted' : (entryMeta?.status || 'draft'),
            };

            if (submit) {
                entryPayload.submitted_by_name = profile?.displayName || profile?.email || 'Unknown';
                entryPayload.submitted_by_title = profile?.signatureTitle || 'Command Member';
            }

            await logbookService.upsertLogbookEntry(existingId, entryPayload);

            // 4. Record Audit Log with Device Fingerprint
            await auditService.logAction(activity.id, profile?.id, submit ? 'CERTIFY_LOGBOOK' : 'UPDATE_LOGBOOK', entryPayload);

            if (isAutoSave) {
                setAutoSaveStatus('saved');
                setTimeout(() => setAutoSaveStatus(null), 2000);
            } else {
                onSaved?.();
                onClose();
            }
        } catch (err) {
            if (isAutoSave) setAutoSaveStatus('error');
            else alert('Error during save: ' + err.message);
        } finally {
            if (!isAutoSave) setSaving(false);
        }
    };

    const badgeColor = ACTIVITY_COLORS[activity?.activity] || '#475569';

    return (
        <div className="lem-overlay" onClick={onClose}>
            <div className="lem-modal" onClick={e => e.stopPropagation()}>

                {/* ── Header ─────────────────────────────────── */}
                <div className="lem-header" style={{ borderTop: `4px solid ${badgeColor}` }}>
                    <div className="lem-header-left">
                        <div className="lem-title-row">
                            <Ship size={18} style={{ color: badgeColor }} />
                            <h2>{activity?.vessel}</h2>
                            <span className="lem-badge" style={{ background: badgeColor, padding: isSubmitted ? '4px 12px' : '0' }}>
                                {isSubmitted ? (
                                    selectedActivityType
                                ) : (
                                    <select 
                                        value={selectedActivityType}
                                        onChange={e => setSelectedActivityType(e.target.value)}
                                        style={{ 
                                            background: 'transparent', 
                                            border: 'none', 
                                            color: 'white', 
                                            fontWeight: 'bold', 
                                            outline: 'none', 
                                            cursor: 'pointer',
                                            padding: '4px 8px',
                                            width: '100%',
                                            fontFamily: 'inherit',
                                            fontSize: 'inherit',
                                            textTransform: 'uppercase',
                                            letterSpacing: 'inherit'
                                        }}
                                    >
                                        <option value={selectedActivityType} style={{ color: 'black' }}>{selectedActivityType}</option>
                                        {activityTypes?.map(at => (
                                            at.name !== selectedActivityType && <option key={at.id} value={at.name} style={{ color: 'black' }}>{at.name}</option>
                                        ))}
                                    </select>
                                )}
                            </span>
                            {isSubmitted && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span className="lem-cert-badge">
                                        <ShieldCheck size={12} /> CERTIFIED
                                    </span>
                                    {entryMeta?.submitted_by_name && (
                                        <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 'bold' }}>
                                            Signed: {entryMeta.submitted_by_name} ({entryMeta.submitted_by_title || 'No Title'})
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="lem-subtitle" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                            <Anchor size={13} />
                            {activity?.activity === 'Navigation' ? (
                                <span><b>FROM:</b> {navFrom} <b>TO:</b> {navTo}</span>
                            ) : (
                                <span>{activity?.geofence && activity.geofence !== '—' ? activity.geofence : 'Open Sea Navigation'}</span>
                            )}
                        </div>
                    </div>
                    <div className="lem-header-right">
                        {!isSubmitted && (
                            <button
                                onClick={() => setShowChat(true)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    background: '#3b82f6', color: 'white', padding: '4px 12px',
                                    borderRadius: '6px', border: 'none', cursor: 'pointer',
                                    fontWeight: 'bold', fontSize: '12px'
                                }}
                                title="Open Live Communications"
                            >
                                <MessageSquare size={14} /> MSG
                                {activity?.msgCount > 0 && <span style={{ background: '#ef4444', color: 'white', borderRadius: '50%', padding: '0 4px', fontSize: '10px' }}>{activity.msgCount}</span>}
                            </button>
                        )}
                        {isSubmitted && (
                            <div className="lem-lock-badge">
                                <Lock size={13} /> LOCKED
                            </div>
                        )}
                        <button className="lem-close" onClick={onClose}><X size={18} /></button>
                    </div>
                </div>

                {/* ── Body ───────────────────────────────────── */}
                <div className="lem-body">

                    {/* ① Orari Attività (AIS LOYALTY) */}
                    <section className="lem-section">
                        <div className="lem-section-title">
                            <Clock size={15} />
                            <span>Activity Times (AIS LOYALTY)</span>
                        </div>
                        <div className="lem-grid-2">
                            <TimeInput 
                                label="ATA — Arrival" 
                                value={form.ata} 
                                onChange={v => set('ata', v)} 
                                disabled={isSubmitted} 
                                baseDate={activity?.startTime} 
                            />
                            <TimeInput 
                                label="ATD — Departure" 
                                value={form.atd} 
                                onChange={v => set('atd', v)} 
                                disabled={isSubmitted} 
                                baseDate={activity?.endTime || activity?.startTime} 
                            />
                        </div>
                    </section>

                    {/* ② Carico Effettivo (Loading / Unloading) */}
                    {needsCargo && (
                        <section className="lem-section lem-highlight-cargo">
                            <div className="lem-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Package size={15} />
                                    <span>{activity?.activity === 'Loading' ? 'Actual Cargo Loaded' : 'Actual Cargo Unloaded (Drifting)'}</span>
                                    <span className="lem-required">Required for {activity?.activity}</span>
                                </div>
                                <div style={{ fontSize: '11px', background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7', border: '1px solid rgba(2, 132, 199, 0.2)', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                                    AIS Draft (In/Out): {activity?.aisStartDraught || '—'} / {activity?.aisEndDraught || '—'}
                                </div>
                            </div>
                            <div className="lem-cargo-row">
                                <label className="lem-field" style={{ maxWidth: 280 }}>
                                    <span className="lem-label">Actual Tonnes (t)</span>
                                    <div className="lem-unit-input">
                                        <input
                                            type="number"
                                            className="lem-input lem-input-large"
                                            value={form.actual_cargo}
                                            onChange={e => set('actual_cargo', e.target.value)}
                                            disabled={isSubmitted}
                                            placeholder="e.g. 23400"
                                            min="0"
                                        />
                                        <span className="lem-unit">t</span>
                                    </div>
                                </label>
                                <div className="lem-cargo-hint">
                                    <AlertCircle size={13} />
                                    <span>Data measured from Draft and ship tables. Verify before certifying.</span>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* ③ Bunker (solo Port Operations) */}
                    {needsBunker && (
                        <section className="lem-section lem-highlight-bunker">
                            <div className="lem-section-title">
                                <Fuel size={15} />
                                <span>Bunkering</span>
                            </div>
                            <label className="lem-field" style={{ maxWidth: 280 }}>
                                <span className="lem-label">Bunker Quantity (t)</span>
                                <div className="lem-unit-input">
                                    <input
                                        type="number"
                                        className="lem-input lem-input-large"
                                        value={form.actual_bunker}
                                        onChange={e => set('actual_bunker', e.target.value)}
                                        disabled={isSubmitted}
                                        placeholder="e.g. 180"
                                        min="0"
                                    />
                                    <span className="lem-unit">t</span>
                                </div>
                            </label>
                        </section>
                    )}

                    {/* ④ Servizi Nautici */}
                    {needsServices && (
                        <>
                            {/* MANOVRA ARRIVO */}
                            <section className="lem-section lem-manovra arrival">
                                <button className="lem-manovra-toggle" onClick={() => setShowArrival(v => !v)}>
                                    <div className="lem-section-title">
                                        <div className="lem-manovra-dot arrival-dot" />
                                        <span>ARRIVAL Maneuver in {activity?.geofence !== '—' ? activity.geofence : 'port'}</span>
                                    </div>
                                    {showArrival ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>

                                {showArrival && (
                                    <div className="lem-services-grid">
                                        {/* Pilota */}
                                        <div className="lem-service-row">
                                            <div className="lem-service-name">
                                                <span className="lem-svc-code">PIL</span>
                                                <span>Pilot</span>
                                            </div>
                                            <TimeInput label="VHF Call" value={form.arr_pilot_call} onChange={v => set('arr_pilot_call', v)} disabled={isSubmitted} baseDate={baseDate} />
                                            <TimeInput label="Pilot On Board (IN)" value={form.arr_pilot_in} onChange={v => set('arr_pilot_in', v)} disabled={isSubmitted} baseDate={baseDate} />
                                            <TimeInput label="Pilot Disembarked (OUT)" value={form.arr_pilot_out} onChange={v => set('arr_pilot_out', v)} disabled={isSubmitted} baseDate={baseDate} />
                                        </div>

                                        {/* Ormeggiatori */}
                                        {!noMooring && (
                                            <div className="lem-service-row">
                                                <div className="lem-service-name">
                                                    <span className="lem-svc-code">MOOR</span>
                                                    <span>Mooring</span>
                                                </div>
                                                <div className="lem-field" />
                                                <TimeInput label="First Line Ashore (IN)" value={form.arr_mooring_in} onChange={v => set('arr_mooring_in', v)} disabled={isSubmitted} baseDate={baseDate} />
                                                <TimeInput label="All Fast (OUT)" value={form.arr_mooring_out} onChange={v => set('arr_mooring_out', v)} disabled={isSubmitted} baseDate={baseDate} />
                                            </div>
                                        )}

                                        {/* Rimorchiatori */}
                                        {!noMooring && (
                                            <div className="lem-service-row">
                                                <div className="lem-service-name">
                                                    <span className="lem-svc-code">TUG</span>
                                                    <span>Tugs</span>
                                                </div>
                                                <label className="lem-field">
                                                    <span className="lem-label">N° Tugs used</span>
                                                    <div className="lem-tug-count">
                                                        <button onClick={() => set('arr_tug_count', Math.max(0, Number(form.arr_tug_count) - 1))} disabled={isSubmitted}>−</button>
                                                        <span>{form.arr_tug_count}</span>
                                                        <button onClick={() => set('arr_tug_count', Number(form.arr_tug_count) + 1)} disabled={isSubmitted}>+</button>
                                                    </div>
                                                </label>
                                                <TimeInput label="Tugs Made Fast (IN)" value={form.arr_tug_in} onChange={v => set('arr_tug_in', v)} disabled={isSubmitted} baseDate={baseDate} />
                                                <TimeInput label="Tugs Dismissed (OUT)" value={form.arr_tug_out} onChange={v => set('arr_tug_out', v)} disabled={isSubmitted} baseDate={baseDate} />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </section>

                            {/* MANOVRA PARTENZA */}
                            <section className="lem-section lem-manovra departure">
                                <button className="lem-manovra-toggle" onClick={() => setShowDeparture(v => !v)}>
                                    <div className="lem-section-title">
                                        <div className="lem-manovra-dot departure-dot" />
                                        <span>DEPARTURE Maneuver from {activity?.geofence !== '—' ? activity.geofence : 'port'}</span>
                                    </div>
                                    {showDeparture ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>

                                {showDeparture && (
                                    <div className="lem-services-grid">
                                        {/* Pilota */}
                                        <div className="lem-service-row">
                                            <div className="lem-service-name">
                                                <span className="lem-svc-code">PIL</span>
                                                <span>Pilot</span>
                                            </div>
                                            <TimeInput label="VHF Call" value={form.dep_pilot_call} onChange={v => set('dep_pilot_call', v)} disabled={isSubmitted} baseDate={depBaseDate} />
                                            <TimeInput label="Pilot On Board (IN)" value={form.dep_pilot_in} onChange={v => set('dep_pilot_in', v)} disabled={isSubmitted} baseDate={depBaseDate} />
                                            <TimeInput label="Pilot Disembarked (OUT)" value={form.dep_pilot_out} onChange={v => set('dep_pilot_out', v)} disabled={isSubmitted} baseDate={depBaseDate} />
                                        </div>

                                        {/* Ormeggiatori */}
                                        {!noMooring && (
                                            <div className="lem-service-row">
                                                <div className="lem-service-name">
                                                    <span className="lem-svc-code">MOOR</span>
                                                    <span>Mooring</span>
                                                </div>
                                                <div className="lem-field" />
                                                <TimeInput label="Singled Up (IN)" value={form.dep_mooring_in} onChange={v => set('dep_mooring_in', v)} disabled={isSubmitted} baseDate={depBaseDate} />
                                                <TimeInput label="Last Line Clear (OUT)" value={form.dep_mooring_out} onChange={v => set('dep_mooring_out', v)} disabled={isSubmitted} baseDate={depBaseDate} />
                                            </div>
                                        )}

                                        {/* Rimorchiatori */}
                                        {!noMooring && (
                                            <div className="lem-service-row">
                                                <div className="lem-service-name">
                                                    <span className="lem-svc-code">TUG</span>
                                                    <span>Tugs</span>
                                                </div>
                                                <label className="lem-field">
                                                    <span className="lem-label">N° Tugs used</span>
                                                    <div className="lem-tug-count">
                                                        <button onClick={() => set('dep_tug_count', Math.max(0, Number(form.dep_tug_count) - 1))} disabled={isSubmitted}>−</button>
                                                        <span>{form.dep_tug_count}</span>
                                                        <button onClick={() => set('dep_tug_count', Number(form.dep_tug_count) + 1)} disabled={isSubmitted}>+</button>
                                                    </div>
                                                </label>
                                                <TimeInput label="Tugs Made Fast (IN)" value={form.dep_tug_in} onChange={v => set('dep_tug_in', v)} disabled={isSubmitted} baseDate={depBaseDate} />
                                                <TimeInput label="Tugs Dismissed (OUT)" value={form.dep_tug_out} onChange={v => set('dep_tug_out', v)} disabled={isSubmitted} baseDate={depBaseDate} />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </section>
                        </>
                    )}

                    {/* ⑤ Note Narrative */}
                    <section className="lem-section">
                        <div className="lem-section-title">
                            <Navigation size={15} />
                            <span>Logbook Notes & Narrative</span>
                        </div>
                        <textarea
                            className="lem-narrative"
                            value={form.narrative}
                            onChange={e => set('narrative', e.target.value)}
                            disabled={isSubmitted}
                            placeholder="Insert here any formal observations by the Master regarding operational conditions, weather, or critical issues found during the activity..."
                            rows={4}
                        />
                    </section>

                    {/* ⑥ Notifiche/Messaggi */}
                    {isSubmitted && entryMeta?.message_snapshot?.length > 0 && (
                        <section className="lem-section lem-messages-section">
                            <div className="lem-section-title">
                                <AlertCircle size={15} />
                                <span>Message Snapshot (Activity Chat)</span>
                            </div>
                            <div className="lem-messages-list" style={{ fontSize: '12px', background: '#f8fafc', padding: '10px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                {entryMeta.message_snapshot.map((msg, i) => {
                                    const d = new Date(msg.at);
                                    return (
                                        <div key={i} style={{ marginBottom: '6px' }}>
                                            <span style={{ fontWeight: 'bold', color: msg.role === 'admin' ? '#ef4444' : '#3b82f6' }}>
                                                {msg.sender} [{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]:
                                            </span>
                                            <span style={{ marginLeft: '4px' }}>{msg.text}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </section>
                    )}

                    {/* ⑦ Hash visivo (solo se certificato) */}
                    {isSubmitted && entryMeta?.document_hash && (
                        <section className="lem-section lem-hash-section">
                            <div className="lem-hash-row">
                                <ShieldCheck size={16} color="#10b981" />
                                <div>
                                    <div className="lem-hash-title">Digital Certification Signature (SHA-256)</div>
                                    <code className="lem-hash-code">{entryMeta.document_hash}</code>
                                    <div className="lem-hash-hint">This string guarantees document integrity. Any modification to the certified content would generate a different hash.</div>
                                </div>
                            </div>
                        </section>
                    )}
                </div>

                {/* ── Footer ─────────────────────────────────── */}
                {!isSubmitted && (
                    <div className="lem-footer">
                        <div className="lem-auto-save-container" style={{ flex: 1, fontSize: '12px' }}>
                            {autoSaveStatus === 'saving' && <span style={{ color: '#64748b' }}>Saving draft...</span>}
                            {autoSaveStatus === 'saved' && <span style={{ color: '#10b981', fontWeight: '500' }}>✓ Draft saved</span>}
                            {autoSaveStatus === 'error' && <span style={{ color: '#ef4444' }}>Error saving draft</span>}
                        </div>
                        <button className="lem-btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
                        <div className="lem-footer-right">
                            <button className="lem-btn-save" onClick={() => handleSave(false)} disabled={saving}>
                                {saving ? 'Saving...' : 'Save Draft'}
                            </button>
                            <button className="lem-btn-submit" onClick={() => handleSave(true)} disabled={saving}>
                                <ShieldCheck size={15} />
                                {saving ? 'Certifying...' : 'Certify & Submit'}
                            </button>
                        </div>
                    </div>
                )}
                {isSubmitted && (
                    <div className="lem-footer lem-footer-locked">
                        <Lock size={14} />
                        <span>Certified Row — Read Only. Visible to Admin in Logbook Registry.</span>
                    </div>
                )}
            </div>

            {showChat && (
                <ActivityChatModal
                    activity={activity}
                    profile={profile}
                    onClose={() => setShowChat(false)}
                    readOnly={true}
                />
            )}
        </div>
    );
}

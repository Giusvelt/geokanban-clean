import React from 'react';
import { X } from 'lucide-react';

export default function StandbyRangeModal({
    showRangeForm,
    setShowRangeForm,
    rangeData,
    setRangeData,
    standbyReasons,
    saving,
    handleSaveRange
}) {
    if (!showRangeForm) return null;

    return (
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
                                className="edit-input"
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                value={rangeData.startDate}
                                onChange={e => setRangeData({ ...rangeData, startDate: e.target.value })}
                            />
                        </div>
                        {!rangeData.allDay && (
                            <div style={{ width: '120px' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '6px', textTransform: 'uppercase', color: '#64748b' }}>Ora</label>
                                <input
                                    type="time"
                                    className="edit-input"
                                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                    value={rangeData.startTime}
                                    onChange={e => setRangeData({ ...rangeData, startTime: e.target.value })}
                                />
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '6px', textTransform: 'uppercase', color: '#64748b' }}>Data Fine</label>
                            <input
                                type="date"
                                className="edit-input"
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                value={rangeData.endDate}
                                onChange={e => setRangeData({ ...rangeData, endDate: e.target.value })}
                            />
                        </div>
                        {!rangeData.allDay && (
                            <div style={{ width: '120px' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '6px', textTransform: 'uppercase', color: '#64748b' }}>Ora</label>
                                <input
                                    type="time"
                                    className="edit-input"
                                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                    value={rangeData.endTime}
                                    onChange={e => setRangeData({ ...rangeData, endTime: e.target.value })}
                                />
                            </div>
                        )}
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Stand-by Reason</label>
                        <select
                            className="edit-select"
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                            value={rangeData.reasonId}
                            onChange={e => setRangeData({ ...rangeData, reasonId: e.target.value })}
                        >
                            <option value="">-- Select Reason --</option>
                            {standbyReasons.map(r => (
                                <option key={r.id} value={r.id}>{r.reason_name || r.name} {r.code ? (+r.code+) : ''}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Notes (Optional)</label>
                        <textarea
                            className="edit-input"
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', minHeight: '60px' }}
                            placeholder="Add details..."
                            value={rangeData.notes}
                            onChange={e => setRangeData({ ...rangeData, notes: e.target.value })}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px' }}>
                        <button className="lem-btn-cancel" onClick={() => setShowRangeForm(false)} disabled={saving}>Annulla</button>
                        <button className="lem-btn-submit" onClick={handleSaveRange} disabled={saving || !rangeData.reasonId}>
                            {saving ? 'Salvataggio...' : 'Salva'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

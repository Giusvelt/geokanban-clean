import React from 'react';
import { X } from 'lucide-react';

export default function StandbyDayModal({
    selectedDate,
    setSelectedDate,
    modalData,
    setModalData,
    standbyReasons,
    saving,
    handleSaveStandby,
    handleDeleteStandby,
    vesselSchedules,
    toDateStr
}) {
    if (!selectedDate) return null;

    const dateStr = toDateStr(selectedDate);
    const existing = vesselSchedules[dateStr];

    return (
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
                                <option key={r.id} value={r.id}>{r.reason_name || r.name} {r.code ? (+r.code+) : ''}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Notes (Optional)</label>
                        <textarea
                            className="edit-input"
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', minHeight: '80px' }}
                            placeholder="Add any relevant details..."
                            value={modalData.notes}
                            onChange={e => setModalData({ ...modalData, notes: e.target.value })}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px' }}>
                        {existing && (
                            <button 
                                className="lem-btn-cancel" 
                                style={{ background: '#fee2e2', color: '#ef4444', marginRight: 'auto' }}
                                onClick={handleDeleteStandby}
                                disabled={saving}
                            >
                                Delete
                            </button>
                        )}
                        <button className="lem-btn-cancel" onClick={() => setSelectedDate(null)} disabled={saving}>Cancel</button>
                        <button className="lem-btn-submit" onClick={handleSaveStandby} disabled={saving || !modalData.reasonId}>
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

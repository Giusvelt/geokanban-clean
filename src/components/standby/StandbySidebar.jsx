import React from 'react';
import { Calendar, AlertCircle, Clock } from 'lucide-react';

export default function StandbySidebar({
    perms,
    visibleVessels,
    vesselColorMap,
    sidebarTab,
    setSidebarTab,
    upcomingStandbys,
    pendingSchedules,
    vessels,
    standbyReasons,
    approveSchedule,
    profile,
    rejectSchedule,
    toDateStr
}) {
    if (perms.seeOwnVesselOnly) return null;

    return (
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
                        <Calendar size={14} color={sidebarTab === 'upcoming' ? '#f59e0b' : '#94a3b8'} />
                        <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: sidebarTab === 'upcoming' ? '#f59e0b' : '#94a3b8' }}>Upcoming ({upcomingStandbys.length})</span>
                    </div>
                    {perms.approveSchedule && (
                        <div 
                            onClick={() => setSidebarTab('approvals')}
                            style={{ flex: 1, padding: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderBottom: sidebarTab === 'approvals' ? '2px solid #ef4444' : '2px solid transparent', background: sidebarTab === 'approvals' ? '#fff' : 'transparent', transition: 'all 0.2s' }}
                        >
                            <AlertCircle size={14} color={sidebarTab === 'approvals' ? '#ef4444' : '#94a3b8'} />
                            <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: sidebarTab === 'approvals' ? '#ef4444' : '#94a3b8' }}>Pending ({pendingSchedules.length})</span>
                        </div>
                    )}
                </div>

                <div style={{ padding: '16px', flex: 1, overflowY: 'auto', maxHeight: '400px' }}>
                    {sidebarTab === 'upcoming' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {upcomingStandbys.length === 0 ? (
                                <div style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>
                                    Nessuno stand-by programmato
                                </div>
                            ) : (
                                upcomingStandbys.map(s => {
                                    const v = vessels?.find(vx => vx.id === s.vesselId);
                                    const vName = v ? v.name : 'Flotta';
                                    const vColor = v ? (vesselColorMap[v.id] || '#94a3b8') : '#94a3b8';
                                    const reason = standbyReasons.find(r => r.id === s.reasonId)?.reason_name || s.reasonId;
                                    const dStr = toDateStr(new Date(s.date));
                                    const isMeteo = reason.toLowerCase().includes('meteo');

                                    return (
                                        <div key={s.id} style={{ display: 'flex', gap: '12px', padding: '12px', background: isMeteo ? '#f8fafc' : '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', borderLeft: 4px solid  }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '45px', background: '#f1f5f9', borderRadius: '6px', padding: '6px' }}>
                                                <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>{new Date(s.date).toLocaleString('default', { month: 'short' })}</span>
                                                <span style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a', lineHeight: 1 }}>{new Date(s.date).getDate()}</span>
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '11px', fontWeight: '800', color: vColor, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>{vName}</div>
                                                <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>{reason}</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', color: '#64748b' }}>
                                                    <Clock size={10} />
                                                    <span style={{ fontSize: '10px', fontWeight: '600' }}>
                                                        {s.allDay ? 'Intera Giornata' : ${s.startTime?.substring(0,5)} - }
                                                    </span>
                                                </div>
                                                {s.notes && <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px', fontStyle: 'italic' }}>"{s.notes}"</div>}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {sidebarTab === 'approvals' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {pendingSchedules.length === 0 ? (
                                <div style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>
                                    Nessuna richiesta in sospeso
                                </div>
                            ) : (
                                pendingSchedules.map(s => {
                                    const v = vessels?.find(vx => vx.id === s.vesselId);
                                    const vName = v ? v.name : 'Sconosciuta';
                                    const reason = standbyReasons.find(r => r.id === s.reasonId)?.reason_name || s.reasonId;
                                    const reqDate = toDateStr(new Date(s.createdAt || s.date));

                                    return (
                                        <div key={s.id} style={{ background: '#fff', border: '1px solid #fee2e2', borderRadius: '8px', overflow: 'hidden' }}>
                                            <div style={{ background: '#fef2f2', padding: '8px 12px', borderBottom: '1px solid #fee2e2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '10px', fontWeight: '800', color: '#ef4444', textTransform: 'uppercase' }}>Richiesta del {reqDate}</span>
                                            </div>
                                            <div style={{ padding: '12px' }}>
                                                <div style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '2px' }}>{vName}</div>
                                                <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>{reason}</div>
                                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Data: <strong>{new Date(s.date).toLocaleDateString()}</strong></div>
                                                <div style={{ fontSize: '11px', color: '#64748b' }}>Orario: {s.allDay ? 'Tutto il giorno' : ${s.startTime?.substring(0,5)} - }</div>
                                                {s.notes && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontStyle: 'italic' }}>"{s.notes}"</div>}
                                                
                                                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                                    <button 
                                                        onClick={() => approveSchedule(s.id, profile.id)}
                                                        className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white text-[10px] font-black uppercase rounded-lg transition-colors"
                                                    >
                                                        Approva
                                                    </button>
                                                    <button 
                                                        onClick={() => rejectSchedule(s.id, profile.id)}
                                                        className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase rounded-lg transition-colors"
                                                    >
                                                        Rifiuta
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

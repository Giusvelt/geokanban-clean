import React, { useMemo } from 'react';
import { AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import { useData } from '../context/DataContext';

export default function TelemetryAlertBanner() {
    const { vesselPositions, profile, crewVesselId, companyVesselIds, vessels } = useData();

    // 1. Filter positions according to tenant role permissions (SOLID)
    const activeGaps = useMemo(() => {
        if (!vesselPositions || !profile || !vessels) return [];
        
        // Mappa delle navi attive per filtering
        const activeVesselIds = new Set(vessels.filter(v => v.tracking_active).map(v => v.id));

        let scopedPositions = vesselPositions.filter(p => activeVesselIds.has(p.vesselId));
        
        if (profile.role === 'crew' && crewVesselId) {
            scopedPositions = scopedPositions.filter(p => p.vesselId === crewVesselId);
        } else if (profile.role === 'crew_admin' && companyVesselIds) {
            scopedPositions = scopedPositions.filter(p => companyVesselIds.includes(p.vesselId));
        }

        const now = new Date();
        const gaps = [];

        scopedPositions.forEach(pos => {
            if (!pos.lastUpdate) {
                gaps.push({
                    vessel: pos.vessel,
                    vesselId: pos.vesselId,
                    hours: null,
                    lastSeen: 'never'
                });
                return;
            }

            const diffMs = now - new Date(pos.lastUpdate);
            const diffHours = diffMs / (1000 * 60 * 60);

            if (diffHours >= 24) {
                gaps.push({
                    vessel: pos.vessel,
                    vesselId: pos.vesselId,
                    hours: Math.round(diffHours),
                    lastSeen: new Date(pos.lastUpdate).toLocaleString('en-GB')
                });
            }
        });

        return gaps;
    }, [vesselPositions, profile, crewVesselId, companyVesselIds]);

    if (!activeGaps.length) return null;

    return (
        <div className="w-full bg-gradient-to-r from-amber-500/10 via-amber-600/10 to-amber-500/10 backdrop-blur-md border-b border-amber-500/20 py-2.5 px-4 animate-pulse flex flex-col md:flex-row items-center justify-center gap-3">
            <div className="flex items-center gap-2 text-amber-600 text-xs font-black uppercase tracking-wider">
                <AlertTriangle size={15} className="animate-bounce" />
                <span>Telemetry Blackout Detected</span>
            </div>
            
            <div className="flex-1 flex flex-wrap justify-center gap-x-6 gap-y-1">
                {activeGaps.map((gap, i) => (
                    <div key={gap.vesselId} className="flex items-center gap-2 text-[11px] font-bold text-slate-700">
                        <span className="bg-amber-500 text-white text-[9px] px-1.5 py-0.5 rounded font-black">{gap.vessel}</span>
                        <span>
                            {gap.hours === null ? (
                                'No AIS signal loaded'
                            ) : (
                                <>Incommunicado for <b className="text-amber-700 font-extrabold">{gap.hours}h</b> (Last: {gap.lastSeen})</>
                            )}
                        </span>
                        {i < activeGaps.length - 1 && <span className="text-slate-300">|</span>}
                    </div>
                ))}
            </div>

            <div className="text-[10px] text-amber-700 font-black uppercase tracking-widest flex items-center gap-1">
                <span>Manual Entry Required</span>
                <ArrowRight size={10} />
            </div>
        </div>
    );
}

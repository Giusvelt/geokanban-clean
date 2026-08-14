import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle, Clock, X, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useFleet, useConfig } from '../context/DataContext';

export default function TelemetryStatusIndicator() {
    const { vesselPositions, crewVesselId, companyVesselIds, vessels } = useFleet();
    const { profile } = useConfig();
    const [isOpen, setIsOpen] = useState(false);

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

    const isHealthy = activeGaps.length === 0;

    return (
        <div className="relative">
            {/* LED Status Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                title={isHealthy ? "Telemetry Status: Operational" : `Telemetry Alert: ${activeGaps.length} Vessels Incommunicado`}
                className={`w-10 h-10 rounded-full bg-white border flex items-center justify-center shadow-sm active:scale-95 transition-all relative cursor-pointer ${
                    isOpen ? 'border-primary/30 ring-2 ring-primary/10' : 'border-slate-100 hover:bg-slate-50 hover:shadow'
                }`}
            >
                {/* Glowing animation rings based on status */}
                <div className="w-3 h-3 rounded-full relative flex items-center justify-center">
                    {!isHealthy && (
                        <span className="absolute inline-flex h-full w-full rounded-full bg-rose-500 animate-ping opacity-75" />
                    )}
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                        isHealthy ? 'bg-emerald-500' : 'bg-rose-500'
                    }`} />
                </div>
            </button>

            {/* Dropdown Popover Panel */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Invisible overlay to capture click outside and close, without blocking screen/header */}
                        <div 
                            className="fixed inset-0 z-[998]" 
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Floating Popover Container */}
                        <motion.div 
                            initial={{ opacity: 0, y: 15, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 15, scale: 0.95 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            className="absolute right-0 top-12 z-[999] w-[380px] sm:w-[420px] bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden flex flex-col font-manrope origin-top-right"
                        >
                            {/* Small Arrow indicator on top of the popover */}
                            <div className="absolute right-4 -top-1.5 w-3 h-3 bg-white rotate-45 border-t border-l border-slate-100" />

                            {/* Header */}
                            <div className={`p-4 text-white flex items-center justify-between relative z-10 ${
                                isHealthy 
                                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600' 
                                    : 'bg-gradient-to-r from-rose-600 to-orange-600'
                            }`}>
                                <div className="flex items-center gap-2.5">
                                    {isHealthy ? (
                                        <ShieldCheck size={20} className="text-white/90" />
                                    ) : (
                                        <ShieldAlert size={20} className="text-white/90 animate-pulse" />
                                    )}
                                    <div>
                                        <h3 className="font-extrabold text-xs tracking-tight text-white leading-none mb-0.5">
                                            Telemetry Status
                                        </h3>
                                        <p className="text-[8px] text-white/70 font-black uppercase tracking-widest leading-none">
                                            {isHealthy ? 'All Systems Online' : 'Telemetry Blackout Detected'}
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                                >
                                    <X size={12} />
                                </button>
                            </div>

                            {/* Body (Scrollable if there are many vessels) */}
                            <div className="p-4 overflow-y-auto max-h-[350px] flex flex-col gap-3">
                                {isHealthy ? (
                                    /* Healthy State */
                                    <div className="flex flex-col items-center justify-center py-6 px-2 text-center">
                                        <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500 mb-3 shadow-inner">
                                            <CheckCircle size={24} />
                                        </div>
                                        <h4 className="font-bold text-slate-800 text-xs mb-1">Fleet Telemetry Operational</h4>
                                        <p className="text-[10px] text-slate-500 max-w-xs leading-normal">
                                            All active fleet vessels are currently broadcasting stable AIS signals. Geofencing status is fully accurate.
                                        </p>
                                    </div>
                                ) : (
                                    /* Alert State */
                                    <div className="flex flex-col gap-2.5">
                                        <div className="bg-rose-50 border border-rose-100/50 rounded-2xl p-3 text-rose-800 flex gap-2.5 items-start">
                                            <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                                            <div>
                                                <h4 className="font-extrabold text-[10px] tracking-tight text-rose-900 leading-none mb-0.5 uppercase">
                                                    Manual Logbook Override
                                                </h4>
                                                <p className="text-[10px] text-rose-700/80 leading-normal font-semibold">
                                                    {activeGaps.length} vessel{activeGaps.length > 1 ? 's are' : ' is'} currently incommunicado. Declare cycles manually in the tabs below or check tracking periods in the Vessel Master Data.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">
                                                Incommunicado Vessels:
                                            </p>
                                            
                                            {activeGaps.map((gap) => (
                                                <div 
                                                    key={gap.vesselId} 
                                                    className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-100 rounded-2xl transition-colors gap-2"
                                                >
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="bg-rose-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded tracking-wider uppercase">
                                                                {gap.vessel}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1 text-[10px] text-slate-600 font-semibold mt-0.5">
                                                            <Clock size={10} className="text-slate-400" />
                                                            {gap.hours === null ? (
                                                                <span>No AIS signal loaded</span>
                                                            ) : (
                                                                <span>Offline for <b className="text-rose-600 font-extrabold">{gap.hours}h</b></span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {gap.hours !== null && (
                                                        <div className="text-right">
                                                            <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest leading-none mb-0.5">Last Seen</p>
                                                            <p className="text-[9px] text-slate-700 font-bold leading-none">{gap.lastSeen.split(',')[0]}</p>
                                                            <p className="text-[8px] text-slate-400 font-semibold leading-none mt-0.5">{gap.lastSeen.split(',')[1]?.trim()}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
                                <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider">
                                    GeoKanban v3.25
                                </span>
                                <button 
                                    onClick={() => setIsOpen(false)}
                                    className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow active:scale-95 cursor-pointer"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Anchor, X, AlertTriangle, CheckCircle, Waves, Wind, ShieldAlert } from 'lucide-react';
import { useFleet, useOperations } from '../context/DataContext';
import { validateMooring } from '../utils/mooringSafety';

export default function MooringStatusIndicator() {
    const { vessels } = useFleet();
    const { activities } = useOperations();
    const [isOpen, setIsOpen] = useState(false);
    const [forecast, setForecast] = useState([]);
    const [loading, setLoading] = useState(true);

    // 1. Fetch 3-Day Forecast for Genova Scanno Diga
    useEffect(() => {
        async function fetchForecast() {
            try {
                const lat = 44.399;
                const lon = 8.890;
                const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=wave_height,wave_direction&timezone=auto&forecast_days=3`;
                const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kn&timezone=auto&forecast_days=3`;

                const [marineRes, forecastRes] = await Promise.all([
                    fetch(marineUrl),
                    fetch(forecastUrl)
                ]);

                const mData = await marineRes.json();
                const fData = await forecastRes.json();

                const times = mData.hourly.time;
                const waves = mData.hourly.wave_height;
                const waveDirs = mData.hourly.wave_direction;
                const winds = fData.hourly.wind_speed_10m;
                const windDirs = fData.hourly.wind_direction_10m;

                const combined = [];
                for (let i = 0; i < times.length; i++) {
                    combined.push({
                        time: times[i],
                        wave: waves[i] || 0,
                        waveDir: waveDirs[i] || 0,
                        wind: winds[i] || 0,
                        windDir: windDirs[i] || 0
                    });
                }
                setForecast(combined);
            } catch (err) {
                console.error("Error fetching forecast for MooringStatusIndicator:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchForecast();
    }, []);

    // 2. Find active mooring alerts
    const alerts = useMemo(() => {
        if (loading || forecast.length === 0 || !activities || !vessels) return [];

        const activeMooredActivities = activities.filter(a => {
            const isTargetBerth = ['T1', 'T2', 'T3', 'T5', 'T6', 'T7'].some(berth => 
                a.geofence && a.geofence.toUpperCase().includes(berth)
            );
            return a.status === 'in-progress' && isTargetBerth;
        });

        const mooringAlerts = [];

        activeMooredActivities.forEach(act => {
            const vesselObj = vessels.find(v => v.id === act.vesselId || v.name?.toUpperCase() === act.vessel?.toUpperCase());
            const grossTonnage = vesselObj?.gross_ton_value || vesselObj?.gross_tonnage || 0;
            if (!grossTonnage) return;

            // Determine berth and mooring heading
            let berth = 'T1';
            let mooringHeading = 18;
            const geoUpper = act.geofence.toUpperCase();

            if (geoUpper.includes('T2')) {
                berth = 'T2';
                mooringHeading = 44;
            } else if (geoUpper.includes('T3')) {
                berth = 'T3';
                mooringHeading = 44;
            } else if (geoUpper.includes('T5')) {
                berth = 'T5';
                mooringHeading = 22;
            } else if (geoUpper.includes('T6')) {
                berth = 'T6';
                mooringHeading = 24;
            } else if (geoUpper.includes('T7')) {
                berth = 'T7';
                mooringHeading = 21;
            }

            // Find first violating hour in the next 3 days
            for (const f of forecast) {
                const result = validateMooring({
                    grossTonnage,
                    berth,
                    waveDir: f.waveDir,
                    mooringHeading,
                    hs: f.wave,
                    windSpeed: f.wind
                });

                if (result.status === 'NEGATIVO' || result.status === 'ERRORE') {
                    const alertTime = new Date(f.time);
                    mooringAlerts.push({
                        vessel: act.vessel,
                        berth: act.geofence,
                        time: alertTime.toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
                        status: result.status,
                        wave: f.wave,
                        wind: f.wind,
                        reason: result.message
                    });
                    break; 
                }
            }
        });

        return mooringAlerts;
    }, [activities, vessels, forecast, loading]);

    const hasAlert = alerts.length > 0;

    return (
        <div className="relative">
            {/* LED Status Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                title={hasAlert ? "Rilevato Rischio Disormeggio RINA" : "Stato Ormeggi: Sicuro"}
                className={`w-10 h-10 rounded-full bg-white border flex items-center justify-center shadow-sm active:scale-95 transition-all relative cursor-pointer ml-2 ${
                    isOpen ? 'border-primary/30 ring-2 ring-primary/10' : 'border-slate-100 hover:bg-slate-50 hover:shadow'
                }`}
            >
                {/* Glowing animation rings based on status */}
                <div className="w-3 h-3 rounded-full relative flex items-center justify-center">
                    {hasAlert && (
                        <span className="absolute inline-flex h-full w-full rounded-full bg-rose-500 animate-ping opacity-75" />
                    )}
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                        hasAlert ? 'bg-rose-500' : 'bg-emerald-500'
                    }`} />
                </div>
                {!loading && <Anchor size={12} className={`absolute ${hasAlert ? 'text-rose-700' : 'text-emerald-700'} opacity-50 -bottom-0.5 -right-0.5`} />}
            </button>

            {/* Dropdown Popover Panel */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Invisible overlay */}
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
                            className="absolute right-0 top-12 z-[999] w-[350px] sm:w-[400px] bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden flex flex-col font-manrope origin-top-right"
                        >
                            <div className="absolute right-4 -top-1.5 w-3 h-3 bg-white rotate-45 border-t border-l border-slate-100" />

                            {/* Header */}
                            <div className={`p-4 text-white flex items-center justify-between relative z-10 ${
                                hasAlert 
                                    ? 'bg-gradient-to-r from-red-500 to-rose-600' 
                                    : 'bg-gradient-to-r from-emerald-500 to-teal-600'
                            }`}>
                                <div className="flex items-center gap-2.5">
                                    {hasAlert ? (
                                        <ShieldAlert size={20} className="text-white/90 animate-pulse" />
                                    ) : (
                                        <CheckCircle size={20} className="text-white/90" />
                                    )}
                                    <div>
                                        <h3 className="font-extrabold text-xs tracking-tight text-white leading-none mb-0.5">
                                            Rischio Ormeggi RINA
                                        </h3>
                                        <p className="text-[8px] text-white/70 font-black uppercase tracking-widest leading-none">
                                            {hasAlert ? 'Disormeggio Consigliato' : 'Tutti gli ormeggi sono sicuri'}
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

                            {/* Body */}
                            <div className="p-4 overflow-y-auto max-h-[350px] flex flex-col gap-3">
                                {loading ? (
                                    <div className="py-6 text-center text-xs text-slate-400 font-bold uppercase tracking-widest animate-pulse">
                                        Caricamento ormeggi...
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {hasAlert ? (
                                            <div className="flex flex-col gap-2">
                                                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">
                                                    Navi ormeggiate a rischio disormeggio:
                                                </p>
                                                {alerts.map((alert, idx) => (
                                                    <div key={idx} className="bg-rose-50 border border-rose-100/50 rounded-2xl p-3 text-rose-800 flex gap-2.5 items-start">
                                                        <AlertTriangle size={16} className="text-rose-500 shrink-0 mt-0.5 animate-pulse" />
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="bg-rose-500 text-white text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider">{alert.vessel}</span>
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{alert.berth}</span>
                                                            </div>
                                                            <p className="text-[10px] text-rose-700/80 leading-normal font-semibold">
                                                                Previsto superamento limiti il giorno <b className="text-rose-900">{alert.time}</b>.
                                                                <br />
                                                                <span className="text-[9px] block mt-1 italic text-rose-600">
                                                                    ({alert.reason} - Vento: {alert.wind.toFixed(0)}kn, Onda: {alert.wave.toFixed(1)}m)
                                                                </span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="py-4 flex flex-col items-center justify-center text-slate-400 gap-2">
                                                <CheckCircle size={28} className="text-emerald-500/50" />
                                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Nessuna criticità ormeggi</p>
                                                <p className="text-[9px] text-slate-400 text-center max-w-[280px]">
                                                    Tutte le navi attualmente ormeggiate rientrano nei limiti di sicurezza RINA stabiliti per le prossime 72 ore.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
                                <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider flex items-center gap-1">
                                    <Anchor size={10} /> Prescrizioni RINA Cantiere
                                </span>
                                <button 
                                    onClick={() => setIsOpen(false)}
                                    className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow active:scale-95 cursor-pointer"
                                >
                                    Chiudi
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

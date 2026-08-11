import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, X, AlertTriangle, CheckCircle, Navigation, Waves, Wind } from 'lucide-react';

export default function WeatherStatusIndicator() {
    const [isOpen, setIsOpen] = useState(false);
    const [forecast, setForecast] = useState([]);
    const [hasAlert, setHasAlert] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchForecast() {
            try {
                // Genova Scanno Diga coordinates
                const lat = 44.399;
                const lon = 8.890;
                const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=wave_height&timezone=auto&forecast_days=3`;
                const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m&wind_speed_unit=kn&timezone=auto&forecast_days=3`;
                
                const [marineRes, forecastRes] = await Promise.all([
                    fetch(marineUrl),
                    fetch(forecastUrl)
                ]);

                const mData = await marineRes.json();
                const fData = await forecastRes.json();

                const times = mData.hourly.time;
                const waves = mData.hourly.wave_height;
                const winds = fData.hourly.wind_speed_10m;

                const combined = [];
                let alertFound = false;

                for (let i = 0; i < times.length; i++) {
                    const wave = waves[i] || 0;
                    const wind = winds[i] || 0;
                    combined.push({
                        time: times[i],
                        wave,
                        wind
                    });

                    if (wave > 1.0) {
                        alertFound = true;
                    }
                }

                setForecast(combined);
                setHasAlert(alertFound);
            } catch (err) {
                console.error("Error fetching marine forecast", err);
            } finally {
                setLoading(false);
            }
        }
        fetchForecast();
    }, []);

    // Raggruppa per giorni se si apre il popover
    const daysForecast = [];
    if (forecast.length > 0) {
        let currentDay = '';
        let dayData = null;

        forecast.forEach(f => {
            const date = new Date(f.time);
            const dayString = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
            
            if (dayString !== currentDay) {
                if (dayData) daysForecast.push(dayData);
                currentDay = dayString;
                dayData = { date: dayString, maxWave: 0, maxWind: 0, alerts: [] };
            }

            if (f.wave > dayData.maxWave) dayData.maxWave = f.wave;
            if (f.wind > dayData.maxWind) dayData.maxWind = f.wind;

            if (f.wave > 1.0) {
                dayData.alerts.push({
                    time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                    wave: f.wave
                });
            }
        });
        if (dayData) daysForecast.push(dayData);
    }

    return (
        <div className="relative">
            {/* LED Status Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                title={hasAlert ? "Weather Alert: High Waves Forecasted" : "Weather Status: Clear"}
                className={`w-10 h-10 rounded-full bg-white border flex items-center justify-center shadow-sm active:scale-95 transition-all relative cursor-pointer ml-2 ${
                    isOpen ? 'border-primary/30 ring-2 ring-primary/10' : 'border-slate-100 hover:bg-slate-50 hover:shadow'
                }`}
            >
                {/* Glowing animation rings based on status */}
                <div className="w-3 h-3 rounded-full relative flex items-center justify-center">
                    {hasAlert && (
                        <span className="absolute inline-flex h-full w-full rounded-full bg-amber-500 animate-ping opacity-75" />
                    )}
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                        hasAlert ? 'bg-amber-500' : 'bg-cyan-500'
                    }`} />
                </div>
                {!loading && <Cloud size={14} className={`absolute ${hasAlert ? 'text-amber-700' : 'text-cyan-700'} opacity-50 -bottom-1 -right-1`} />}
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
                            className="absolute right-0 top-12 z-[999] w-[380px] sm:w-[420px] bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden flex flex-col font-manrope origin-top-right"
                        >
                            <div className="absolute right-4 -top-1.5 w-3 h-3 bg-white rotate-45 border-t border-l border-slate-100" />

                            {/* Header */}
                            <div className={`p-4 text-white flex items-center justify-between relative z-10 ${
                                hasAlert 
                                    ? 'bg-gradient-to-r from-amber-500 to-orange-600' 
                                    : 'bg-gradient-to-r from-cyan-500 to-blue-600'
                            }`}>
                                <div className="flex items-center gap-2.5">
                                    {hasAlert ? (
                                        <AlertTriangle size={20} className="text-white/90 animate-pulse" />
                                    ) : (
                                        <CheckCircle size={20} className="text-white/90" />
                                    )}
                                    <div>
                                        <h3 className="font-extrabold text-xs tracking-tight text-white leading-none mb-0.5">
                                            Marine Forecast (Genoa)
                                        </h3>
                                        <p className="text-[8px] text-white/70 font-black uppercase tracking-widest leading-none">
                                            {hasAlert ? 'Predictive Stand-by Suggested' : 'Clear Weather for 72h'}
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
                                        Loading forecast...
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {hasAlert && (
                                            <div className="bg-amber-50 border border-amber-100/50 rounded-2xl p-3 text-amber-800 flex gap-2.5 items-start">
                                                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                                                <div>
                                                    <h4 className="font-extrabold text-[10px] tracking-tight text-amber-900 leading-none mb-0.5 uppercase">
                                                        Stand-by Warning
                                                    </h4>
                                                    <p className="text-[10px] text-amber-700/80 leading-normal font-semibold">
                                                        Waves exceeding 1.0m are predicted. Please consider scheduling a Weather Stand-by in the Schedule Tab to protect production KPIs.
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1 mt-2">
                                            72-Hour Outlook:
                                        </p>
                                        
                                        {daysForecast.map((day, idx) => (
                                            <div key={idx} className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                                                <div className="flex items-center justify-between border-b border-slate-200/50 pb-2 mb-1">
                                                    <span className="text-xs font-extrabold text-slate-700">{day.date}</span>
                                                    <div className="flex gap-3">
                                                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-600">
                                                            <Wind size={12} className="text-amber-500" />
                                                            {day.maxWind.toFixed(0)} kn max
                                                        </div>
                                                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-600">
                                                            <Waves size={12} className={day.maxWave > 1.0 ? 'text-rose-500' : 'text-cyan-500'} />
                                                            {day.maxWave.toFixed(1)} m max
                                                        </div>
                                                    </div>
                                                </div>
                                                {day.alerts.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {day.alerts.map((alert, i) => (
                                                            <span key={i} className="bg-rose-100 text-rose-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                                {alert.time} ({alert.wave.toFixed(1)}m)
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-[9px] font-bold text-slate-400 italic">No wave alerts for this day.</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
                                <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider flex items-center gap-1">
                                    <Cloud size={10} /> Open-Meteo Marine
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

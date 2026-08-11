import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Cloud, Wind, Waves, Thermometer, AlertTriangle, CheckCircle, Clock, Calendar, ShieldAlert, Anchor, ArrowUp, Navigation } from 'lucide-react';
import { validateMooring } from '../utils/mooringSafety';

export default function YardForecastsTab() {
    const { vessels, activities, productionPlans, selectedMonth, selectedYear } = useData();
    const [forecast, setForecast] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDwtClass, setSelectedDwtClass] = useState('7300'); // '40000', '7300', '5270'
    const [selectedDayTab, setSelectedDayTab] = useState(0); // 0 = Oggi, 1 = Domani, 2 = Dopodomani

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const currentPeriod = `${MONTHS[selectedMonth]} ${selectedYear}`;

    const cumulativeDelayMinutes = useMemo(() => {
        const currentPlans = (productionPlans || []).filter(p => p.period_name === currentPeriod && p.vessel_id !== null);
        return currentPlans.reduce((sum, p) => sum + (p.total_waiting_minutes || 0), 0);
    }, [productionPlans, currentPeriod]);
    
    const cumulativeDelayHours = Math.round(cumulativeDelayMinutes / 60);

    // Coordinates for Scanno Diga
    const lat = 44.399;
    const lon = 8.890;

    useEffect(() => {
        async function fetchForecast() {
            try {
                const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=wave_height,wave_direction&timezone=auto&forecast_days=3`;
                const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m,wind_direction_10m,temperature_2m,weather_code&wind_speed_unit=kn&timezone=auto&forecast_days=3`;

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
                const temps = fData.hourly.temperature_2m;
                const codes = fData.hourly.weather_code;

                const combined = [];
                for (let i = 0; i < times.length; i++) {
                    combined.push({
                        time: times[i],
                        wave: waves[i] || 0,
                        waveDir: waveDirs[i] || 0,
                        wind: winds[i] || 0,
                        windDir: windDirs[i] || 0,
                        temp: temps[i] || 0,
                        code: codes[i] || 0
                    });
                }
                setForecast(combined);
            } catch (err) {
                console.error("Error fetching forecast for Yard Forecasts:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchForecast();
    }, []);

    // Get Wind Direction string
    const getWindDirectionCardinal = (deg) => {
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const index = Math.round(deg / 22.5) % 16;
        return `${Math.round(deg)}° ${directions[index]}`;
    };

    // Group forecast by days
    const forecastByDay = useMemo(() => {
        if (forecast.length === 0) return [];

        const days = [];
        let currentDayIndex = -1;
        let lastDateStr = '';

        forecast.forEach(f => {
            const date = new Date(f.time);
            const dateStr = date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });

            if (dateStr !== lastDateStr) {
                currentDayIndex++;
                lastDateStr = dateStr;
                days.push({
                    dateLabel: dateStr,
                    hours: [],
                    maxWave: 0,
                    maxWind: 0,
                    hasStandbyAlert: false
                });
            }

            if (f.wave > days[currentDayIndex].maxWave) days[currentDayIndex].maxWave = f.wave;
            if (f.wind > days[currentDayIndex].maxWind) days[currentDayIndex].maxWind = f.wind;
            if (f.wave > 1.0) days[currentDayIndex].hasStandbyAlert = true;

            days[currentDayIndex].hours.push(f);
        });

        return days;
    }, [forecast]);

    // Berths definition
    const berths = [
        { id: 'T1', name: 'Scanno Diga T1', heading: 18 },
        { id: 'T2', name: 'Scanno Diga T2', heading: 44 },
        { id: 'T3', name: 'Scanno Diga T3', heading: 44 },
        { id: 'T5', name: 'Scanno Diga T5', heading: 22 },
        { id: 'T6', name: 'Scanno Diga T6', heading: 24 },
        { id: 'T7', name: 'Scanno Diga T7', heading: 21 }
    ];

    if (loading) {
        return (
            <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-4">
                <Clock className="w-10 h-10 animate-spin text-sky-500" />
                <p className="text-xs font-bold uppercase tracking-wider">Caricamento Previsioni di Cantiere...</p>
            </div>
        );
    }

    const activeDay = forecastByDay[selectedDayTab];

    return (
        <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] border border-white shadow-xl p-8 sm:p-12 w-full transition-all duration-300 space-y-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-sky-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
                        <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight">Yard Forecasts</h2>
                        <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mt-0.5">Meteo, Stand-by & Prescrizioni Ormeggio RINA</p>
                    </div>
                </div>

                {/* Day selector tabs */}
                <div className="flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/50">
                    {forecastByDay.map((day, idx) => (
                        <button
                            key={idx}
                            onClick={() => setSelectedDayTab(idx)}
                            className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all duration-200 capitalize ${
                                selectedDayTab === idx
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            {idx === 0 ? 'Oggi' : idx === 1 ? 'Domani' : day.dateLabel}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid 1: Meteo & Stand-by Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* Weather card */}
                <div className="md:col-span-4 bg-gradient-to-br from-slate-50 to-white border border-slate-100 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meteo Massimo Giornaliero</span>
                            <span className="text-[9px] font-bold text-sky-500 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-full uppercase tracking-wider">{activeDay?.dateLabel}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-6 my-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0 shadow-sm">
                                    <Waves className="w-5 h-5" />
                                </div>
                                <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Onda Max</span>
                                    <span className="text-lg font-black text-slate-700">{activeDay?.maxWave.toFixed(1)} m</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 shadow-sm">
                                    <Wind className="w-5 h-5" />
                                </div>
                                <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Vento Max</span>
                                    <span className="text-lg font-black text-slate-700">{activeDay?.maxWind.toFixed(0)} kn</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 border-t border-slate-100 pt-3 flex items-center gap-1.5">
                        <Clock size={11} />
                        <span>Aggiornato in tempo reale tramite Open-Meteo Marine API</span>
                    </div>
                </div>

                {/* Stand-by prediction card */}
                <div className="md:col-span-4 bg-gradient-to-br from-indigo-50/20 to-white border border-indigo-100/50 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Stato Stand-by Meteo</span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                activeDay?.hasStandbyAlert
                                    ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                    : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}>
                                {activeDay?.hasStandbyAlert ? 'Rischio Onde' : 'Sicuro / Operativo'}
                            </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-500 leading-normal my-3">
                            {activeDay?.hasStandbyAlert
                                ? 'Attenzione: sono previste onde superiori a 1.0m durante la giornata. Si consiglia di programmare stand-by meteo precauzionali per evitare di danneggiare i KPI di produzione.'
                                : 'Le condizioni dell\'onda a Scanno Diga sono ottimali (inferiori a 1.0m). Non è richiesto alcuno standby meteo per oggi.'}
                        </p>
                    </div>
                    {activeDay?.hasStandbyAlert && (
                        <div className="flex items-center gap-2 bg-rose-50 border border-rose-100/50 rounded-2xl p-2.5 mt-2">
                            <AlertTriangle size={14} className="text-rose-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Picco onda previsto: {activeDay.maxWave.toFixed(1)}m</span>
                        </div>
                    )}
                </div>

                {/* Cumulative Delay card */}
                <div className="md:col-span-4 bg-gradient-to-br from-amber-50/20 to-white border border-amber-100/50 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Ritardo Cumulativo</span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                cumulativeDelayMinutes > 120 ? 'bg-rose-100 text-rose-700 border border-rose-200' : 
                                cumulativeDelayMinutes > 0 ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}>
                                {currentPeriod}
                            </span>
                        </div>
                        <div className="flex items-center gap-4 my-4">
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 shadow-sm border border-amber-100/50">
                                <Clock className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="text-2xl font-black text-slate-700 leading-none block mb-1">
                                    {cumulativeDelayHours} <span className="text-sm text-slate-400">ore</span>
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    {cumulativeDelayMinutes.toLocaleString()} minuti d'attesa in rada
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 border-t border-slate-100 pt-3 flex items-center gap-1.5 mt-2">
                        <AlertTriangle size={11} className="text-amber-500 shrink-0" />
                        <span className="leading-tight">Somma dei ritardi di tutta la flotta nel periodo.</span>
                    </div>
                </div>
            </div>



            {/* Grid 3: Detailed hourly weather grid */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider">Dettaglio Orario delle Previsioni</h3>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Passo 3 ore — {activeDay?.dateLabel}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {activeDay?.hours.filter((_, i) => i % 3 === 0).map((hour, idx) => {
                        const date = new Date(hour.time);
                        const timeStr = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                        return (
                            <div key={idx} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Clock size={12} className="text-slate-400" />
                                        <span className="text-xs font-black text-slate-700 leading-none">{timeStr}</span>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
                                            <Waves size={10} className="text-cyan-400" />
                                            <span>Onda: {hour.wave.toFixed(1)} m</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
                                            <Wind size={10} className="text-amber-400" />
                                            <span>Vento: {hour.wind.toFixed(0)} kn</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-center gap-1 shrink-0">
                                    <div className="relative w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center">
                                        <ArrowUp size={12} className="text-amber-500 transition-transform duration-300" 
                                            style={{ transform: `rotate(${hour.windDir}deg)` }} />
                                    </div>
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">
                                        {getWindDirectionCardinal(hour.windDir).split(' ')[1] || 'N'}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

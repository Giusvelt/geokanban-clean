import React, { useState, useEffect, useMemo } from 'react';
import { weatherService } from '../services/api/weatherService';
import { activityService } from '../services/api/activityService';
import { Cloud, Wind, Waves, Thermometer, Calendar, Navigation, ArrowUp, RefreshCw, Anchor, MapPin, AlertTriangle } from 'lucide-react';
import { validateMooring } from '../utils/mooringSafety';


export default function WeatherAnalyticsTab() {
    const [vessels, setVessels] = useState([]);
    const [selectedVessel, setSelectedVessel] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [weatherLogs, setWeatherLogs] = useState([]);
    const [genovaLogs, setGenovaLogs] = useState([]);
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hoveredPoint, setHoveredPoint] = useState(null);

    // Mooring calculator state
    const [calcDwt, setCalcDwt] = useState('7300');
    const [calcBerth, setCalcBerth] = useState('T1');
    const [calcWindDir, setCalcWindDir] = useState(180);
    const [calcMooringHeading, setCalcMooringHeading] = useState(18);
    const [calcHs, setCalcHs] = useState(0.5);
    const [calcWindSpeed, setCalcWindSpeed] = useState(12);

    // Auto-update heading based on Berth choice
    useEffect(() => {
        const berthHeadingMap = {
            'T1': 18,
            'T2': 44,
            'T3': 44,
            'T7': 21
        };
        if (berthHeadingMap[calcBerth] !== undefined) {
            setCalcMooringHeading(berthHeadingMap[calcBerth]);
        }
    }, [calcBerth]);


    // Carica le navi disponibili
    useEffect(() => {
        async function fetchVessels() {
            try {
                const data = await weatherService.fetchVessels();
                setVessels(data);
                if (data.length > 0) {
                    setSelectedVessel(data[0].id);
                }
            } catch (err) {
                console.error('Errore fetch vessels:', err.message);
            }
        }
        fetchVessels();

        // Imposta date predefinite (ultimi 7 giorni)
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 7);
        setEndDate(end.toISOString().split('T')[0]);
        setStartDate(start.toISOString().split('T')[0]);
    }, []);

    // Recupera i log meteo dal database
    const handleFetchLogs = async () => {
        if (!selectedVessel) return;
        setLoading(true);
        setHoveredPoint(null);

        try {
            const vessel = vessels.find(v => v.id === selectedVessel);
            const vName = vessel?.name || '';
            const vMmsi = vessel?.mmsi || null;

            const [weatherData, genovaData, acts] = await Promise.all([
                weatherService.fetchWeatherLogs(vName, vMmsi, startDate, endDate),
                weatherService.fetchGenovaRange(startDate, endDate),
                activityService.fetchActivitiesRange(selectedVessel, startDate, endDate),
            ]);

            setWeatherLogs(weatherData);
            setGenovaLogs(genovaData);
            setActivities(acts);
        } catch (err) {
            console.error("Errore fetch weather analytics:", err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedVessel && startDate && endDate) {
            handleFetchLogs();
        }
    }, [selectedVessel, startDate, endDate]);

    // KPI significativi per fleet tracking
    const stats = useMemo(() => {
        if (weatherLogs.length === 0) return null;
        const waves = weatherLogs.map(l => parseFloat(l.wave_height) || 0);
        const winds = weatherLogs.map(l => parseFloat(l.wind_speed) || 0);
        const roughSea = waves.filter(w => w > 1.0).length;
        const wind20 = winds.filter(w => w > 20).length;
        const wind30 = winds.filter(w => w > 30).length;
        const navActs = activities.filter(a => a.activity_type === 'Navigation');
        return {
            maxWave: Math.max(...waves).toFixed(1),
            maxWind: Math.max(...winds).toFixed(1),
            rilevazioni: weatherLogs.length,
            roughSeaPct: waves.length > 0 ? Math.round((roughSea / waves.length) * 100) : 0,
            wind20Pct: winds.length > 0 ? Math.round((wind20 / winds.length) * 100) : 0,
            wind30Pct: winds.length > 0 ? Math.round((wind30 / winds.length) * 100) : 0,
            navCount: navActs.length,
        };
    }, [weatherLogs, activities]);

    // Costruisce i punti del grafico SVG
    const chartData = useMemo(() => {
        if (weatherLogs.length < 2) return null;

        const width = 1000;
        const height = 300;
        const padding = 48;

        // Asse temporale: usa il range date selezionato come riferimento comune
        const timeMin = Math.min(
            new Date(weatherLogs[0].timestamp).getTime(),
            genovaLogs.length > 0 ? new Date(genovaLogs[0].timestamp).getTime() : Infinity
        );
        const timeMax = Math.max(
            new Date(weatherLogs[weatherLogs.length - 1].timestamp).getTime(),
            genovaLogs.length > 0 ? new Date(genovaLogs[genovaLogs.length - 1].timestamp).getTime() : 0
        );
        const timeRange = timeMax - timeMin || 1;

        const allWaves = [
            ...weatherLogs.map(l => parseFloat(l.wave_height) || 0),
            ...genovaLogs.map(l => parseFloat(l.wave_height) || 0),
        ];
        const allWinds = [
            ...weatherLogs.map(l => parseFloat(l.wind_speed) || 0),
            ...genovaLogs.map(l => parseFloat(l.wind_speed) || 0),
        ];
        const maxValWave = Math.max(...allWaves, 2);
        const maxValWind = Math.max(...allWinds, 20);

        const toX = (ts) => padding + ((new Date(ts).getTime() - timeMin) / timeRange) * (width - 2 * padding);
        const toYWave = (v) => height - padding - (v / maxValWave) * (height - 2 * padding);
        const toYWind = (v) => height - padding - (v / maxValWind) * (height - 2 * padding);

        // Vessel curves
        const pointsWave = weatherLogs.map((l, index) => ({
            x: toX(l.timestamp), y: toYWave(parseFloat(l.wave_height) || 0),
            val: parseFloat(l.wave_height) || 0, time: l.timestamp, log: l, index
        }));
        const pointsWind = weatherLogs.map((l, index) => ({
            x: toX(l.timestamp), y: toYWind(parseFloat(l.wind_speed) || 0),
            val: parseFloat(l.wind_speed) || 0, time: l.timestamp, log: l, index
        }));
        const pathWave = pointsWave.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        const pathWind = pointsWind.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        const areaWave = `${pathWave} L ${pointsWave[pointsWave.length - 1].x} ${height - padding} L ${pointsWave[0].x} ${height - padding} Z`;

        // Scanno Diga curves (ghost / transparent)
        const pointsGenovaWave = genovaLogs.map(l => ({
            x: toX(l.timestamp), y: toYWave(parseFloat(l.wave_height) || 0),
            val: parseFloat(l.wave_height) || 0, time: l.timestamp
        }));
        const pointsGenovaWind = genovaLogs.map(l => ({
            x: toX(l.timestamp), y: toYWind(parseFloat(l.wind_speed) || 0),
            val: parseFloat(l.wind_speed) || 0, time: l.timestamp
        }));
        const pathGenovaWave = pointsGenovaWave.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        const pathGenovaWind = pointsGenovaWind.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

        // 1. Fasce di sfondo colorate per le attività della nave
        const activityBands = [];
        activities.forEach(act => {
            const tStart = new Date(act.start_time).getTime();
            const tEnd = act.end_time ? new Date(act.end_time).getTime() : new Date().getTime();

            const visibleStart = Math.max(tStart, timeMin);
            const visibleEnd = Math.min(tEnd, timeMax);

            if (visibleStart < visibleEnd) {
                const xStart = toX(visibleStart);
                const xEnd = toX(visibleEnd);

                const colorMap = {
                    'Loading': '#dcfce7',      // green-100 (molto chiaro)
                    'Unloading': '#fef9c3',    // yellow-100 (molto chiaro)
                    'Navigation': '#dbeafe',   // blue-100 (molto chiaro)
                    'Anchorage': '#f3e8ff',    // purple-100 (molto chiaro)
                    'Stand-by': '#f1f5f9',     // slate-100 (molto chiaro)
                    'Weather Stand-by': '#e2e8f0', // slate-200 (più scuro per risaltare)
                };

                activityBands.push({
                    x: xStart,
                    width: xEnd - xStart,
                    type: act.activity_type,
                    label: act.activity_type + (act.geofence ? ` (${act.geofence})` : ''),
                    color: colorMap[act.activity_type] || '#f8fafc',
                });
            }
        });

        // 2. Etichette navigazione: porto da → porto a
        const activityLabels = [];
        activities.forEach(act => {
            if (act.activity_type !== 'Navigation') return;
            const tStart = new Date(act.start_time).getTime();
            const tEnd = act.end_time ? new Date(act.end_time).getTime() : null;

            const fromName = act.geofence_from?.name;
            const toName = act.geofence_to?.name;

            // Etichetta di partenza (inizio tratta)
            if (tStart >= timeMin && tStart <= timeMax) {
                activityLabels.push({
                    x: toX(act.start_time),
                    type: 'departure',
                    label: `⚓ ${fromName || 'PARTENZA'} ${toName ? '➔ ' + toName : ''}`,
                    time: act.start_time,
                });
            }

            // Etichetta di arrivo (fine tratta), se nel range
            if (tEnd && tEnd >= timeMin && tEnd <= timeMax) {
                activityLabels.push({
                    x: toX(act.end_time),
                    type: 'arrival',
                    label: `🏁 ${toName || 'ARRIVO'}`,
                    time: act.end_time,
                });
            }
        });

        return {
            width, height, padding,
            pointsWave, pointsWind, pathWave, pathWind, areaWave,
            pointsGenovaWave, pointsGenovaWind, pathGenovaWave, pathGenovaWind,
            maxValWave, maxValWind, activityLabels, activityBands, timeMin, timeMax
        };
    }, [weatherLogs, genovaLogs, activities]);

    return (
        <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] border border-white shadow-xl p-8 sm:p-12 w-full transition-all duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white">
                        <Cloud className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight">Analisi Meteo di Navigazione</h2>
                        <p className="text-xs font-bold text-sky-500 uppercase tracking-widest mt-0.5">Route Weather Analytics — Open-Meteo</p>
                    </div>
                </div>

                {/* Filtri */}
                <div className="flex flex-wrap items-center gap-3 bg-slate-50/50 p-2 rounded-3xl border border-slate-100">
                    <select
                        value={selectedVessel}
                        onChange={(e) => setSelectedVessel(e.target.value)}
                        className="bg-white border border-slate-200 rounded-2xl px-4 py-2 text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer"
                    >
                        {vessels.map(v => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                    </select>

                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-3 py-1.5 shadow-sm">
                        <Calendar size={14} className="text-slate-400" />
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer" />
                        <span className="text-slate-300 text-xs">➔</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer" />
                    </div>

                    <button onClick={handleFetchLogs} disabled={loading}
                        className="bg-sky-500 hover:bg-sky-600 text-white p-2.5 rounded-2xl shadow-sm active:scale-95 transition-all disabled:opacity-50">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-4">
                    <RefreshCw size={36} className="animate-spin text-sky-500" />
                    <p className="text-xs font-bold uppercase tracking-wider">Recupero dati meteo in corso...</p>
                </div>
            ) : weatherLogs.length === 0 ? (
                <div className="h-96 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-[2rem] text-slate-400 gap-3">
                    <Cloud size={48} className="stroke-[1.5] text-slate-300" />
                    <p className="text-sm font-extrabold text-slate-600">Nessun log meteo per questo vessel nel periodo selezionato</p>
                    <p className="text-xs text-slate-400 max-w-md text-center">
                        I dati meteo vengono registrati ogni 4 ore durante la navigazione.
                        Prova ad ampliare il range di date o seleziona un altro vessel.
                    </p>
                    <div className="flex items-center gap-2 bg-sky-50 border border-sky-100 rounded-2xl px-4 py-2 mt-2">
                        <MapPin size={13} className="text-sky-500" />
                        <span className="text-[11px] font-black text-sky-600 uppercase tracking-widest">La raccolta dati è attiva — slot: ogni 4h</span>
                    </div>
                </div>
            ) : (
                <div className="space-y-10">
                    {/* KPI Cards — significative per fleet tracking */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
                        <div className="bg-gradient-to-br from-cyan-50 to-white border border-cyan-100/50 rounded-[2rem] p-5 shadow-sm flex items-center justify-between">
                            <div>
                                <span className="text-[9px] font-black text-cyan-600 uppercase tracking-widest block mb-1">Max Onda</span>
                                <span className="text-2xl font-black text-slate-800">{stats?.maxWave}<span className="text-xs font-bold ml-1 text-slate-400">m</span></span>
                                <span className="text-[9px] font-bold text-slate-400 block mt-1">picco</span>
                            </div>
                            <div className="w-10 h-10 rounded-2xl bg-cyan-100/50 text-cyan-600 flex items-center justify-center shrink-0">
                                <Waves className="w-5 h-5" />
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-orange-50 to-white border border-orange-100/50 rounded-[2rem] p-5 shadow-sm flex items-center justify-between">
                            <div>
                                <span className="text-[9px] font-black text-orange-600 uppercase tracking-widest block mb-1">Onde &gt;1m</span>
                                <span className="text-2xl font-black text-slate-800">{stats?.roughSeaPct}<span className="text-xs font-bold ml-1 text-slate-400">%</span></span>
                                <span className="text-[9px] font-bold text-slate-400 block mt-1">rilevazioni</span>
                            </div>
                            <div className="w-10 h-10 rounded-2xl bg-orange-100/50 text-orange-600 flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-4 h-4" />
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-100/50 rounded-[2rem] p-5 shadow-sm flex items-center justify-between">
                            <div>
                                <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest block mb-1">Max Vento</span>
                                <span className="text-2xl font-black text-slate-800">{stats?.maxWind}<span className="text-xs font-bold ml-1 text-slate-400">kn</span></span>
                                <span className="text-[9px] font-bold text-slate-400 block mt-1">picco</span>
                            </div>
                            <div className="w-10 h-10 rounded-2xl bg-amber-100/50 text-amber-600 flex items-center justify-center shrink-0">
                                <Wind className="w-5 h-5" />
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-yellow-50 to-white border border-yellow-100/50 rounded-[2rem] p-5 shadow-sm flex items-center justify-between">
                            <div>
                                <span className="text-[9px] font-black text-yellow-600 uppercase tracking-widest block mb-1">Vento &gt;20kn</span>
                                <span className="text-2xl font-black text-slate-800">{stats?.wind20Pct}<span className="text-xs font-bold ml-1 text-slate-400">%</span></span>
                                <span className="text-[9px] font-bold text-slate-400 block mt-1">sostenuto</span>
                            </div>
                            <div className="w-10 h-10 rounded-2xl bg-yellow-100/50 text-yellow-600 flex items-center justify-center shrink-0">
                                <Wind className="w-4 h-4" />
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-red-50 to-white border border-red-100/50 rounded-[2rem] p-5 shadow-sm flex items-center justify-between">
                            <div>
                                <span className="text-[9px] font-black text-red-600 uppercase tracking-widest block mb-1">Vento &gt;30kn</span>
                                <span className="text-2xl font-black text-slate-800">{stats?.wind30Pct}<span className="text-xs font-bold ml-1 text-slate-400">%</span></span>
                                <span className="text-[9px] font-bold text-slate-400 block mt-1">burrasca</span>
                            </div>
                            <div className="w-10 h-10 rounded-2xl bg-red-100/50 text-red-600 flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-4 h-4" />
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100/50 rounded-[2rem] p-5 shadow-sm flex items-center justify-between">
                            <div>
                                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest block mb-1">Tratte Nav.</span>
                                <span className="text-2xl font-black text-slate-800">{stats?.navCount}<span className="text-xs font-bold ml-1 text-slate-400">tratte</span></span>
                                <span className="text-[9px] font-bold text-slate-400 block mt-1">{stats?.rilevazioni} rile.</span>
                            </div>
                            <div className="w-10 h-10 rounded-2xl bg-indigo-100/50 text-indigo-600 flex items-center justify-center shrink-0">
                                <Navigation className="w-4 h-4" />
                            </div>
                        </div>
                    </div>

                    {/* Chart Container */}
                    {chartData && (
                        <div className="bg-gradient-to-b from-slate-50/50 to-white border border-slate-100 rounded-[2.5rem] p-6 sm:p-8 shadow-inner relative overflow-hidden">
                            {/* Legend */}
                            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                                <div className="flex items-center gap-5 flex-wrap">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-cyan-400" />
                                        <span className="text-xs font-bold text-slate-600">Onde nave (m)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-amber-400" />
                                        <span className="text-xs font-bold text-slate-600">Vento nave (kn)</span>
                                    </div>
                                    <div className="w-px h-4 bg-slate-200" />
                                    <div className="flex items-center gap-2">
                                        <div className="w-10 h-0.5 border-t-2 border-dashed border-cyan-300" />
                                        <span className="text-xs font-bold text-slate-400">Onde Cantiere</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-10 h-0.5 border-t-2 border-dashed border-amber-300" />
                                        <span className="text-xs font-bold text-slate-400">Vento Cantiere</span>
                                    </div>
                                </div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Route Weather Chart</span>
                            </div>

                            <div className="relative w-full overflow-x-auto scrollbar-hide" onMouseLeave={() => setHoveredPoint(null)}>
                                <svg
                                    viewBox={`0 0 ${chartData.width} ${chartData.height}`}
                                    className="w-full h-auto min-w-[800px] overflow-visible"
                                >
                                    <defs>
                                        <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.25" />
                                            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
                                        </linearGradient>
                                    </defs>

                                    {/* === FASCE DI SFONDO ATTIVITÀ === */}
                                    {chartData.activityBands && chartData.activityBands.map((band, idx) => (
                                        <g key={`band-${idx}`}>
                                            <rect
                                                x={band.x}
                                                y={chartData.padding}
                                                width={band.width}
                                                height={chartData.height - 2 * chartData.padding}
                                                fill={band.color}
                                                opacity="0.3"
                                            />
                                            {band.width > 70 && (
                                                <g transform={`translate(${band.x + 6}, ${chartData.padding + 14})`}>
                                                    <text
                                                        fontSize="7.5"
                                                        fontWeight="900"
                                                        fill="#64748b"
                                                        className="uppercase tracking-widest opacity-80"
                                                    >
                                                        {band.type}
                                                    </text>
                                                </g>
                                            )}
                                        </g>
                                    ))}

                                    {/* Griglia */}
                                    {[0, 1, 2, 3, 4].map((i) => {
                                        const y = chartData.padding + (i / 4) * (chartData.height - 2 * chartData.padding);
                                        return <line key={i} x1={chartData.padding} y1={y} x2={chartData.width - chartData.padding} y2={y} stroke="#f1f5f9" strokeDasharray="4 4" strokeWidth="1.5" />;
                                    })}

                                    {/* === SCANNO DIGA — curve ghost trasparenti === */}
                                    {chartData.pathGenovaWave && (
                                        <path d={chartData.pathGenovaWave} fill="none" stroke="#06b6d4" strokeWidth="2" strokeDasharray="6 4" opacity="0.3" strokeLinecap="round" />
                                    )}
                                    {chartData.pathGenovaWind && (
                                        <path d={chartData.pathGenovaWind} fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="6 4" opacity="0.3" strokeLinecap="round" />
                                    )}
                                    {/* Punti Scanno Diga minimi */}
                                    {chartData.pointsGenovaWave.map((p, i) => (
                                        <circle key={`gw-${i}`} cx={p.x} cy={p.y} r="2.5" fill="#06b6d4" opacity="0.3" />
                                    ))}

                                    {/* === ETICHETTE NAVIGAZIONE IN VERTICALE === */}
                                    {chartData.activityLabels.map((lbl, idx) => {
                                        const isDeparture = lbl.type === 'departure';
                                        const color = isDeparture ? '#3b82f6' : '#10b981';
                                        return (
                                            <g key={`nav-${idx}`}>
                                                {/* Linea verticale tratteggiata */}
                                                <line
                                                    x1={lbl.x} y1={chartData.padding}
                                                    x2={lbl.x} y2={chartData.height - chartData.padding}
                                                    stroke={color} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.65"
                                                />
                                                {/* Pallino marker a inizio linea */}
                                                <circle cx={lbl.x} cy={chartData.padding} r="3" fill={color} opacity="0.9" />
                                                
                                                {/* Scritta verticale lungo la linea (ruotata di -90 gradi) */}
                                                <g transform={`translate(${lbl.x - 4}, ${chartData.height - chartData.padding - 10}) rotate(-90)`}>
                                                    <text
                                                        fontSize="7.5"
                                                        fontWeight="900"
                                                        fill={color}
                                                        className="uppercase tracking-wider"
                                                        style={{ fontFamily: 'inherit', letterSpacing: '0.08em' }}
                                                    >
                                                        {lbl.label}
                                                    </text>
                                                </g>
                                            </g>
                                        );
                                    })}

                                    {/* === VESSEL — area onda === */}
                                    <path d={chartData.areaWave} fill="url(#waveGrad)" />

                                    {/* === VESSEL — linea onda === */}
                                    <path d={chartData.pathWave} fill="none" stroke="#06b6d4" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />

                                    {/* === VESSEL — linea vento === */}
                                    <path d={chartData.pathWind} fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1" />

                                    {/* Punti interattivi vessel */}
                                    {chartData.pointsWave.map((p, i) => {
                                        const pWind = chartData.pointsWind[i];
                                        const isHovered = hoveredPoint?.wave?.index === i;
                                        return (
                                            <g key={i} className="cursor-pointer">
                                                <rect
                                                    x={p.x - 12} y={chartData.padding}
                                                    width={24} height={chartData.height - 2 * chartData.padding}
                                                    fill="transparent"
                                                    onMouseEnter={() => setHoveredPoint({ wave: p, wind: pWind })}
                                                />
                                                <circle cx={p.x} cy={p.y} r={isHovered ? 7 : 4}
                                                    fill="#ffffff" stroke="#06b6d4" strokeWidth={isHovered ? 3 : 2}
                                                    className="transition-all duration-150" />
                                                <circle cx={pWind.x} cy={pWind.y} r={isHovered ? 6 : 3}
                                                    fill="#f59e0b" />
                                            </g>
                                        );
                                    })}

                                    {/* Crosshair al hover */}
                                    {hoveredPoint && (
                                        <line
                                            x1={hoveredPoint.wave.x} y1={chartData.padding}
                                            x2={hoveredPoint.wave.x} y2={chartData.height - chartData.padding}
                                            stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="2 2"
                                            className="pointer-events-none"
                                        />
                                    )}
                                </svg>
                            </div>

                            {/* Tooltip hover */}
                            {hoveredPoint && (
                                <div className="mt-4 bg-white border border-slate-100 rounded-3xl p-4 shadow-xl flex flex-wrap items-center gap-6 justify-between animate-fadeIn relative z-10">
                                    <div className="flex items-center gap-3">
                                        <Navigation size={16} className="text-sky-500 rotate-45" />
                                        <div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">Rilevazione GPS</span>
                                            <span className="text-xs font-bold text-slate-700">{new Date(hoveredPoint.wave.time).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Waves size={16} className="text-cyan-500" />
                                        <div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">Altezza Onda</span>
                                            <span className="text-xs font-extrabold text-slate-700">{hoveredPoint.wave.val.toFixed(1)} m</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Wind size={16} className="text-amber-500" />
                                        <div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">Velocità Vento</span>
                                            <span className="text-xs font-extrabold text-slate-700">{hoveredPoint.wind.val.toFixed(0)} kn</span>
                                        </div>
                                    </div>
                                    {hoveredPoint.wave.log.wind_direction !== undefined && (
                                        <div className="flex items-center gap-3">
                                            <ArrowUp size={16} className="text-amber-500 transition-transform"
                                                style={{ transform: `rotate(${hoveredPoint.wave.log.wind_direction}deg)` }} />
                                            <div>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">Direzione Vento</span>
                                                <span className="text-xs font-extrabold text-slate-700">{hoveredPoint.wave.log.wind_direction}°</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3">
                                        <Thermometer size={16} className="text-rose-500" />
                                        <div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">Temperatura</span>
                                            <span className="text-xs font-extrabold text-slate-700">{hoveredPoint.wave.log.temperature || '—'} °C</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Calcolatore Manuale di Sicurezza Ormeggio */}
                    <div className="bg-slate-50/50 border border-slate-100 rounded-[2.5rem] p-8 sm:p-10 shadow-inner">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-400 to-indigo-500 flex items-center justify-center text-white shadow-md">
                                <Anchor className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">Calcolatore Manuale di Sicurezza Ormeggio</h3>
                                <p className="text-[10px] font-bold text-sky-500 uppercase tracking-wider">Verifica Prescrizioni RINA e Limiti di Disormeggio</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            {/* Form Inputs */}
                            <div className="lg:col-span-7 space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Classe Nave (DWT)</label>
                                        <select 
                                            value={calcDwt} 
                                            onChange={(e) => setCalcDwt(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer"
                                        >
                                            <option value="40000">40.000 DWT (es. Sider Abidjan)</option>
                                            <option value="7300">7.300 DWT (es. Rebecca, Orion, Buffalo, Rodi)</option>
                                            <option value="5270">5.270 DWT (es. Fabio Duo Z, Maria Vittoria Z, Annamaria Z)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Ormeggio / Banchina</label>
                                        <select 
                                            value={calcBerth} 
                                            onChange={(e) => setCalcBerth(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer"
                                        >
                                            <option value="T1">Scanno Diga T1 (18° N)</option>
                                            <option value="T2">Scanno Diga T2 (44° N)</option>
                                            <option value="T3">Scanno Diga T3 (44° N)</option>
                                            <option value="T7">Scanno Diga T7 (21° N)</option>
                                            <option value="CUSTOM">Altro / Personalizzato</option>
                                        </select>
                                    </div>
                                </div>

                                {calcBerth === 'CUSTOM' && (
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Angolo Ormeggio G (Orientamento Prua/Boe) [°]</label>
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="range" min="0" max="360" 
                                                value={calcMooringHeading} 
                                                onChange={(e) => setCalcMooringHeading(Number(e.target.value))}
                                                className="flex-1 accent-sky-500"
                                            />
                                            <input 
                                                type="number" min="0" max="360" 
                                                value={calcMooringHeading} 
                                                onChange={(e) => setCalcMooringHeading(Number(e.target.value))}
                                                className="w-20 bg-white border border-slate-200 rounded-2xl px-3 py-1.5 text-xs font-bold text-slate-700 text-center"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Direzione Vento Previsto F [°]</label>
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="range" min="0" max="360" 
                                            value={calcWindDir} 
                                            onChange={(e) => setCalcWindDir(Number(e.target.value))}
                                            className="flex-1 accent-sky-500"
                                        />
                                        <input 
                                            type="number" min="0" max="360" 
                                            value={calcWindDir} 
                                            onChange={(e) => setCalcWindDir(Number(e.target.value))}
                                            className="w-20 bg-white border border-slate-200 rounded-2xl px-3 py-1.5 text-xs font-bold text-slate-700 text-center"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Altezza Onda Hs Prevista [m]</label>
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="range" min="0" max="3" step="0.1" 
                                                value={calcHs} 
                                                onChange={(e) => setCalcHs(Number(e.target.value))}
                                                className="flex-1 accent-sky-500"
                                            />
                                            <span className="w-16 text-xs font-extrabold text-slate-700 bg-white border border-slate-200 rounded-2xl py-1.5 text-center shadow-sm">{calcHs.toFixed(1)} m</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Velocità Vento Prevista [kn]</label>
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="range" min="0" max="40" 
                                                value={calcWindSpeed} 
                                                onChange={(e) => setCalcWindSpeed(Number(e.target.value))}
                                                className="flex-1 accent-sky-500"
                                            />
                                            <span className="w-16 text-xs font-extrabold text-slate-700 bg-white border border-slate-200 rounded-2xl py-1.5 text-center shadow-sm">{calcWindSpeed} kn</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Results Panel */}
                            <div className="lg:col-span-5 flex flex-col justify-between">
                                {(() => {
                                    const validation = validateMooring({
                                        dwt: calcDwt,
                                        berth: calcBerth,
                                        windDir: calcWindDir,
                                        mooringHeading: calcMooringHeading,
                                        hs: calcHs,
                                        windSpeed: calcWindSpeed
                                    });

                                    const statusColors = {
                                        'POSITIVO': {
                                            bg: 'from-emerald-500 to-teal-600',
                                            light: 'bg-emerald-400 shadow-emerald-500/50',
                                            text: 'Safe / Positivo',
                                            desc: 'Le condizioni meteo rientrano pienamente nei parametri di stabilità e sicurezza prescritti dalle normative RINA.'
                                        },
                                        'NEGATIVO': {
                                            bg: 'from-amber-500 to-orange-600',
                                            light: 'bg-amber-400 shadow-amber-500/50',
                                            text: 'Attenzione / Limite Superato',
                                            desc: 'Uno o più parametri (altezza onda o vento) hanno superato le soglie limite previste per questo assetto.'
                                        },
                                        'ERRORE': {
                                            bg: 'from-rose-500 to-red-600',
                                            light: 'bg-rose-400 shadow-rose-500/50',
                                            text: 'Pericolo / Disormeggio Obbligatorio',
                                            desc: 'Lo scarto angolare del vento rispetto alla prua ricade nella zona critica di instabilità. La nave deve procedere al disormeggio immediato.'
                                        }
                                    }[validation.status] || {
                                        bg: 'from-slate-500 to-slate-600',
                                        light: 'bg-slate-400',
                                        text: 'Non Noto',
                                        desc: 'Dati incompleti o errati per eseguire la verifica.'
                                    };

                                    return (
                                        <div className="h-full flex flex-col justify-between bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm relative overflow-hidden min-h-[300px]">
                                            {/* Traffic light header */}
                                            <div className={`text-white p-5 rounded-3xl bg-gradient-to-tr ${statusColors.bg} flex items-center justify-between shadow-lg`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-3.5 h-3.5 rounded-full ${statusColors.light} animate-pulse shadow-md`} />
                                                    <div>
                                                        <span className="text-[8px] font-black uppercase tracking-widest text-white/70 block leading-none mb-1">Esito RINA</span>
                                                        <span className="text-sm font-extrabold tracking-tight">{statusColors.text}</span>
                                                    </div>
                                                </div>
                                                <span className="text-2xl font-black">{validation.delta.toFixed(0)}°<span className="text-xs font-bold ml-1 text-white/80">Delta</span></span>
                                            </div>

                                            {/* Breakdown info */}
                                            <div className="my-6 space-y-4">
                                                <p className="text-xs font-semibold text-slate-500 leading-normal">{statusColors.desc}</p>
                                                
                                                <div className="h-px bg-slate-100 w-full" />
                                                
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-slate-50 rounded-2xl p-3">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Hs Massimo</span>
                                                        <span className="text-xs font-extrabold text-slate-700">
                                                            {validation.hsLimit === 'ERRORE' ? 'ERRORE' : `${validation.hsLimit?.toFixed(1)} m`}
                                                        </span>
                                                    </div>
                                                    <div className="bg-slate-50 rounded-2xl p-3">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Vento Massimo</span>
                                                        <span className="text-xs font-extrabold text-slate-700">{validation.windLimit} kn</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Visual Compass direction */}
                                            <div className="flex items-center justify-center gap-4 bg-slate-50 rounded-2xl p-3 mt-auto">
                                                <div className="relative w-12 h-12 rounded-full border border-slate-200 flex items-center justify-center">
                                                    <ArrowUp size={16} className="text-amber-500 absolute transition-transform duration-300" 
                                                        style={{ transform: `rotate(${calcWindDir}deg)` }} />
                                                    <div className="w-1 h-3 bg-slate-400 rounded-full" style={{ transform: `rotate(${calcMooringHeading}deg)` }} />
                                                </div>
                                                <div>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block leading-none mb-1">Orientamento</span>
                                                    <span className="text-[10px] font-bold text-slate-600">Prua: {calcMooringHeading}° | Vento: {calcWindDir}°</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* Tabella rilevazioni */}

                    <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-xs font-extrabold text-slate-600 uppercase tracking-wider">Tabella Rilevazioni di Bordo</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{weatherLogs.length} campioni registrati</span>
                        </div>
                        <div className="overflow-x-auto max-h-[300px] scrollbar-hide">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                        <th className="px-6 py-3">Timestamp (UTC)</th>
                                        <th className="px-6 py-3">Posizione Rilevata</th>
                                        <th className="px-6 py-3">Altezza Onda</th>
                                        <th className="px-6 py-3">Velocità Vento</th>
                                        <th className="px-6 py-3">Direzione Vento</th>
                                        <th className="px-6 py-3">Temp. Aria</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-bold text-slate-600 divide-y divide-slate-50">
                                    {weatherLogs.map((log) => (
                                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-3">{new Date(log.timestamp).toLocaleString('it-IT')}</td>
                                            <td className="px-6 py-3 font-mono text-[11px] text-sky-600">{log.lat?.toFixed(2)}N, {log.lon?.toFixed(2)}E</td>
                                            <td className="px-6 py-3 flex items-center gap-1"><Waves size={12} className="text-cyan-400" /> {log.wave_height?.toFixed(1)} m</td>
                                            <td className="px-6 py-3"><Wind size={12} className="text-amber-400 inline mr-1" /> {log.wind_speed?.toFixed(0)} kn</td>
                                            <td className="px-6 py-3 font-mono">{log.wind_direction}°</td>
                                            <td className="px-6 py-3 text-rose-500">{log.temperature || '—'} °C</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import { useFleet, useOperations, useConfig } from '../context/DataContext';
import { validateMooring } from '../utils/mooringSafety';

export default function MooringAlertBanner() {
    const { vessels } = useFleet();
    const { activities } = useOperations();
    const { profile } = useConfig();
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
                console.error("Error fetching forecast for mooring alerts:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchForecast();
    }, []);

    // 3. Find active mooring alerts
    const alerts = useMemo(() => {
        if (loading || forecast.length === 0 || !activities || !vessels) return [];

        const activeMooredActivities = activities.filter(a => {
            // Check if active (in-progress) and at T1, T2, T3, T5, T6, T7
            const isTargetBerth = ['T1', 'T2', 'T3', 'T5', 'T6', 'T7'].some(berth => 
                a.geofence && a.geofence.toUpperCase().includes(berth)
            );
            return a.status === 'in-progress' && isTargetBerth;
        });

        const mooringAlerts = [];

        activeMooredActivities.forEach(act => {
            const vesselObj = vessels.find(v => v.id === act.vesselId || v.name?.toUpperCase() === act.vessel?.toUpperCase());
            const grossTonnage = vesselObj?.gross_ton_value || vesselObj?.gross_tononnage || 0;
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
                    break; // Only report the first critical condition
                }
            }
        });

        return mooringAlerts;
    }, [activities, vessels, forecast, loading]);

    if (alerts.length === 0) return null;

    return (
        <div className="w-full bg-gradient-to-r from-red-500/10 via-red-600/10 to-red-500/10 backdrop-blur-md border-b border-red-500/20 py-2.5 px-4 animate-pulse flex flex-col md:flex-row items-center justify-center gap-3 mb-6 rounded-3xl">
            <div className="flex items-center gap-2 text-red-600 text-xs font-black uppercase tracking-wider">
                <AlertTriangle size={15} className="animate-bounce" />
                <span>Rischio Disormeggio RINA</span>
            </div>
            
            <div className="flex-1 flex flex-col justify-center gap-1">
                {alerts.map((alert, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] font-bold text-slate-700 justify-center">
                        <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded font-black">{alert.vessel}</span>
                        <span>
                            Previsto stato critico a <b>{alert.berth}</b> il giorno <b className="text-red-700 font-extrabold">{alert.time}</b> (Onda: {alert.wave.toFixed(1)}m, Vento: {alert.wind.toFixed(0)}kn - {alert.reason})
                        </span>
                    </div>
                ))}
            </div>

            <div className="text-[10px] text-red-700 font-black uppercase tracking-widest flex items-center gap-1">
                <span>Prescrizione RINA</span>
                <ArrowRight size={10} />
            </div>
        </div>
    );
}

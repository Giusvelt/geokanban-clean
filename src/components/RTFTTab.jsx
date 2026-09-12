import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchTrackingHistory, fetchLatestTimestamp } from '../services/api/trackingService';
import VesselMap from './VesselMap';
import { useFleet, useOperations } from '../context/DataContext';
import { AlertCircle, Anchor } from 'lucide-react';
import SectionHeader from './SectionHeader';

export default function RTFTTab() {
    const { vessels } = useFleet();
    const { geofences } = useOperations();

    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);
    const [trackingData, setTrackingData] = useState([]);
    
    const [virtualTime, setVirtualTime] = useState(null);
    const minTime = useRef(null);
    const maxTime = useRef(null);
    const timerRef = useRef(null);

    useEffect(() => {
        let isMounted = true;
        const loadDemoData = async () => {
            setLoading(true);
            try {
                // Trova l'ultimo timestamp disponibile per mostrare sempre un demo di 24h
                const latest = await fetchLatestTimestamp();
                const end = new Date(latest);
                const start = new Date(end.getTime() - (24 * 60 * 60 * 1000));

                const allData = await fetchTrackingHistory(start, end);
                if (!isMounted) return;

                if (allData.length > 0) {
                    setTrackingData(allData);
                    const firstTime = new Date(allData[0].timestamp).getTime();
                    const lastTime = new Date(allData[allData.length - 1].timestamp).getTime();
                    
                    minTime.current = firstTime;
                    maxTime.current = lastTime;
                    setVirtualTime(firstTime);
                } else {
                    setErrorMsg("Nessun dato telemetrico nelle ultime 24 ore (relative all'ultimo log).");
                }
            } catch (err) {
                if (isMounted) setErrorMsg(err.message);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadDemoData();
        return () => { isMounted = false; };
    }, []);

    // Auto Loop Engine (10x speed effectively)
    useEffect(() => {
        if (!trackingData.length || virtualTime === null) return;

        timerRef.current = setInterval(() => {
            setVirtualTime(prev => {
                if (prev === null) return minTime.current;
                // Advance virtual time by 5 minutes every 100ms
                const next = prev + (5 * 60 * 1000);
                if (next > maxTime.current) {
                    return minTime.current; // Loop back to start
                }
                return next;
            });
        }, 100);

        return () => clearInterval(timerRef.current);
    }, [trackingData.length]);

    const currentPositions = useMemo(() => {
        if (!trackingData.length || !virtualTime) return [];
        const latest = {};
        for (let i = 0; i < trackingData.length; i++) {
            const row = trackingData[i];
            const t = new Date(row.timestamp).getTime();
            if (t <= virtualTime) {
                if (!latest[row.vessel_id] || new Date(latest[row.vessel_id].timestamp).getTime() < t) {
                    latest[row.vessel_id] = row;
                }
            }
        }
        
        return Object.values(latest).map(track => {
            const v = vessels.find(v => v.id === track.vessel_id) || { name: 'Unknown' };
            return {
                vessel: v.name,
                vesselId: v.id,
                lat: track.lat,
                lon: track.lon,
                speed: track.speed,
                heading: track.heading,
                course: track.course,
                status: track.status,
                lastUpdate: track.timestamp
            };
        });
    }, [trackingData, virtualTime, vessels]);

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] animate-fade-in">
            <SectionHeader 
                title="Real Time Fleet Tracking (RTFT)" 
                subtitle="Live telemetry feed (Delayed Demo Mode)"
            />

            <div className="flex-1 bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm relative">
                {loading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-sm z-10">
                        <Anchor size={48} className="animate-spin text-primary opacity-50 mb-4" />
                        <p className="text-slate-600 font-bold uppercase tracking-wider text-sm">Caricamento Buffer Telemetria...</p>
                    </div>
                ) : errorMsg ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 z-10 text-red-600">
                        <AlertCircle size={48} className="mb-4" />
                        <p className="font-bold uppercase tracking-wider text-sm">{errorMsg}</p>
                    </div>
                ) : (
                    <>
                        <div className="absolute top-4 left-4 z-[1000] bg-green-500/90 text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow flex items-center gap-2">
                            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                            Live Demo (Loop 24h)
                        </div>
                        <VesselMap 
                            height="100%" 
                            vesselPositions={currentPositions} 
                            geofences={geofences} 
                        />
                    </>
                )}
            </div>
        </div>
    );
}

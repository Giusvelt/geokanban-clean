import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchTrackingHistory, fetchLatestTimestamp } from '../services/api/trackingService';
import VesselMap from './VesselMap';
import { useFleet, useOperations } from '../context/DataContext';
import { Calendar as CalendarIcon, Filter, AlertCircle, RefreshCw } from 'lucide-react';


export default function HistoricalMapWidget({ height = "350px" }) {
    const { vessels } = useFleet();
    const { geofences } = useOperations();

    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 3);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState('');
    const [selectedVesselFilter, setSelectedVesselFilter] = useState('All');
    
    const [loading, setLoading] = useState(false);
    const [trackingData, setTrackingData] = useState([]);
    const [errorMsg, setErrorMsg] = useState(null);
    
    const [virtualTime, setVirtualTime] = useState(null);
    const minTime = useRef(null);
    const maxTime = useRef(null);

    const [showFilters, setShowFilters] = useState(false);

    const handleLoadData = async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            let start = startDate ? new Date(startDate) : null;
            let end = endDate ? new Date(endDate) : null;

            if (!start || !end) {
                const latest = await fetchLatestTimestamp();
                end = new Date(latest);
                start = new Date(latest.getTime() - (7 * 24 * 60 * 60 * 1000)); // last 7 days from latest data
                setStartDate(start.toISOString().split('T')[0]);
                setEndDate(end.toISOString().split('T')[0]);
            }
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);

            const allData = await fetchTrackingHistory(start, end);
            if (allData.length === 0) {
                setTrackingData([]);
                throw new Error("Nessun dato trovato per questo periodo");
            }

            setTrackingData(allData);
            const firstTime = new Date(allData[0].timestamp).getTime();
            const lastTime = new Date(allData[allData.length - 1].timestamp).getTime();
            
            minTime.current = firstTime;
            maxTime.current = lastTime;
            
            // Default to highest timestamp
            setVirtualTime(lastTime);
        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setLoading(false);
        }
    };
        });
    }, [trackingData, virtualTime, selectedVesselFilter, vessels]);

    const handleSliderChange = (e) => {
        setVirtualTime(Number(e.target.value));
    };

    return (
        <div className="relative flex flex-col bg-white overflow-hidden rounded-[1.5rem]" style={{ height }}>
            <div className="absolute top-2 right-2 z-[1000] flex gap-2">
                <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className="bg-white/90 backdrop-blur shadow-md p-2 rounded-full border border-slate-200 text-slate-700 hover:text-primary hover:bg-white transition-all"
                >
                    <Filter size={18} />
                </button>
            </div>

            {showFilters && (
                <div className="absolute top-12 right-2 z-[1001] bg-white shadow-xl rounded-2xl border border-slate-100 p-4 w-64 md:w-72 flex flex-col gap-4">
                    <h4 className="font-bold text-sm text-slate-800 border-b pb-2">Filtri Mappa (Delayed Mode)</h4>
                    
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Da</label>
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={e => setStartDate(e.target.value)}
                            className="text-sm bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">A</label>
                        <input 
                            type="date" 
                            value={endDate} 
                            onChange={e => setEndDate(e.target.value)}
                            className="text-sm bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Nave</label>
                        <select 
                            value={selectedVesselFilter}
                            onChange={(e) => setSelectedVesselFilter(e.target.value)}
                            className="text-sm bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-primary/20 outline-none"
                        >
                            <option value="All">Tutta la Flotta</option>
                            {vessels.map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                        </select>
                    </div>
                    <button 
                        onClick={() => { handleLoadData(); setShowFilters(false); }}
                        className="mt-2 w-full bg-primary text-white py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-sky-600 transition-colors"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                        Applica Filtri
                    </button>
                </div>
            )}

            <div className="flex-1 relative z-0">
                <VesselMap 
                    height="100%" 
                    vesselPositions={currentPositions} 
                    geofences={geofences} 
                />
            </div>

            <div className="bg-white border-t border-slate-200 p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-500">
                        <CalendarIcon size={14} />
                        <span className="text-xs font-medium">
                            {virtualTime ? new Date(virtualTime).toLocaleString('it-IT') : 'Nessun dato'}
                        </span>
                    </div>
                    {loading && <span className="text-xs font-bold text-primary animate-pulse">Caricamento...</span>}
                    {errorMsg && <div className="text-xs text-red-500 font-bold flex items-center gap-1"><AlertCircle size={12}/>{errorMsg}</div>}
                </div>
                
                <input
                    type="range"
                    min={minTime.current || 0}
                    max={maxTime.current || 100}
                    value={virtualTime || 0}
                    onChange={handleSliderChange}
                    disabled={!trackingData.length}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary"
                />
            </div>
        </div>
    );
}

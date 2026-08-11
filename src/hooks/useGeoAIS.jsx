import { useState, useEffect, useRef, useCallback } from 'react';

const DATADOCKED_BASE_URL = 'https://datadocked.com/api/vessels_operations';
const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * GeoAIS Hook (DataDocked Implementation)
 * Replaces the legacy Datalastic provider.
 */
export function useGeoAIS(vessels, customApiKey = null) {
    const [positions, setPositions] = useState({});
    const intervalRef = useRef(null);

    const apiKey = customApiKey || import.meta.env.VITE_DATADOCKED_API_KEY;
    const isEnabled = !!apiKey;

    const fetchPositions = useCallback(async () => {
        if (!isEnabled || !vessels?.length) return;

        try {
            const fetchPromises = vessels
                .filter(v => v.mmsi)
                .map(async (vessel) => {
                    try {
                        const res = await fetch(`${DATADOCKED_BASE_URL}/get-vessel-location?imo_or_mmsi=${vessel.mmsi}`, {
                            headers: { 
                                'x-api-key': apiKey,
                                'Accept': 'application/json'
                            }
                        });
                        
                        if (res.ok) {
                            const json = await res.json();
                            const d = json.detail; // DataDocked uses "detail" object
                            
                            if (d && d.latitude && d.longitude) {
                                return {
                                    mmsi: vessel.mmsi,
                                    lat: parseFloat(d.latitude),
                                    lon: parseFloat(d.longitude),
                                    speed: parseFloat(d.speed) || 0,
                                    course: parseFloat(d.course) || 0,
                                    status: (parseFloat(d.speed) > 0.5) ? 'underway' : 'anchored',
                                    timestamp: new Date().toISOString(), // DataDocked usually real-time
                                    vesselInfo: (
                                        <div key={vessel.mmsi}>
                                            <h4 className="font-manrope font-black text-sm tracking-tight text-white uppercase italic">{vessel.name}</h4>
                                            <div className="flex gap-2 items-center mt-1">
                                                <span className="text-[9px] font-black text-white/20 tracking-[0.2em]">{vessel.imo_number || 'NO-IMO'}</span>
                                                <span className="w-1 h-1 rounded-full bg-white/10" />
                                                <span className="text-[9px] font-black text-accent/40 tracking-[0.2em] uppercase">{vessel.vessel_type || 'SHIP'}</span>
                                            </div>
                                        </div>
                                    )
                                };
                            }
                        } else if (res.status === 402) {
                            console.error('DataDocked Payment Required: Please check credits.');
                        }
                    } catch (err) {
                        console.warn(`DataDocked fetch failed for MMSI ${vessel.mmsi}:`, err.message);
                    }
                    return null;
                });

            const results = await Promise.all(fetchPromises);
            const newPositions = {};
            results.forEach(res => {
                if (res) newPositions[res.mmsi] = res;
            });

            if (Object.keys(newPositions).length > 0) {
                // Async micro-task pattern for zero-error React state updates in Effects
                Promise.resolve().then(() => {
                    setPositions(prev => ({ ...prev, ...newPositions }));
                });
            }
        } catch (globalErr) {
            console.error('DataDocked global error:', globalErr.message);
        }
    }, [isEnabled, vessels, apiKey]);

    useEffect(() => {
        if (!isEnabled || !vessels?.length) return;
        fetchPositions();
        intervalRef.current = setInterval(fetchPositions, POLL_INTERVAL);
        return () => clearInterval(intervalRef.current);
    }, [isEnabled, vessels?.length, fetchPositions]);

    return { positions, isEnabled };
}

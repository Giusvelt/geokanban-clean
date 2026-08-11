import { useState, useEffect, useRef } from 'react';

const DATALASTIC_URL = 'https://api.datalastic.com/api/v0/vessel';
const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useDatalastic(vessels) {
    const [positions, setPositions] = useState({});
    const intervalRef = useRef(null);

    const apiKey = import.meta.env.VITE_DATALASTIC_API_KEY;
    const isEnabled = !!apiKey;

    const fetchPositions = async () => {
        if (!isEnabled || !vessels?.length) return;

        const newPositions = {};
        for (const vessel of vessels) {
            if (!vessel.mmsi) continue;
            try {
                const res = await fetch(`${DATALASTIC_URL}?mmsi=${vessel.mmsi}`, {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                });
                if (res.ok) {
                    const json = await res.json();
                    const d = Array.isArray(json.data) ? json.data[0] : json.data;
                    if (d) {
                        newPositions[vessel.mmsi] = {
                            lat: d.lat,
                            lon: d.lon,
                            speed: d.speed || 0,
                            course: d.course || 0,
                            status: d.speed > 0.5 ? 'underway' : 'anchored',
                            timestamp: d.timestamp || new Date().toISOString()
                        };
                    }
                }
            } catch (err) {
                console.warn(`Datalastic fetch failed for MMSI ${vessel.mmsi}:`, err.message);
            }
        }
        if (Object.keys(newPositions).length > 0) {
            setPositions(prev => ({ ...prev, ...newPositions }));
        }
    };

    useEffect(() => {
        if (!isEnabled || !vessels?.length) return;
        fetchPositions();
        intervalRef.current = setInterval(fetchPositions, POLL_INTERVAL);
        return () => clearInterval(intervalRef.current);
    }, [vessels?.length, isEnabled]);

    return { positions, isEnabled };
}

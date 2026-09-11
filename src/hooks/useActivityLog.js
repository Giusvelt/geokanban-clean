import { useState, useEffect, useCallback } from 'react';
import { activityService } from '../services/api/activityService';
import { useConfig } from '../context/DataContext';
import { weatherService } from '../services/api/weatherService';

/**
 * useActivityLog V3.2 â€” Reads from vessel_activity (materialized)
 * instead of recalculating from geofence_events.
 *
 * @param {string|null} vesselId â€” If provided, filters for a single vessel (crew mode)
 */
export function useActivityLog(vesselId = null) {
    const { profile } = useConfig();
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(null);

    const fetchActivities = useCallback(async () => {
        setLoading(true);

        try {
            const { data, error } = await activityService.fetchActivityLog(vesselId);

            

            if (error) throw error;

            // Fetch latest Genoa reference weather (Scanno Diga) from SOLID weatherService
            const genoaWeatherRaw = await weatherService.fetchLatestGenoaWeather();
            const genoaWeather = genoaWeatherRaw ? {
                wind_speed: Math.round((genoaWeatherRaw.wind_speed || 0) / 1.852), // Convert km/h to knots (Open-Meteo unit is km/h usually or kn depending on api unit, but here we keep the conversion to knots intact)
                wind_direction: genoaWeatherRaw.wind_direction,
                wave_height: genoaWeatherRaw.wave_height,
                temp: genoaWeatherRaw.temperature
            } : null;

            // Map to format expected by VesselActivityTab
            const mapped = (data || []).map((row, idx, arr) => {
                let geofenceName = row.geofences?.name || 'â€”';

                if (row.activity_type === 'Navigation') {
                    // Cerca la destinazione (l'attivitÃ  cronologicamente successiva, ovvero quella prima di noi nell'array DESC)
                    let destGeo = null;
                    for (let i = idx - 1; i >= 0; i--) {
                        if (arr[i].vessel_id === row.vessel_id && arr[i].geofences?.name) {
                            destGeo = arr[i].geofences.name;
                            break;
                        }
                    }

                    // Cerca la partenza (l'attivitÃ  cronologicamente precedente, ovvero quella dopo di noi nell'array DESC)
                    let origGeo = null;
                    for (let i = idx + 1; i < arr.length; i++) {
                        if (arr[i].vessel_id === row.vessel_id && arr[i].geofences?.name) {
                            origGeo = arr[i].geofences.name;
                            break;
                        }
                    }

                    if (origGeo && destGeo) {
                        geofenceName = `${origGeo} âž” ${destGeo}`;
                    } else if (destGeo) {
                        geofenceName = `âž” ${destGeo}`;
                    } else if (origGeo) {
                        geofenceName = `${origGeo} âž” â€”`;
                    } else {
                        geofenceName = 'Navigation';
                    }
                }

                return {
                    id: row.id,
                    vessel: row.vessel_id === null ? 'ALL VESSELS' : (row.vessels?.name || 'Unknown'),
                    vesselId: row.vessel_id,
                    mmsi: row.vessels?.mmsi,
                    activity: row.activity_type,
                    geofence: geofenceName,
                    geofenceId: row.geofence_id,
                    startTime: row.start_time,
                    endTime: row.end_time,
                    durationMinutes: row.duration_minutes,
                    source: row.source,
                    status: row.status === 'active' ? 'in-progress' : 'completed',
                    exportFlag: row.export_flag,
                    logbookStatus: row.logbook_entries?.[0]?.status || 'none',
                    deliveredQty: row.logbook_entries?.[0]?.structured_fields?.actual_cargo_tonnes || null,
                    msgCount: row.activity_messages?.length || 0,
                    unreadMsgCount: row.activity_messages?.filter(m => !m.is_read && m.sender_role !== profile?.role).length || 0,
                    weather: genoaWeather
                };
            });

            setActivities(mapped);
            setLastUpdate(new Date());
        } catch (err) {
            console.error('Failed to load vessel_activity:', err.message);
        } finally {
            setLoading(false);
        }
    }, [vesselId, profile?.role]);

    useEffect(() => {
        fetchActivities();
        const interval = setInterval(fetchActivities, 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchActivities]);

    return { activities, loading, lastUpdate, fetchActivities };
}

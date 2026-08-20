import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useConfig } from '../context/DataContext';
import { weatherService } from '../services/api/weatherService';

/**
 * useActivityLog V3.2 — Reads from vessel_activity (materialized)
 * instead of recalculating from geofence_events.
 *
 * @param {string|null} vesselId — If provided, filters for a single vessel (crew mode)
 */
export function useActivityLog(vesselId = null) {
    const { profile } = useConfig();
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(null);

    const fetchActivities = useCallback(async () => {
        setLoading(true);

        try {
            let query = supabase
                .from('vessel_activity')
                .select(`
                    id,
                    vessel_id,
                    activity_type,
                    geofence_id,
                    start_time,
                    end_time,
                    duration_minutes,
                    source,
                    status,
                    export_flag,
                    vessels ( name, mmsi ),
                    geofences!vessel_activity_geofence_id_fkey ( name, nature ),
                    logbook_entries ( status, structured_fields ),
                    activity_messages ( id, is_read, sender_role )
                `)
                .order('start_time', { ascending: false });

            // Crew filter: only their vessel
            if (profile?.role === 'crew' && !vesselId) {
                setActivities([]);
                setLoading(false);
                return;
            }

            if (vesselId) {
                query = query.eq('vessel_id', vesselId);
            }

            const { data, error } = await query;

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
                let geofenceName = row.geofences?.name || '—';

                if (row.activity_type === 'Navigation') {
                    // Cerca la destinazione (l'attività cronologicamente successiva, ovvero quella prima di noi nell'array DESC)
                    let destGeo = null;
                    for (let i = idx - 1; i >= 0; i--) {
                        if (arr[i].vessel_id === row.vessel_id && arr[i].geofences?.name) {
                            destGeo = arr[i].geofences.name;
                            break;
                        }
                    }

                    // Cerca la partenza (l'attività cronologicamente precedente, ovvero quella dopo di noi nell'array DESC)
                    let origGeo = null;
                    for (let i = idx + 1; i < arr.length; i++) {
                        if (arr[i].vessel_id === row.vessel_id && arr[i].geofences?.name) {
                            origGeo = arr[i].geofences.name;
                            break;
                        }
                    }

                    if (origGeo && destGeo) {
                        geofenceName = `${origGeo} ➔ ${destGeo}`;
                    } else if (destGeo) {
                        geofenceName = `➔ ${destGeo}`;
                    } else if (origGeo) {
                        geofenceName = `${origGeo} ➔ —`;
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

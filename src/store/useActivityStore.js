import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { weatherService } from '../services/api/weatherService';
import { useGeofenceStore } from './useGeofenceStore';

export const useActivityStore = create((set, get) => ({
    activities: [],
    productionPlans: [],
    selectedMonth: new Date().getMonth(),
    selectedYear: new Date().getFullYear(),
    loading: false,
    error: null,
    lastUpdate: null,
    
    setSelectedMonth: (month) => set({ selectedMonth: month }),
    setSelectedYear: (year) => set({ selectedYear: year }),

    fetchActivities: async (vesselId = null, userRole = null, month = null, year = null) => {
        set({ loading: true });
        const targetMonth = month !== null ? month : get().selectedMonth;
        const targetYear = year !== null ? year : get().selectedYear;

        try {
            // Fetch all weather logs for the selected month to map in memory
            let weatherLogsInMemory = [];
            try {
                const startDate = new Date(targetYear, targetMonth, 1).toISOString();
                const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999).toISOString();
                const { data, error } = await supabase
                    .from('weather_logs')
                    .select('location_name, timestamp, wind_speed, wave_height')
                    .gte('timestamp', startDate)
                    .lte('timestamp', endDate);
                if (!error && data) weatherLogsInMemory = data;
            } catch (err) {
                console.error("Error fetching historical weather logs:", err);
            }
            let query = supabase
                .from('vessel_activity')
                .select(`
                    id, vessel_id, activity_type, geofence_id, geofence_from_id, geofence_to_id, start_time, end_time,
                    duration_minutes, source, status, export_flag, ais_start_draught, ais_end_draught,
                    weather_wave, weather_wind,
                    vessels ( name, mmsi ),
                    geofences!vessel_activity_geofence_id_fkey ( name, nature ),
                    logbook_entries ( * ),
                    activity_messages ( id, is_read, sender_role, message_text, created_at, sender_id )
                `)
                .order('start_time', { ascending: false });
            
            if (vesselId) {
                if (Array.isArray(vesselId)) {
                    query = query.or(`vessel_id.in.(${vesselId.join(',')}),vessel_id.is.null`);
                } else {
                    query = query.or(`vessel_id.eq.${vesselId},vessel_id.is.null`);
                }
            }

            if (targetMonth !== null && targetYear !== null) {
                const startDate = new Date(targetYear, targetMonth, 1).toISOString();
                // Get last day of month correctly
                const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999).toISOString();
                query = query.gte('start_time', startDate).lte('start_time', endDate);
            } else {
                query = query.limit(500);
            }

            let { data, error } = await query;
            
            if (error) throw error;
            console.log(`[Store] Final count: ${data?.length || 0} activities`);
            
            // Batch enrichment: Fetch tracking coordinates for Anchorage activities without a geofence
            const anchorageRows = (data || []).filter(r => r.activity_type === 'Anchorage' && !r.geofence_id);
            const anchorageCoordsMap = new Map();
            if (anchorageRows.length > 0) {
                const vesselIds = [...new Set(anchorageRows.map(r => r.vessel_id).filter(Boolean))];
                const timestamps = anchorageRows.map(r => new Date(r.start_time).getTime());
                const minStart = new Date(Math.min(...timestamps) - 30 * 60 * 1000).toISOString();
                const maxEnd = new Date(Math.max(...timestamps) + 30 * 60 * 1000).toISOString();
                
                try {
                    const { data: trackPoints } = await supabase
                        .from('vessel_tracking')
                        .select('vessel_id, lat, lon, timestamp')
                        .in('vessel_id', vesselIds)
                        .gte('timestamp', minStart)
                        .lte('timestamp', maxEnd)
                        .order('timestamp', { ascending: true });
                        
                    if (trackPoints && trackPoints.length > 0) {
                        anchorageRows.forEach(act => {
                            const actStart = new Date(act.start_time).getTime();
                            let closest = null;
                            let minDiff = Infinity;
                            trackPoints.forEach(tp => {
                                if (tp.vessel_id === act.vessel_id) {
                                    const diff = Math.abs(new Date(tp.timestamp).getTime() - actStart);
                                    if (diff < minDiff) {
                                        minDiff = diff;
                                        closest = tp;
                                    }
                                }
                            });
                            if (closest && minDiff <= 2 * 60 * 60 * 1000) {
                                anchorageCoordsMap.set(act.id, { lat: closest.lat, lon: closest.lon });
                            }
                        });
                    }
                } catch (tErr) {
                    console.error("Error fetching tracking points for Anchorage:", tErr);
                }
            }

            const geoStore = useGeofenceStore.getState().geofences || [];

            function formatWGS84(lat, lon) {
                if (lat == null || lon == null) return null;
                const latCard = lat >= 0 ? 'N' : 'S';
                const lonCard = lon >= 0 ? 'E' : 'W';
                const absLat = Math.abs(lat);
                const latDeg = Math.floor(absLat);
                const latMin = Math.floor((absLat - latDeg) * 60);
                const latSec = ((absLat - latDeg - latMin / 60) * 3600).toFixed(1);
                const absLon = Math.abs(lon);
                const lonDeg = Math.floor(absLon);
                const lonMin = Math.floor((absLon - lonDeg) * 60);
                const lonSec = ((absLon - lonDeg - lonMin / 60) * 3600).toFixed(1);
                return `${latDeg}°${latMin.toString().padStart(2, '0')}'${latSec.padStart(4, '0')}"${latCard}, ${lonDeg}°${lonMin.toString().padStart(2, '0')}'${lonSec.padStart(4, '0')}"${lonCard}`;
            }

            const getAnchorageLabel = (r) => {
                const coords = anchorageCoordsMap.get(r.id);
                const wgs = coords ? formatWGS84(coords.lat, coords.lon) : null;
                return wgs ? `Anchorage (${wgs})` : 'Anchorage (Rada)';
            };

            // Filter out 0-minute ghost activities and map to flat format
            const validData = (data || []).filter(row => !(row.status === 'completed' && row.duration_minutes === 0));
            const mapped = validData.map((row, idx, arr) => {
                const showWeather = row.activity_type === 'Navigation';
                console.log(`[useActivityStore] Mapping ${row.vessels?.name || 'Unknown'} | Type: ${row.activity_type} | showWeather: ${showWeather}`);
                let geofenceName = row.geofences?.name || (row.activity_type === 'Anchorage' ? getAnchorageLabel(row) : '—');

                if (row.activity_type === 'Navigation') {
                    let destGeo = row.geofence_to_id ? geoStore.find(g => g.id === row.geofence_to_id)?.name : null;
                    let origGeo = row.geofence_from_id ? geoStore.find(g => g.id === row.geofence_from_id)?.name : null;

                    // Fallback legacy (scansione array) se i nuovi ID non sono usati/disponibili
                    if (!destGeo) {
                        for (let i = idx - 1; i >= 0; i--) {
                            if (arr[i].vessel_id === row.vessel_id) {
                                if (arr[i].geofences?.name) {
                                    destGeo = arr[i].geofences.name;
                                } else if (arr[i].activity_type === 'Anchorage') {
                                    destGeo = `Anchorage (#${i + 1})`;
                                }
                                if (destGeo) break;
                            }
                        }
                    }
                    if (!origGeo) {
                        for (let i = idx + 1; i < arr.length; i++) {
                            if (arr[i].vessel_id === row.vessel_id) {
                                if (arr[i].geofences?.name) {
                                    origGeo = arr[i].geofences.name;
                                } else if (arr[i].activity_type === 'Anchorage') {
                                    origGeo = `Anchorage (#${i + 1})`;
                                }
                                if (origGeo) break;
                            }
                        }
                    }

                    if (origGeo && destGeo) {
                        geofenceName = `${origGeo} ➔ ${destGeo}`;
                    } else if (destGeo) {
                        geofenceName = `➔ ${destGeo}`;
                    } else if (origGeo) {
                        geofenceName = `${origGeo} ➔ —`;
                    } else {
                        geofenceName = row.activity_type;
                    }
                }

                // Calcola il timestamp target in base alla logica dell'utente:
                // - Se finita: momento mediano tra inizio e fine (ingresso e uscita).
                // - Se in corso (in-progress): orario di inizio attività (ingresso).
                const tStart = new Date(row.start_time).getTime();
                const tEnd = row.end_time ? new Date(row.end_time).getTime() : null;
                const targetTime = tEnd ? (tStart + tEnd) / 2 : tStart;
                const isFleetEvent = !row.vessel_id;
                const vesselName = isFleetEvent ? '⚠️ All Vessels' : (row.vessels?.name || '');

                let activityWeather = null;
                if (row.activity_type === 'Navigation' && weatherLogsInMemory && weatherLogsInMemory.length > 0) {
                    let minDiff = Infinity;
                    weatherLogsInMemory.forEach(log => {
                        // Cerca rilevazioni specifiche per questa nave
                        if (log.location_name && log.location_name.includes(vesselName)) {
                            const diff = Math.abs(new Date(log.timestamp).getTime() - targetTime);
                            if (diff < minDiff) {
                                minDiff = diff;
                                activityWeather = log;
                            }
                        }
                    });
                }


                // Visualizziamo il meteo solo per attività di Navigation


                return {
                    id: row.id,
                    vessel: isFleetEvent ? '⚠️ All Vessels' : (row.vessels?.name || 'Unknown'),
                    vesselId: row.vessel_id,
                    mmsi: row.vessels?.mmsi,
                    isFleetEvent,
                    activity: row.activity_type,
                    geofence: geofenceName,
                    geofenceId: row.geofence_id,
                    geofenceFromId: row.geofence_from_id,
                    geofenceToId: row.geofence_to_id,
                    startTime: row.start_time,
                    endTime: row.end_time,
                    durationMinutes: row.duration_minutes,
                    source: row.source || 'ais',
                    status: row.status === 'active' ? 'in-progress' : 'completed',
                    aisStartDraught: row.ais_start_draught ? `${row.ais_start_draught} m` : '—',
                    aisEndDraught: row.ais_end_draught ? `${row.ais_end_draught} m` : '—',
                    logbookStatus: row.logbook_entries?.[0]?.status || 'none',
                    logbookEntry: row.logbook_entries?.[0] || null,
                    weatherWave: showWeather
                        ? (row.weather_wave && row.weather_wave !== '—' 
                            ? (row.weather_wave.includes('m') ? row.weather_wave : `${row.weather_wave} m`) 
                            : (activityWeather ? `${activityWeather.wave_height} m` : '—'))
                        : '—',
                    weatherWind: showWeather
                        ? (row.weather_wind && row.weather_wind !== '—' 
                            ? (row.weather_wind.includes('kn') ? row.weather_wind : `${row.weather_wind} kn`) 
                            : (activityWeather ? `${activityWeather.wind_speed} kn` : '—'))
                        : '—',
                    submittedAt: row.logbook_entries?.[0]?.created_at || null,
                    deliveredQty: row.logbook_entries?.[0]?.structured_fields?.actual_cargo_tonnes || null,
                    msgCount: row.activity_messages?.filter(m => !m.is_read && m.sender_role !== userRole).length || 0,
                    unreadMsgCount: row.activity_messages?.filter(m => !m.is_read && m.sender_role !== userRole).length || 0,
                    totalMsgCount: row.activity_messages?.length || 0,
                    messages: row.activity_messages || [],
                    allMessagesText: (row.activity_messages || [])
                        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                        .map(m => {
                            const date = new Date(m.created_at).toISOString().replace('T', ' ').substring(0, 16);
                            return `[${date}] [${(m.sender_role || 'System').toUpperCase()}] ${m.message_text || ''}`;
                        })
                        .join(' | ') || '—'
                };
            });

            set({ 
                activities: mapped, 
                lastUpdate: new Date() 
            });
        } catch (err) {
            set({ error: err.message });
        } finally {
            set({ loading: false });
        }
    },



    fetchPlans: async () => {
        try {
            const { data, error } = await supabase.from('production_plans').select('*');
            if (error) throw error;
            set({ productionPlans: data || [] });
        } catch (err) {
            console.error(err);
        }
    },

    upsertPlan: async (plan) => {
        try {
            const { error } = await supabase.from('production_plans').upsert(plan);
            if (error) throw error;
            get().fetchPlans();
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    },

    deletePlan: async (id) => {
        try {
            const { error } = await supabase.from('production_plans').delete().eq('id', id);
            if (error) throw error;
            get().fetchPlans();
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }
}));

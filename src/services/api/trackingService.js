/**
 * trackingService.js — Queries per vessel_positions_history e vessel_tracking.
 * Centralizza tutte le chiamate Supabase relative al tracking storico delle navi.
 * Usato da: RewindMapTab, VesselMap (user_profiles overrides + realtime channel).
 */
import { supabase } from '../../lib/supabase';

/**
 * Carica i dati di tracking storico per un intervallo di date.
 * Pagina automaticamente fino al massimo consentito da PostgREST (1000 per pagina).
 * @param {Date} start
 * @param {Date} end
 * @returns {Promise<Array>} array di record vessel_tracking
 */
export async function fetchTrackingHistory(start, end) {
    let allData = [];
    let page = 0;
    const pageSize = 1000; // Limite PostgREST — non ridurre

    while (true) {
        const { data, error } = await supabase
            .from('vessel_tracking')
            .select('vessel_id, mmsi, lat, lon, heading, speed, status, timestamp')
            .gte('timestamp', start.toISOString())
            .lte('timestamp', end.toISOString())
            .order('timestamp', { ascending: true })
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allData = [...allData, ...data];
        if (data.length < pageSize) break;
        page++;
    }

    return allData;
}

/**
 * Legge i custom_overrides dell'utente corrente da user_profiles.
 * Usato da VesselMap per overriding visivo delle navi.
 * @param {string} userId
 * @returns {Promise<object|null>} oggetto custom_overrides o null
 */
export async function fetchUserCustomOverrides(userId) {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('custom_overrides')
        .eq('id', userId)
        .single();

    if (error) return null;
    return data?.custom_overrides ?? null;
}

/**
 * Aggiorna i custom_overrides dell'utente su user_profiles.
 * @param {string} userId
 * @param {object} updatedOverrides
 * @returns {Promise<void>}
 */
export async function updateUserCustomOverrides(userId, updatedOverrides) {
    const { error } = await supabase
        .from('user_profiles')
        .update({ custom_overrides: updatedOverrides })
        .eq('id', userId);

    if (error) throw error;
}

/**
 * Sottoscrive al canale realtime dei geofence globali.
 * @param {Function} onSync — callback chiamata ad ogni sync
 * @returns {RealtimeChannel} — chiamare .unsubscribe() per rimuovere
 */
export function subscribeToGeofenceSync(onSync) {
    const channel = supabase.channel('global_geofences_sync');
    channel.on('broadcast', { event: 'geofences_updated' }, onSync).subscribe();
    return channel;
}

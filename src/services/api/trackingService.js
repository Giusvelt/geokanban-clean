/**
 * trackingService.js — Queries per vessel_tracking, user_profiles overrides e vessel_tracking_periods.
 * Centralizza TUTTE le chiamate Supabase relative al tracking storico delle navi.
 * Usato da: RewindMapTab, VesselMap, DBManager.
 */
import { supabase } from '../../lib/supabase';

/**
 * Carica i dati di tracking storico per un intervallo di date.
 * Pagina automaticamente fino al massimo consentito da PostgREST (1000 per pagina).
 * @param {Date} start
 * @param {Date} end
 * @returns {Promise<Array>}
 */
export async function fetchTrackingHistory(start, end) {
    let allData = [];
    let page = 0;
    const pageSize = 1000;

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
 * @param {string} userId
 * @returns {Promise<object|null>}
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
 * Legge i custom_overrides del profilo operation_admin (o operation).
 * Usato da VesselMap per il toggle globale di visibilità geofence.
 * @returns {Promise<object|null>}
 */
export async function fetchAdminCustomOverrides() {
    const { data } = await supabase
        .from('user_profiles')
        .select('custom_overrides')
        .in('role', ['operation_admin', 'operation'])
        .limit(1)
        .single();

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
 * Sottoscrive ai cambiamenti realtime su user_profiles per aggiornamento overrides admin.
 * Sostituisce il canale inline in VesselMap.
 * @param {Function} onUpdate — callback(payload)
 * @returns {RealtimeChannel} — chiamare supabase.removeChannel() per cleanup
 */
export function subscribeToAdminProfileChanges(onUpdate) {
    return supabase
        .channel('global_geofences_sync')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_profiles' }, onUpdate)
        .subscribe();
}

/**
 * Carica i periodi di tracking attivi per una nave specifica.
 * @param {string} vesselId
 * @returns {Promise<Array>}
 */
export async function fetchTrackingPeriods(vesselId) {
    const { data, error } = await supabase
        .from('vessel_tracking_periods')
        .select('*')
        .eq('vessel_id', vesselId)
        .order('start_date', { ascending: true });

    if (error) throw error;
    return data || [];
}

/**
 * Salva (upsert + delete differenziale) i periodi di tracking per una nave.
 * Confronta lo stato attuale nel DB con quello passato e applica solo le differenze.
 * @param {string} vesselId
 * @param {Array} periods — array corrente (include temp-* per i nuovi record)
 * @returns {Promise<void>}
 */
export async function saveTrackingPeriods(vesselId, periods) {
    const { data: dbPeriods } = await supabase
        .from('vessel_tracking_periods')
        .select('id')
        .eq('vessel_id', vesselId);

    const dbIds = dbPeriods?.map(p => p.id) || [];
    const currentIds = periods.filter(p => !p.id.startsWith('temp-')).map(p => p.id);

    const deletedIds = dbIds.filter(id => !currentIds.includes(id));
    if (deletedIds.length > 0) {
        await supabase.from('vessel_tracking_periods').delete().in('id', deletedIds);
    }

    const toUpsert = periods.map(p => {
        const row = { vessel_id: vesselId, start_date: p.start_date, end_date: p.end_date };
        if (!p.id.startsWith('temp-')) row.id = p.id;
        return row;
    });

    if (toUpsert.length > 0) {
        const { error } = await supabase.from('vessel_tracking_periods').upsert(toUpsert);
        if (error) throw error;
    }
}

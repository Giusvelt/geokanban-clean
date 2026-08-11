import { useState, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';

export function useGeofences() {
    const [geofences, setGeofences] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchGeofences = async () => {
        if (!isSupabaseEnabled()) { setGeofences([]); return; }
        setLoading(true);
        const { data, error } = await supabase
            .from('geofences')
            .select('id, name, nature, lat, lon, color, family, polygon_coords')
            .order('name');
        if (!error && data) setGeofences(data);
        else console.error('Failed to load geofences:', error?.message);
        setLoading(false);
    };

    const addGeofence = async (g) => {
        const { data, error } = await supabase.from('geofences').insert([g]).select();
        if (!error) await fetchGeofences();
        return { success: !error, data: data?.[0], error: error?.message };
    };

    const updateGeofence = async (id, updates) => {
        const { error } = await supabase.from('geofences').update(updates).eq('id', id);
        if (!error) await fetchGeofences();
        return { success: !error, error: error?.message };
    };

    const deleteGeofence = async (id) => {
        const { error } = await supabase.from('geofences').delete().eq('id', id);
        if (!error) await fetchGeofences();
        return { success: !error, error: error?.message };
    };

    useEffect(() => { fetchGeofences(); }, []);

    return { geofences, loading, fetchGeofences, addGeofence, updateGeofence, deleteGeofence };
}

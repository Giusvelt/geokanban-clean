import { useState, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';

export function useVessels() {
    const [vessels, setVessels] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchVessels = async () => {
        if (!isSupabaseEnabled()) { setVessels([]); return; }
        setLoading(true);
        const { data, error } = await supabase.from('vessels').select('*').order('name');
        if (!error && data) setVessels(data);
        else console.error('Failed to load vessels:', error?.message);
        setLoading(false);
    };

    const addVessel = async (v) => {
        const { data, error } = await supabase.from('vessels').insert([v]).select();
        if (!error) await fetchVessels();
        return { success: !error, data: data?.[0], error: error?.message };
    };

    const updateVessel = async (id, updates) => {
        const { error } = await supabase.from('vessels').update(updates).eq('id', id);
        if (!error) await fetchVessels();
        return { success: !error, error: error?.message };
    };

    const deleteVessel = async (id) => {
        const { error } = await supabase.from('vessels').delete().eq('id', id);
        if (!error) await fetchVessels();
        return { success: !error, error: error?.message };
    };

    useEffect(() => { fetchVessels(); }, []);

    return { vessels, loading, fetchVessels, addVessel, updateVessel, deleteVessel };
}

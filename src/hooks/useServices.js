import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useServices() {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchServices = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('services')
            .select('*')
            .order('code');
        if (!error && data) setServices(data);
        setLoading(false);
    };

    const addService = async (item) => {
        const { data, error } = await supabase.from('services').insert(item).select().single();
        if (error) return { success: false, error: error.message };
        setServices(prev => [...prev, data]);
        return { success: true, data };
    };

    const updateService = async (id, updates) => {
        const { data, error } = await supabase.from('services').update(updates).eq('id', id).select().single();
        if (error) return { success: false, error: error.message };
        setServices(prev => prev.map(s => s.id === id ? data : s));
        return { success: true, data };
    };

    const deleteService = async (id) => {
        const { error } = await supabase.from('services').delete().eq('id', id);
        if (error) return { success: false, error: error.message };
        setServices(prev => prev.filter(s => s.id !== id));
        return { success: true };
    };

    useEffect(() => { fetchServices(); }, []);

    return { services, loading, fetchServices, addService, updateService, deleteService };
}

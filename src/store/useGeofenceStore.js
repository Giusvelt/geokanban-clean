import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export const useGeofenceStore = create((set) => ({
    geofences: [],
    loading: false,
    error: null,

    setGeofences: (geofences) => set({ geofences }),

    fetchGeofences: async () => {
        set({ loading: true });
        try {
            const { data, error } = await supabase
                .from('geofences')
                .select('*')
                .order('name');
            if (error) throw error;
            set({ geofences: data || [] });
        } catch (err) {
            set({ error: err.message });
        } finally {
            set({ loading: false });
        }
    },

    addGeofence: async (geo) => {
        try {
            const { data, error } = await supabase.from('geofences').insert(geo).select().single();
            if (error) throw error;
            set(state => ({ geofences: [...state.geofences, data] }));
            return { success: true, data };
        } catch (err) {
            return { success: false, error: err.message };
        }
    },

    updateGeofence: async (id, updates) => {
        try {
            const { error } = await supabase.from('geofences').update(updates).eq('id', id);
            if (error) throw error;
            set(state => ({
                geofences: state.geofences.map(g => g.id === id ? { ...g, ...updates } : g)
            }));
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    },

    deleteGeofence: async (id) => {
        try {
            const { error } = await supabase.from('geofences').delete().eq('id', id);
            if (error) throw error;
            set(state => ({ geofences: state.geofences.filter(g => g.id !== id) }));
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }
}));

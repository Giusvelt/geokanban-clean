import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export const useConfigStore = create((set) => ({
    profile: null,
    standbyReasons: [],
    schedules: [],
    loading: false,

    setProfile: (profile) => set({ profile }),

    fetchReasons: async () => {
        const { data } = await supabase.from('standby_reasons').select('*').order('name');
        set({ standbyReasons: data || [] });
    },

    fetchSchedules: async () => {
        const { data } = await supabase.from('vessel_standby_schedule').select(`
            id, vessel_id, standby_reason_id, standby_date, notes, created_at, is_approved, all_day, start_time, end_time,
            standby_reasons ( name, code ), vessels ( name )
        `);
        set({ schedules: data || [] });
    },

    approveSchedule: async (id, adminId) => {
        const { error } = await supabase.from('vessel_standby_schedule')
            .update({ is_approved: true, approved_by: adminId, approved_at: new Date().toISOString() })
            .eq('id', id);
        if (!error) {
            set(state => ({
                schedules: state.schedules.map(s => s.id === id ? { ...s, is_approved: true } : s)
            }));
        }
        return { success: !error };
    },

    rejectSchedule: async (id) => {
        const { error } = await supabase.from('vessel_standby_schedule').delete().eq('id', id);
        if (!error) set(state => ({ schedules: state.schedules.filter(s => s.id !== id) }));
        return { success: !error };
    },

    upsertSchedule: async (schedule) => {
        const { data, error } = await supabase.from('vessel_standby_schedule').upsert(schedule).select(`
            id, vessel_id, standby_reason_id, standby_date, notes, created_at, is_approved, all_day, start_time, end_time,
            standby_reasons ( name, code ), vessels ( name )
        `).single();
        if (!error && data) {
            set(state => {
                const existing = state.schedules.find(s => s.id === data.id);
                return {
                    schedules: existing 
                        ? state.schedules.map(s => s.id === data.id ? data : s)
                        : [...state.schedules, data]
                };
            });
        }
        return { success: !error };
    },

    deleteSchedule: async (id) => {
        const { error } = await supabase.from('vessel_standby_schedule').delete().eq('id', id);
        if (!error) set(state => ({ schedules: state.schedules.filter(s => s.id !== id) }));
        return { success: !error };
    },

    addStandbyReason: async (reason) => {
        const { data, error } = await supabase.from('standby_reasons').insert([reason]).select();
        if (!error) set(state => ({ standbyReasons: [...state.standbyReasons, data[0]] }));
        return { success: !error };
    },
    updateStandbyReason: async (id, updates) => {
        const { error } = await supabase.from('standby_reasons').update(updates).eq('id', id);
        if (!error) set(state => ({ standbyReasons: state.standbyReasons.map(r => r.id === id ? { ...r, ...updates } : r) }));
        return { success: !error };
    },
    deleteStandbyReason: async (id) => {
        const { error } = await supabase.from('standby_reasons').delete().eq('id', id);
        if (!error) set(state => ({ standbyReasons: state.standbyReasons.filter(r => r.id !== id) }));
        return { success: !error };
    }
}));

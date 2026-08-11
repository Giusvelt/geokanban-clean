import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useStandbys() {
    const [standbyReasons, setStandbyReasons] = useState([]);
    const [schedules, setSchedules] = useState([]);

    const fetchStandbyReasons = useCallback(async () => {
        const { data, error } = await supabase.from('standby_reasons').select('*').order('name');
        if (!error) setStandbyReasons(data || []);
    }, []);

    const fetchSchedules = useCallback(async () => {
        const { data, error } = await supabase.from('vessel_standby_schedule').select(`
            id, vessel_id, standby_reason_id, standby_date, notes, created_at, all_day, start_time, end_time,
            standby_reasons ( name, code ), vessels ( name )
        `);
        if (!error) setSchedules(data || []);
    }, []);

    const addStandbyReason = async (reason) => {
        const { error } = await supabase.from('standby_reasons').insert([reason]);
        if (!error) await fetchStandbyReasons();
        return { success: !error, error: error?.message };
    };

    const updateStandbyReason = async (id, updates) => {
        const { error } = await supabase.from('standby_reasons').update(updates).eq('id', id);
        if (!error) await fetchStandbyReasons();
        return { success: !error, error: error?.message };
    };

    const deleteStandbyReason = async (id) => {
        const { error } = await supabase.from('standby_reasons').delete().eq('id', id);
        if (!error) await fetchStandbyReasons();
        return { success: !error, error: error?.message };
    };

    const upsertSchedule = async (scheduleData) => {
        const { error } = await supabase.from('vessel_standby_schedule').upsert(scheduleData, { onConflict: 'vessel_id, standby_date' });
        if (!error) await fetchSchedules();
        return { error };
    };

    const deleteSchedule = async (id) => {
        const { error } = await supabase.from('vessel_standby_schedule').delete().eq('id', id);
        if (!error) await fetchSchedules();
        return { error };
    };

    useEffect(() => {
        fetchStandbyReasons();
        fetchSchedules();
    }, [fetchStandbyReasons, fetchSchedules]);

    return {
        standbyReasons,
        schedules,
        fetchStandbyReasons,
        addStandbyReason,
        updateStandbyReason,
        deleteStandbyReason,
        fetchSchedules,
        upsertSchedule,
        deleteSchedule
    };
}

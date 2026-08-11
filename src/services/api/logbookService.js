import { supabase } from '../../lib/supabase';

export const logbookService = {
    async updateActivityTimes(activityId, updates) {
        if (!updates || Object.keys(updates).length === 0) return;
        const { error } = await supabase.from('vessel_activity').update(updates).eq('id', activityId);
        if (error) throw error;
    },

    async upsertLogbookEntry(existingId, payload) {
        if (existingId) {
            const { error } = await supabase.from('logbook_entries').update(payload).eq('id', existingId);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('logbook_entries').insert(payload);
            if (error) throw error;
        }
    }
};

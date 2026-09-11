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
    },
    async fetchLogbookEntriesByActivityIds(ids) {
        return await supabase
            .from('logbook_entries')
            .select('id, vessel_activity_id, status, narrative_text, structured_fields, document_hash, message_snapshot, logbook_services(*)')
            .in('vessel_activity_id', ids);
    },
    async updateStructuredFields(entryId, updatedFields) {
        return await supabase
            .from('logbook_entries')
            .update({ structured_fields: updatedFields })
            .eq('id', entryId);
    },
    async fetchServicesCatalog() {
        return await supabase.from('services').select('*');
    },
    async insertServiceCatalogItem(item) {
        return await supabase.from('services').insert(item).select().single();
    },
    async updateServiceCatalogItem(id, updates) {
        return await supabase.from('services').update(updates).eq('id', id).select().single();
    },
    async deleteServiceCatalogItem(id) {
        return await supabase.from('services').delete().eq('id', id);
    },
    async fetchLogbookByActivity(activityId) {
        return await supabase
            .from('logbook_entries')
            .select('*, vessels(name, mmsi)')
            .eq('vessel_activity_id', activityId)
            .maybeSingle();
    },
    async fetchLogbookServices(entryId) {
        return await supabase
            .from('logbook_services')
            .select('*, services(name, code, provider)')
            .eq('logbook_entry_id', entryId);
    },
    async updateLogbookNarrative(entryId, text) {
        return await supabase
            .from('logbook_entries')
            .update({ narrative_text: text, updated_at: new Date() })
            .eq('id', entryId);
    },
    async submitLogbookEntry(entryId) {
        return await supabase
            .from('logbook_entries')
            .update({ status: 'submitted' })
            .eq('id', entryId);
    },
    async addLogbookService(entryId, serviceId, qty, start, end, details) {
        return await supabase
            .from('logbook_services')
            .insert({
                logbook_entry_id: entryId,
                service_id: serviceId,
                quantity: qty,
                start_time: start,
                end_time: end,
                details: details
            });
    },
    async removeLogbookService(id) {
        return await supabase
            .from('logbook_services')
            .delete()
            .eq('id', id);
    },
    async updateLogbookService(id, updates) {
        return await supabase
            .from('logbook_services')
            .update(updates)
            .eq('id', id);
    }
};
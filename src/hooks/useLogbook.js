import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Hook to manage a single logbook entry for a vessel activity.
 */
export function useLogbook(activityId) {
    const [entry, setEntry] = useState(null);
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchLogbook = useCallback(async () => {
        if (!activityId) return;
        setLoading(true);
        try {
            // Get logbook entry
            const { data, error: e1 } = await supabase
                .from('logbook_entries')
                .select('*, vessels(name, mmsi)')
                .eq('vessel_activity_id', activityId)
                .maybeSingle();

            if (e1) throw e1;

            if (data) {
                setEntry(data);
                // Get services
                const { data: svc, error: e2 } = await supabase
                    .from('logbook_services')
                    .select('*, services(name, code, provider)')
                    .eq('logbook_entry_id', data.id);
                if (e2) throw e2;
                setServices(svc || []);
            } else {
                setEntry(null);
                setServices([]);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [activityId]);

    useEffect(() => {
        fetchLogbook();
    }, [fetchLogbook]);

    const saveNarrative = async (text) => {
        if (!entry) return { success: false, error: 'No entry' };
        try {
            const { error } = await supabase
                .from('logbook_entries')
                .update({ narrative_text: text, updated_at: new Date() })
                .eq('id', entry.id);
            if (error) throw error;
            await fetchLogbook();
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    const submitLogbook = async () => {
        if (!entry) return { success: false, error: 'No entry' };
        try {
            const { error } = await supabase
                .from('logbook_entries')
                .update({ status: 'submitted' })
                .eq('id', entry.id);
            if (error) throw error;
            await fetchLogbook();
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    const addService = async (serviceId, qty = 1) => {
        if (!entry) return { success: false, error: 'No entry' };
        try {
            const { error } = await supabase
                .from('logbook_services')
                .insert({
                    logbook_entry_id: entry.id,
                    service_id: serviceId,
                    quantity: qty
                });
            if (error) throw error;
            await fetchLogbook();
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    const removeService = async (svcEntryId) => {
        try {
            const { error } = await supabase
                .from('logbook_services')
                .delete()
                .eq('id', svcEntryId);
            if (error) throw error;
            await fetchLogbook();
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    const updateService = async (svcEntryId, updates) => {
        try {
            const { error } = await supabase
                .from('logbook_services')
                .update(updates)
                .eq('id', svcEntryId);
            if (error) throw error;
            await fetchLogbook();
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    return {
        entry,
        services,
        loading,
        error,
        saveNarrative,
        submitLogbook,
        addService,
        removeService,
        updateService,
        refresh: fetchLogbook
    };
}

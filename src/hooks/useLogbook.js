import { useState, useCallback, useEffect } from 'react';
import { logbookService } from '../services/api/logbookService';

export function useLogbook(activityId) {
    const [entry, setEntry] = useState(null);
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchLogbook = useCallback(async () => {
        if (!activityId) return;
        setLoading(true);
        try {
            const { data, error: e1 } = await logbookService.fetchLogbookByActivity(activityId);
            if (e1) throw e1;

            if (data) {
                setEntry(data);
                const { data: svc, error: e2 } = await logbookService.fetchLogbookServices(data.id);
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
            const { error } = await logbookService.updateLogbookNarrative(entry.id, text);
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
            const { error } = await logbookService.submitLogbookEntry(entry.id);
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
            const { error } = await logbookService.addLogbookService(entry.id, serviceId, qty, null, null, null);
            if (error) throw error;
            await fetchLogbook();
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    const removeService = async (svcEntryId) => {
        try {
            const { error } = await logbookService.removeLogbookService(svcEntryId);
            if (error) throw error;
            await fetchLogbook();
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    const updateService = async (svcEntryId, updates) => {
        try {
            const { error } = await logbookService.updateLogbookService(svcEntryId, updates);
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

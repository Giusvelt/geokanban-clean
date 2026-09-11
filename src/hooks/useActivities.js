import { useState, useEffect } from 'react';
import { activityService } from '../services/api/activityService';

export function useActivities() {
    const [activityTypes, setActivityTypes] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchActivityTypes = async () => {
        setLoading(true);
        const { data, error } = await activityService.fetchActivityTypes()
            .order('code');
        if (!error && data) setActivityTypes(data);
        setLoading(false);
    };

    const addActivityType = async (item) => {
        const { data, error } = await activityService.insertActivityType(item);
        if (error) return { success: false, error: error.message };
        setActivityTypes(prev => [...prev, data]);
        return { success: true, data };
    };

    const updateActivityType = async (id, updates) => {
        const { data, error } = await activityService.updateActivityType(id, updates);
        if (error) return { success: false, error: error.message };
        setActivityTypes(prev => prev.map(a => a.id === id ? data : a));
        return { success: true, data };
    };

    const deleteActivityType = async (id) => {
        const { error } = await activityService.deleteActivityType(id);
        if (error) return { success: false, error: error.message };
        setActivityTypes(prev => prev.filter(a => a.id !== id));
        return { success: true };
    };

    useEffect(() => { fetchActivityTypes(); }, []);

    return { activityTypes, loading, fetchActivityTypes, addActivityType, updateActivityType, deleteActivityType };
}

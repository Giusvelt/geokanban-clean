import { useState, useEffect } from 'react';
import { logbookService } from '../services/api/logbookService';

export function useServices() {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchServices = async () => {
        setLoading(true);
        const { data, error } = await logbookService.fetchServicesCatalog()
            .order('code');
        if (!error && data) setServices(data);
        setLoading(false);
    };

    const addService = async (item) => {
        const { data, error } = await logbookService.insertServiceCatalogItem(item);
        if (error) return { success: false, error: error.message };
        setServices(prev => [...prev, data]);
        return { success: true, data };
    };

    const updateService = async (id, updates) => {
        const { data, error } = await logbookService.updateServiceCatalogItem(id, updates);
        if (error) return { success: false, error: error.message };
        setServices(prev => prev.map(s => s.id === id ? data : s));
        return { success: true, data };
    };

    const deleteService = async (id) => {
        const { error } = await logbookService.deleteServiceCatalogItem(id);
        if (error) return { success: false, error: error.message };
        setServices(prev => prev.filter(s => s.id !== id));
        return { success: true };
    };

    useEffect(() => { fetchServices(); }, []);

    return { services, loading, fetchServices, addService, updateService, deleteService };
}

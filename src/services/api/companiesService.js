import { supabase } from '../../lib/supabase';

export const companiesService = {
    async fetchAll() {
        const { data, error } = await supabase.from('companies').select('*').order('name');
        if (error) throw error;
        return data || [];
    },
    async delete(id) {
        const { error } = await supabase.from('companies').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    },
    async update(id, updates) {
        const { error } = await supabase.from('companies').update(updates).eq('id', id);
        if (error) throw error;
        return { success: true };
    },
    async insert(company) {
        const { error } = await supabase.from('companies').insert([company]);
        if (error) throw error;
        return { success: true };
    }
};

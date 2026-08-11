import { supabase } from '../../lib/supabase';

export const metricsService = {
    async fetchUserStats() {
        const { data, error } = await supabase.from('user_profiles').select('last_seen_at');
        if (error) throw error;
        
        let total = 0;
        let online = 0;
        
        if (data) {
            total = data.length;
            const now = Date.now();
            online = data.filter(u => u.last_seen_at && (now - new Date(u.last_seen_at).getTime()) < 2 * 60 * 1000).length;
        }
        
        return { total, online };
    },
    
    async fetchPointCloudCount() {
        const { count, error } = await supabase.from('point_clouds').select('*', { count: 'exact', head: true });
        if (error) throw error;
        return count || 0;
    }
};

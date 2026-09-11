import { supabase } from '../../lib/supabase';

export const healthService = {
    async checkKPIEngine() {
        return await supabase.rpc('sync_production_plan', { 
            p_vessel_id: '00000000-0000-0000-0000-000000000000', 
            p_period_name: 'HEALTH_CHECK' 
        }).limit(1);
    },
    async fetchLastPosition() {
        return await supabase.from('vessel_positions').select('created_at').order('created_at', { ascending: false }).limit(1);
    },
    async fetchLoad24h(dayAgo) {
        return await Promise.all([
            supabase.from('vessel_positions').select('*', { count: 'exact', head: true }).gt('created_at', dayAgo),
            supabase.from('geofence_events').select('*', { count: 'exact', head: true }).gt('created_at', dayAgo)
        ]);
    },
    async fetchVesselsHealth() {
        return await supabase.from('vessels').select('id, name, mmsi');
    },
    async fetchActivitiesHealth() {
        return await supabase.from('vessel_activity').select('id, status, source, start_event_id');
    },
    async fetchProfilesHealth() {
        return await supabase.from('user_profiles').select('id, role, is_blocked');
    }
};

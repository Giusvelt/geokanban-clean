import re
with open('src/context/DataContext.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace("import { supabase } from '../lib/supabase';", "import { pubsubService } from '../services/api/pubsubService';")

fetch_str = '''const channel = supabase
            .channel('kpi-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'logbook_entries' },
                () => {
                    fetchActivities(targetId, profile?.role);
                    fetchPlans(); // Sync KPI Admin
                }
            )
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vessel_activity' },
                () => { fetchActivities(targetId, profile?.role); }
            )
            .subscribe();'''
new_str = '''const channel = pubsubService.subscribeGlobal('kpi-realtime', { event: '*', schema: 'public' }, (payload) => {
            if (payload.table === 'logbook_entries') {
                fetchActivities(targetId, profile?.role);
                fetchPlans(); // Sync KPI Admin
            } else if (payload.table === 'vessel_activity' && payload.eventType === 'INSERT') {
                fetchActivities(targetId, profile?.role);
            }
        });'''
c = c.replace(fetch_str, new_str)
c = c.replace("supabase.removeChannel(channel);", "pubsubService.unsubscribe(channel);")
c = c.replace("if (channel) supabase.removeChannel(channel);", "if (channel) pubsubService.unsubscribe(channel);")

with open('src/context/DataContext.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

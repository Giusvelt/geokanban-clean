import sys

with open('src/context/DataContext.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace("import { supabase } from '../lib/supabase';", "import { pubsubService } from '../services/api/pubsubService';")

fetch_str = '''const channel = supabase
            .channel('operations_channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vessel_activity' }, () => {
                fetchActivities();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'logbook_entries' }, () => {
                fetchActivities();
            })
            .subscribe();'''
new_str = '''const channel = pubsubService.subscribeGlobal('operations_channel', { event: '*', schema: 'public' }, (payload) => {
            if (['vessel_activity', 'logbook_entries'].includes(payload.table)) {
                fetchActivities();
            }
        });'''
c = c.replace(fetch_str, new_str)

c = c.replace("supabase.removeChannel(channel)", "pubsubService.unsubscribe(channel)")

with open('src/context/DataContext.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

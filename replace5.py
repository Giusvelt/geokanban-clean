import sys

with open('src/hooks/useHealthCheck.js', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace("import { supabase } from '../lib/supabase';", "import { healthService } from '../services/api/healthService';")
c = c.replace("await supabase.rpc('sync_production_plan', { \n                p_vessel_id: '00000000-0000-0000-0000-000000000000', \n                p_period_name: 'HEALTH_CHECK' \n            }).limit(1);", "await healthService.checkKPIEngine();")
c = c.replace("await supabase.from('vessel_positions').select('created_at').order('created_at', { ascending: false }).limit(1);", "await healthService.fetchLastPosition();")
c = c.replace("await Promise.all([\n                supabase.from('vessel_positions').select('*', { count: 'exact', head: true }).gt('created_at', dayAgo),\n                supabase.from('geofence_events').select('*', { count: 'exact', head: true }).gt('created_at', dayAgo)\n            ]);", "await healthService.fetchLoad24h(dayAgo);")
c = c.replace("await supabase.from('vessels').select('id, name, mmsi');", "await healthService.fetchVesselsHealth();")
c = c.replace("await supabase.from('vessel_activity').select('id, status, source, start_event_id');", "await healthService.fetchActivitiesHealth();")
c = c.replace("await supabase.from('user_profiles').select('id, role, is_blocked');", "await healthService.fetchProfilesHealth();")

with open('src/hooks/useHealthCheck.js', 'w', encoding='utf-8') as f:
    f.write(c)

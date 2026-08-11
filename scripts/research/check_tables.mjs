import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envPath = 'c:/Users/giuse/Desktop/ANTIGRAVITY/geokanban_v3/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
const env = {};
envLines.forEach(line => { if (line.includes('=')) { const [k, v] = line.split('='); env[k.trim()] = v.trim(); } });

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function listAll() {
    const { data, error } = await supabase.from('vessels').select('id').limit(1);
    if (error) { console.log('Auth failing or table missing?'); return; }

    // Check available tables by trying queries
    const tables = ['vessels', 'geofences', 'vessel_tracking', 'geofence_events', 'vessel_activity', 'vessel_activities', 'activity_messages', 'weather_logs', 'weather_history', 'production_plans'];
    for (const t of tables) {
        const { count, error: tErr } = await supabase.from(t).select('*', { count: 'exact', head: true });
        if (tErr) console.log(`Table ${t} does not exist or access denied: ${tErr.message}`);
        else console.log(`Table ${t} exists. Count: ${count}`);
    }
}
listAll();

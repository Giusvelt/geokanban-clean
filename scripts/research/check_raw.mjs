import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envPath = 'c:/Users/giuse/Desktop/ANTIGRAVITY/geokanban_v3/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
const env = {};
envLines.forEach(line => { if (line.includes('=')) { const [k, v] = line.split('='); env[k.trim()] = v.trim(); } });

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { count: events } = await supabase.from('geofence_events').select('*', { count: 'exact', head: true });
    const { count: vessels } = await supabase.from('vessels').select('*', { count: 'exact', head: true });
    const { count: tracking } = await supabase.from('vessel_tracking').select('*', { count: 'exact', head: true });

    console.log('--- RAW DATA CHECK ---');
    console.log('Vessels:', vessels);
    console.log('Geofence Events:', events);
    console.log('Vessel Tracking:', tracking);
}
check();

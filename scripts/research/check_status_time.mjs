import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envPath = 'c:/Users/giuse/Desktop/ANTIGRAVITY/geokanban_v3/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
const env = {};
envLines.forEach(line => { if (line.includes('=')) { const [k, v] = line.split('='); env[k.trim()] = v.trim(); } });

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkStatusLastAt() {
    console.log('--- Checking Geofence Status for Fabio Duo ---');
    const { data: vessel } = await supabase.from('vessels').select('id').ilike('name', '%Fabio Duo%').single();

    const { data: statuses } = await supabase
        .from('vessel_geofence_status')
        .select('*, geofences(name)')
        .eq('vessel_id', vessel.id);

    statuses?.forEach(s => {
        console.log(`${s.geofences.name}: ${s.status} (at ${s.last_check_at})`);
    });
}
checkStatusLastAt();

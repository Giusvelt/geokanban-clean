import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envPath = 'c:/Users/giuse/Desktop/ANTIGRAVITY/geokanban_v3/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
const env = {};
envLines.forEach(line => { if (line.includes('=')) { const [k, v] = line.split('='); env[k.trim()] = v.trim(); } });

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkVessel() {
    console.log('--- Checking Fabio Duo Z ---');
    const { data: vessel, error } = await supabase
        .from('vessels')
        .select('*')
        .ilike('name', '%Fabio Duo%')
        .single();

    if (error) {
        console.error('Error finding vessel:', error.message);
        return;
    }

    console.log('Vessel Data:', vessel);

    if (!vessel.mmsi) {
        console.error('CRITICAL: MMSI is missing for this vessel!');
    }

    // Check tracking
    const { data: tracking } = await supabase
        .from('vessel_tracking')
        .select('*')
        .eq('vessel_id', vessel.id)
        .order('timestamp', { ascending: false })
        .limit(5);

    console.log('Recent Tracking (last 5):', tracking);

    // Check geofence events
    const { data: events } = await supabase
        .from('geofence_events')
        .select('*')
        .eq('vessel_id', vessel.id)
        .order('timestamp', { ascending: false })
        .limit(5);

    console.log('Recent Geofence Events (last 5):', events);

    // Check status memory
    const { data: status } = await supabase
        .from('vessel_geofence_status')
        .select('*, geofences(name)')
        .eq('vessel_id', vessel.id);

    console.log('Current Geofence Status:', status?.map(s => `${s.geofences.name}: ${s.status}`));
}
checkVessel();

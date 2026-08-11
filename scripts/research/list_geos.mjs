import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envPath = 'c:/Users/giuse/Desktop/ANTIGRAVITY/geokanban_v3/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
const env = {};
envLines.forEach(line => { if (line.includes('=')) { const [k, v] = line.split('='); env[k.trim()] = v.trim(); } });

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkGeofences() {
    console.log('--- Geofences Check ---');
    const { data: geofences, error } = await supabase
        .from('geofences')
        .select('id, name, nature, polygon_coords');

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    geofences.forEach(g => {
        console.log(`- ${g.name} (${g.nature})`);
    });
}
checkGeofences();

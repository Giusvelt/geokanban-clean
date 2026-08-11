import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envPath = 'c:/Users/giuse/Desktop/ANTIGRAVITY/geokanban_v3/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
const env = {};
envLines.forEach(line => { if (line.includes('=')) { const [k, v] = line.split('='); env[k.trim()] = v.trim(); } });

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function listAll() {
    const { data, error } = await supabase.from('vessels').select('name').limit(1);
    console.log('Vessels read:', data);

    const { data: va, error: vaErr } = await supabase.from('vessel_activity').select('*');
    console.log('Vessel Activity row count:', va?.length);
    if (vaErr) console.error(vaErr);
}
listAll();

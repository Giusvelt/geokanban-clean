import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envPath = 'c:/Users/giuse/Desktop/ANTIGRAVITY/geokanban_v3/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
const env = {};
envLines.forEach(line => { if (line.includes('=')) { const [k, v] = line.split('='); env[k.trim()] = v.trim(); } });

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function listTables() {
    const { data, error } = await supabase.from('vessel_activity').select('*').limit(1);
    if (error) console.error('Error selecting from vessel_activity:', error);
    else console.log('Successfully read from vessel_activity. Row count:', data.length);
}
listTables();

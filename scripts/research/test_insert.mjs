import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envPath = 'c:/Users/giuse/Desktop/ANTIGRAVITY/geokanban_v3/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
const env = {};
envLines.forEach(line => { if (line.includes('=')) { const [k, v] = line.split('='); env[k.trim()] = v.trim(); } });

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function test() {
    await supabase.auth.signInWithPassword({ email: 'giuseppe.berrelli@gmail.com', password: 'admin123' });

    const { data: v } = await supabase.from('vessels').select('id').limit(1);

    console.log('Inserting dummy activity...');
    const { data, error } = await supabase.from('vessel_activity').insert({
        vessel_id: v[0].id,
        activity_type: 'Test',
        start_time: new Date().toISOString(),
        status: 'active'
    }).select();

    if (error) console.error(error);
    else console.log('Insert success!', data);
}
test();

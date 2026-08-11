import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envPath = '.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
const env = {};
envLines.forEach(line => { if (line.includes('=')) { const [k, v] = line.split('='); env[k.trim()] = v.trim(); } });

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkWeather() {
    const { count, error } = await supabase.from('weather_logs').select('*', { count: 'exact', head: true });
    console.log('Weather Logs Count:', count);

    if (count > 0) {
        const { data } = await supabase.from('weather_logs').select('*').limit(3);
        console.log('Sample Data:', JSON.stringify(data, null, 2));
    }
}
checkWeather();

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envPath = '.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
const env = {};
// Safely parse env ignoring trailing comments and split on first =
envLines.forEach(line => {
    if (line.includes('=')) {
        const parts = line.split('=');
        const k = parts[0].trim();
        const v = parts.slice(1).join('=').trim(); // rejoin in case of b64 padding
        env[k] = v;
    }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function runTest() {
    // Authenticate
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: 'veromidollo@gmail.com',
        password: 'crew123',
    });

    if (authErr) {
        console.error('Login failed:', authErr.message);
        return;
    }

    console.log('Login successful.');

    // Fetch all vessel_activity
    const { data, error } = await supabase.from('vessel_activity').select('*');
    if (error) {
        console.error('Fetch error:', error.message);
        return;
    }

    console.log(`Total activities in DB: ${data.length}`);

    // Process for March 2026
    let loading = 0;
    let unloading = 0;
    let navigation = 0;
    const vessels = new Set();

    data.forEach(a => {
        const d = new Date(a.start_time);

        // Month is 0-indexed in JS (2 = March)
        if (d.getMonth() === 2 && d.getFullYear() === 2026) {
            vessels.add(a.vessel_id);
            if (a.activity_type.toLowerCase() === 'loading') loading++;
            else if (a.activity_type.toLowerCase() === 'unloading') unloading++;
            else if (a.activity_type.toLowerCase() === 'navigation') navigation++;
        }
    });

    console.log(`--- RESULTS FOR MARCH 2026 ---`);
    console.log(`Loading: ${loading}`);
    console.log(`Navigation: ${navigation}`);
    console.log(`Unloading: ${unloading}`);
    console.log(`Unique Tracked Vessels (with activity in March): ${vessels.size}`);
}

runTest();

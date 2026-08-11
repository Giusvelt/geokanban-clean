import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual parsing of .env.local
const envPath = 'c:/Users/giuse/Desktop/ANTIGRAVITY/geokanban_v3/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
const env = {};
envLines.forEach(line => {
    if (line.includes('=')) {
        const [key, value] = line.split('=');
        env[key.trim()] = value.trim();
    }
});

const supabase = createClient(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_ANON_KEY
);

async function check() {
    console.log('--- DB Check ---');
    try {
        const { count, error } = await supabase
            .from('vessel_activity')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('Vessel Activity Error:', error.message);
        } else {
            console.log('Vessel Activity Count:', count);
        }

        const { count: logbookCount, error: logError } = await supabase
            .from('logbook_entries')
            .select('*', { count: 'exact', head: true });

        if (logError) {
            console.error('Logbook Error:', logError.message);
        } else {
            console.log('Logbook Entries Count:', logbookCount);
        }

        const { data: latest, error: lastErr } = await supabase
            .from('vessel_activity')
            .select('activity_type, start_time')
            .order('start_time', { ascending: false })
            .limit(1);

        if (latest && latest.length > 0) {
            console.log('Latest Activity:', latest[0]);
        }

    } catch (e) {
        console.error('Unexpected error:', e.message);
    }
}

check();

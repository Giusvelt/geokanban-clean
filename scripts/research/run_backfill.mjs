import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envPath = 'c:/Users/giuse/Desktop/ANTIGRAVITY/geokanban_v3/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
const env = {};
envLines.forEach(line => { if (line.includes('=')) { const [k, v] = line.split('='); env[k.trim()] = v.trim(); } });

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function backfill() {
    console.log('--- Logging in as Admin ---');
    const { error: authErr } = await supabase.auth.signInWithPassword({
        email: 'giuseppe.berrelli@gmail.com',
        password: 'admin123'
    });
    if (authErr) { console.error('Auth failed:', authErr.message); return; }

    console.log('--- Backfilling Activity Table ---');

    // 1. Get all ENTER events
    const { data: enters, error: eErr } = await supabase
        .from('geofence_events')
        .select('*, geofences(nature)')
        .eq('event_type', 'ENTER');

    if (eErr) { console.error(eErr); return; }
    console.log(`Found ${enters.length} ENTER events.`);

    for (const enter of enters) {
        const nature = enter.geofences?.nature;
        const activityType =
            nature === 'loading_site' ? 'Loading' :
                nature === 'unloading_site' ? 'Unloading' :
                    nature === 'anchorage' ? 'Anchorage' :
                        nature === 'port' ? 'Port Operations' : 'Transit';

        const { data: va, error: vaErr } = await supabase
            .from('vessel_activity')
            .upsert({
                vessel_id: enter.vessel_id,
                activity_type: activityType,
                geofence_id: enter.geofence_id,
                start_event_id: enter.id,
                start_time: enter.timestamp,
                source: 'geofence',
                status: 'active'
            }, { onConflict: 'start_event_id' })
            .select();

        if (vaErr) console.error('Error inserting activity:', vaErr.message);
    }

    // 2. Get all EXIT events to close activities
    const { data: exits, error: exErr } = await supabase
        .from('geofence_events')
        .select('*')
        .eq('event_type', 'EXIT')
        .order('timestamp', { ascending: true });

    if (exErr) { console.error(exErr); return; }
    console.log(`Found ${exits.length} EXIT events.`);

    for (const exit of exits) {
        const { data: openVa } = await supabase
            .from('vessel_activity')
            .select('id')
            .eq('vessel_id', exit.vessel_id)
            .eq('geofence_id', exit.geofence_id)
            .eq('status', 'active')
            .lt('start_time', exit.timestamp)
            .order('start_time', { ascending: false })
            .limit(1);

        if (openVa && openVa.length > 0) {
            await supabase
                .from('vessel_activity')
                .update({
                    end_event_id: exit.id,
                    end_time: exit.timestamp,
                    status: 'completed'
                })
                .eq('id', openVa[0].id);
        }
    }

    console.log('✅ Backfill complete.');
}

backfill();

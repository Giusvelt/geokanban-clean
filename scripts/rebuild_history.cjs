/**
 * GK_V3 — Historical Activity Reconstruction
 * 
 * Processes ALL vessel_tracking records chronologically and generates
 * ENTER/EXIT geofence events by detecting when vessels cross polygon boundaries.
 * 
 * This rebuilds the complete activity timeline from the stored position data.
 * 
 * Usage: node scripts/rebuild_history.cjs
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

// Point-in-Polygon (Ray Casting)
function isPointInPolygon(lat, lon, polygon) {
    let inside = false;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const [latI, lonI] = polygon[i];
        const [latJ, lonJ] = polygon[j];
        const intersects = ((lonI > lon) !== (lonJ > lon)) &&
            (lat < ((latJ - latI) * (lon - lonI)) / (lonJ - lonI) + latI);
        if (intersects) inside = !inside;
    }
    return inside;
}

async function main() {
    console.log('📜 GeoKanban V3 — Historical Activity Reconstruction');
    console.log('━'.repeat(55));

    // Authenticate
    const { error: authErr } = await supabase.auth.signInWithPassword({
        email: 'giuseppe.berrelli@gmail.com',
        password: 'admin123'
    });
    if (authErr) { console.error('❌ Auth failed:', authErr.message); return; }

    // Load vessels and geofences
    const { data: vessels } = await supabase.from('vessels').select('id, name, mmsi');
    const { data: geofences } = await supabase.from('geofences').select('id, name, nature, polygon_coords');

    // Parse geofence polygons
    const parsedGeos = geofences.map(g => {
        try {
            const coords = typeof g.polygon_coords === 'string'
                ? JSON.parse(g.polygon_coords) : g.polygon_coords;
            if (Array.isArray(coords) && coords.length >= 3) return { ...g, coords };
        } catch { /* skip */ }
        return null;
    }).filter(Boolean);

    console.log(`📊 ${vessels.length} vessels, ${parsedGeos.length} geofences with valid polygons`);

    // First, clear old events to avoid duplicates
    console.log('🗑️  Clearing existing geofence_events...');
    const { error: delErr } = await supabase.from('geofence_events').delete().gte('id', '00000000-0000-0000-0000-000000000000');
    if (delErr) console.log('  ⚠️  Delete warning:', delErr.message);

    let totalEvents = 0;

    // Process each vessel
    for (const vessel of vessels) {
        console.log(`\n🚢 Processing ${vessel.name}...`);

        // Load ALL tracking data for this vessel, chronologically
        const { data: tracks, error: trackErr } = await supabase
            .from('vessel_tracking')
            .select('lat, lon, speed, timestamp')
            .eq('vessel_id', vessel.id)
            .order('timestamp', { ascending: true });

        if (trackErr || !tracks || tracks.length === 0) {
            console.log('  ⚠️  No tracking data');
            continue;
        }

        console.log(`  📍 ${tracks.length} positions (${tracks[0].timestamp} → ${tracks[tracks.length - 1].timestamp})`);

        // Track previous status for each geofence
        const prevStatus = {}; // geofenceId -> 'INSIDE' | 'OUTSIDE'
        const events = [];

        // Initialize: check first position
        for (const geo of parsedGeos) {
            const inside = isPointInPolygon(tracks[0].lat, tracks[0].lon, geo.coords);
            prevStatus[geo.id] = inside ? 'INSIDE' : 'OUTSIDE';

            // If vessel starts inside a geofence, record an ENTER at the first timestamp
            if (inside) {
                events.push({
                    vessel_id: vessel.id,
                    geofence_id: geo.id,
                    event_type: 'ENTER',
                    timestamp: tracks[0].timestamp,
                    confidence_score: 0.8, // Lower confidence for first-position inference
                    processed: false
                });
            }
        }

        // Walk through all positions and detect transitions
        for (let i = 1; i < tracks.length; i++) {
            const pos = tracks[i];
            const { lat, lon, speed, timestamp } = pos;

            for (const geo of parsedGeos) {
                const currentlyInside = isPointInPolygon(lat, lon, geo.coords);
                const newStatus = currentlyInside ? 'INSIDE' : 'OUTSIDE';
                const oldStatus = prevStatus[geo.id] || 'OUTSIDE';

                if (newStatus !== oldStatus) {
                    const eventType = currentlyInside ? 'ENTER' : 'EXIT';

                    events.push({
                        vessel_id: vessel.id,
                        geofence_id: geo.id,
                        event_type: eventType,
                        timestamp: timestamp,
                        confidence_score: 1.0,
                        processed: false
                    });

                    prevStatus[geo.id] = newStatus;
                }
            }
        }

        console.log(`  🔔 ${events.length} events detected`);

        // Insert events in batches of 50
        for (let i = 0; i < events.length; i += 50) {
            const batch = events.slice(i, i + 50);
            const { error: insertErr } = await supabase.from('geofence_events').insert(batch);
            if (insertErr) {
                console.log(`  ❌ Insert error (batch ${Math.floor(i / 50)}): ${insertErr.message}`);
            }
        }

        totalEvents += events.length;

        // Show vessel timeline summary
        const enterExits = events.filter(e => e.event_type === 'ENTER' || e.event_type === 'EXIT');
        for (const evt of enterExits) {
            const geo = parsedGeos.find(g => g.id === evt.geofence_id);
            const icon = evt.event_type === 'ENTER' ? '🟢' : '🔴';
            const time = new Date(evt.timestamp).toLocaleString('en-GB', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            });
            console.log(`    ${icon} ${time} — ${evt.event_type} ${geo?.name} [${geo?.nature}]`);
        }
    }

    // Update status memory with current state
    console.log('\n\n📝 Updating vessel_geofence_status memory...');
    for (const vessel of vessels) {
        const { data: lastPos } = await supabase
            .from('vessel_tracking')
            .select('lat, lon')
            .eq('vessel_id', vessel.id)
            .order('timestamp', { ascending: false })
            .limit(1);

        if (!lastPos?.[0]) continue;

        for (const geo of parsedGeos) {
            const inside = isPointInPolygon(lastPos[0].lat, lastPos[0].lon, geo.coords);
            await supabase.from('vessel_geofence_status').upsert({
                vessel_id: vessel.id,
                geofence_id: geo.id,
                status: inside ? 'INSIDE' : 'OUTSIDE',
                last_check_at: new Date().toISOString()
            }, { onConflict: 'vessel_id,geofence_id' });
        }
    }

    console.log('━'.repeat(55));
    console.log(`✅ Reconstruction complete! ${totalEvents} total events created.`);
    console.log('   The Vessel Activity table should now show the full history.');

    await supabase.auth.signOut();
}

main().catch(console.error);

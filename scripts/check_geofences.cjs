/**
 * GK_V3 — Geofence Check Engine
 * 
 * This script checks all vessel positions against all geofences
 * and generates ENTER/EXIT events when status changes are detected.
 * 
 * Usage: node scripts/check_geofences.cjs
 * Can be scheduled via cron or called periodically.
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
    console.log('🔍 GeoKanban V3 — Geofence Check Engine');
    console.log('━'.repeat(50));

    // Authenticate
    const { error: authErr } = await supabase.auth.signInWithPassword({
        email: 'giuseppe.berrelli@gmail.com',
        password: 'admin123'
    });
    if (authErr) {
        console.error('❌ Auth failed:', authErr.message);
        return;
    }
    console.log('✅ Authenticated');

    // Load vessels, geofences, and current status
    const [vesselsRes, geofencesRes, statusRes] = await Promise.all([
        supabase.from('vessels').select('id, name, mmsi'),
        supabase.from('geofences').select('id, name, nature, polygon_coords'),
        supabase.from('vessel_geofence_status').select('*')
    ]);

    const vessels = vesselsRes.data || [];
    const geofences = geofencesRes.data || [];
    const statusMemory = statusRes.data || [];

    console.log(`📊 ${vessels.length} vessels, ${geofences.length} geofences, ${statusMemory.length} status records`);

    // Parse geofence polygons
    const parsedGeofences = geofences.map(g => {
        try {
            const coords = typeof g.polygon_coords === 'string'
                ? JSON.parse(g.polygon_coords)
                : g.polygon_coords;
            if (Array.isArray(coords) && coords.length >= 3) {
                return { ...g, coords };
            }
        } catch { /* skip */ }
        return null;
    }).filter(Boolean);

    const now = new Date().toISOString();
    let eventsCreated = 0;

    // Check each vessel
    for (const vessel of vessels) {
        // Get latest position
        const { data: positions } = await supabase
            .from('vessel_tracking')
            .select('lat, lon, speed, timestamp')
            .eq('vessel_id', vessel.id)
            .order('timestamp', { ascending: false })
            .limit(1);

        if (!positions || !positions[0]) {
            console.log(`  ⚠️  ${vessel.name}: No tracking data`);
            continue;
        }

        const pos = positions[0];
        const { lat, lon, speed } = pos;

        // Check against each geofence
        for (const geo of parsedGeofences) {
            const currentlyInside = isPointInPolygon(lat, lon, geo.coords);
            const newStatus = currentlyInside ? 'INSIDE' : 'OUTSIDE';

            // Get previous status
            const prevRecord = statusMemory.find(
                s => s.vessel_id === vessel.id && s.geofence_id === geo.id
            );
            const prevStatus = prevRecord?.status || 'OUTSIDE';

            // Detect transition
            if (newStatus !== prevStatus) {
                const eventType = currentlyInside ? 'ENTER' : 'EXIT';

                console.log(`  🔔 ${vessel.name}: ${eventType} ${geo.name} [${geo.nature}]`);

                // Create geofence event
                const { error: evtErr } = await supabase.from('geofence_events').insert({
                    vessel_id: vessel.id,
                    geofence_id: geo.id,
                    event_type: eventType,
                    timestamp: now,
                    confidence_score: 1.0,
                    processed: false
                });

                if (evtErr) {
                    console.error(`    ❌ Event error: ${evtErr.message}`);
                } else {
                    eventsCreated++;
                }
            }

            // Update status memory
            await supabase.from('vessel_geofence_status').upsert({
                vessel_id: vessel.id,
                geofence_id: geo.id,
                status: newStatus,
                last_check_at: now,
                ...(newStatus !== prevStatus ? { last_transition_at: now } : {})
            }, { onConflict: 'vessel_id,geofence_id' });
        }

        // Determine current activity
        const insideGeos = parsedGeofences.filter(g => isPointInPolygon(lat, lon, g.coords));
        const currentActivity = insideGeos.length > 0
            ? insideGeos.map(g => `${g.name} [${g.nature}]`).join(', ')
            : (speed > 0.8 ? '🚢 Navigation' : '⚓ Stand-by');

        console.log(`  📍 ${vessel.name}: ${currentActivity} (speed: ${speed?.toFixed(1)} kn)`);
    }

    console.log('━'.repeat(50));
    console.log(`✅ Check complete. ${eventsCreated} new events created.`);

    await supabase.auth.signOut();
}

main().catch(console.error);

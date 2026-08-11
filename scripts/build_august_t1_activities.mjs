import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Funzione Ray-Casting in memoria per verificare se un punto è nel poligono
function isPointInPolygon(lat, lon, polygonCoords) {
    let inside = false;
    for (let i = 0, j = polygonCoords.length - 1; i < polygonCoords.length; j = i++) {
        const xi = polygonCoords[i][0], yi = polygonCoords[i][1];
        const xj = polygonCoords[j][0], yj = polygonCoords[j][1];

        const intersect = ((yi > lon) !== (yj > lon)) &&
            (lat < (xj - xi) * (lon - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

async function buildAugustT1Activities() {
    console.log("🚀 Avvio costruzione ed inserimento attività T+1 certificate per Agosto 2026 (1-5 Agosto)...");

    // 1. Fetch geofences into RAM
    const { data: geosList } = await supabase.from('geofences').select('id, name, nature, polygon_coords');
    const parsedGeos = (geosList || []).map(g => {
        let coords = [];
        try {
            coords = typeof g.polygon_coords === 'string' ? JSON.parse(g.polygon_coords) : g.polygon_coords;
        } catch (e) {
            coords = [];
        }
        return { id: g.id, name: g.name, nature: g.nature, coords };
    }).filter(g => g.coords && g.coords.length > 2);

    const geoMap = new Map(parsedGeos.map(g => [g.id, g]));

    // 2. Fetch vessels into RAM
    const { data: vesselsList } = await supabase.from('vessels').select('id, name');
    const vesselMap = new Map((vesselsList || []).map(v => [v.id, v.name]));

    // 3. Clean August non-certified live noise from vessel_activity
    console.log("🧹 Rimozione vecchie attività non-certificate di Agosto...");
    await supabase.from('vessel_activity').delete().gte('start_time', '2026-08-01T00:00:00Z');

    // 4. Fetch 2-min points for August 1 to August 5 from vessel_positions_history
    const days = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05'];
    let totalInserted = 0;

    for (const day of days) {
        console.log(`\n📅 Processing Giorno ${day}...`);
        const startIso = `${day}T00:00:00Z`;
        const endIso = `${day}T23:59:59Z`;

        for (const [vesselId, vesselName] of vesselMap.entries()) {
            let pts = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('vessel_positions_history')
                    .select('timestamp, lat, lon, speed')
                    .eq('vessel_id', vesselId)
                    .gte('timestamp', startIso)
                    .lte('timestamp', endIso)
                    .order('timestamp', { ascending: true })
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error || !data || data.length === 0) {
                    hasMore = false;
                } else {
                    pts = pts.concat(data);
                    page++;
                    if (data.length < pageSize) hasMore = false;
                }
            }

            if (pts.length === 0) continue;

            // Classificazione punto-per-punto
            const classified = [];
            for (const p of pts) {
                let matchedGeo = null;
                for (const g of parsedGeos) {
                    if (isPointInPolygon(p.lat, p.lon, g.coords)) {
                        matchedGeo = g;
                        break;
                    }
                }

                let baseType = "Navigation";
                let geoId = null;

                if (matchedGeo) {
                    geoId = matchedGeo.id;
                    switch (matchedGeo.nature) {
                        case "loading_site": baseType = "Loading"; break;
                        case "unloading_site": baseType = "Unloading"; break;
                        case "base_port": baseType = "Port Operations"; break;
                        case "anchorage": baseType = "Anchorage"; break;
                        default: baseType = "Port Operations"; break;
                    }
                    if (p.speed >= 3.0 && matchedGeo.nature === "base_port") {
                        baseType = "Navigation";
                        geoId = null;
                    }
                } else {
                    if (p.speed < 0.5) baseType = "Anchorage";
                    else baseType = "Navigation";
                }

                classified.push({ timestamp: p.timestamp, speed: p.speed, lat: p.lat, lon: p.lon, baseType, geoId });
            }

            // Aggregazione blocchi
            let curr = null;
            const blocks = [];
            for (const pt of classified) {
                const key = `${pt.baseType}_${pt.geoId ?? 'NULL'}`;
                if (!curr || curr.key !== key) {
                    if (curr) {
                        curr.end = pt.timestamp;
                        blocks.push(curr);
                    }
                    curr = { key, vessel_id: vesselId, baseType: pt.baseType, geoId: pt.geoId, start: pt.timestamp, end: pt.timestamp };
                } else {
                    curr.end = pt.timestamp;
                }
            }
            if (curr) blocks.push(curr);

            // Regola 45-min per Technical Standby
            const dayActivities = [];
            for (const block of blocks) {
                const durMin = Math.round((new Date(block.end).getTime() - new Date(block.start).getTime()) / 60000);
                let finalType = block.baseType;

                if (["Unloading", "Loading"].includes(block.baseType) && durMin < 45) {
                    finalType = "Technical Standby";
                }

                if (durMin < 2 && finalType !== "Navigation") continue;

                dayActivities.push({
                    vessel_id: vesselId,
                    activity_type: finalType,
                    geofence_id: block.geoId,
                    start_time: block.start,
                    end_time: block.end,
                    duration_minutes: durMin,
                    status: "completed",
                    source: "t1_builder_certified"
                });
            }

            if (dayActivities.length > 0) {
                const { error: insErr } = await supabase.from('vessel_activity').insert(dayActivities);
                if (insErr) {
                    console.error(`   ❌ Errore inserimento ${vesselName}:`, insErr.message);
                } else {
                    totalInserted += dayActivities.length;
                    console.log(`   • ${vesselName}: +${dayActivities.length} attività T+1 certificate inserite per il ${day}`);
                }
            }
        }
    }

    console.log(`\n=======================================================`);
    console.log(`🎉 [RICOSTRUZIONE ED INSERIMENTO AGOSTO T+1 COMPLETATO]`);
    console.log(`📊 Totale Attività Certificate Inserite in vessel_activity: ${totalInserted}`);
    console.log(`=======================================================`);
}

buildAugustT1Activities();

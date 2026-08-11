import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Funzione Ray-Casting per Point-In-Polygon in memoria pura
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

async function rebuildAndCompareJulyFast() {
    console.log("🚀 [Passo 3 - Fast Memory Engine] Avvio Ricostruzione Deterministica per Luglio 2026...");

    // 1. Carichiamo le 695 attività originali dal backup JSON
    const backupPath = path.join(process.cwd(), 'scratch', 'july_live_activities_backup.json');
    if (!fs.existsSync(backupPath)) {
        console.error("❌ File di backup july_live_activities_backup.json non trovato!");
        return;
    }
    const liveActs = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    // 2. Fetch all geofences into memory
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

    // 3. Fetch all vessels into memory
    const { data: vesselsList } = await supabase.from('vessels').select('id, name');
    const vesselMap = new Map((vesselsList || []).map(v => [v.id, v.name]));

    // 4. Fetch ALL 24.443 points from vessel_positions_history
    let allPoints = [];
    let page = 0;
    const pageSize = 5000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('vessel_positions_history')
            .select('vessel_id, timestamp, lat, lon, speed')
            .gte('timestamp', '2026-07-01T00:00:00Z')
            .lte('timestamp', '2026-07-31T23:59:59Z')
            .order('timestamp', { ascending: true })
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error("❌ Errore lettura punti:", error.message);
            break;
        }

        if (data && data.length > 0) {
            allPoints = allPoints.concat(data);
            page++;
            if (data.length < pageSize) hasMore = false;
        } else {
            hasMore = false;
        }
    }

    console.log(`✅ Caricati in RAM ${allPoints.length} punti posizione a 2 minuti di Luglio.`);

    // Group by vessel
    const vesselPointsMap = new Map();
    for (const pt of allPoints) {
        if (!vesselPointsMap.has(pt.vessel_id)) vesselPointsMap.set(pt.vessel_id, []);
        vesselPointsMap.get(pt.vessel_id).push(pt);
    }

    const rebuiltActivities = [];

    for (const [vesselId, pts] of vesselPointsMap.entries()) {
        const vesselName = vesselMap.get(vesselId) || 'Nave Sconosciuta';

        // Fast in-memory classification
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

        // Aggregate blocks
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

        // Apply 45-min threshold rule for Technical Standby
        for (const block of blocks) {
            const durMin = Math.round((new Date(block.end).getTime() - new Date(block.start).getTime()) / 60000);
            let finalType = block.baseType;

            if (["Unloading", "Loading"].includes(block.baseType) && durMin < 45) {
                finalType = "Technical Standby";
            }

            if (durMin < 2 && finalType !== "Navigation") continue;

            rebuiltActivities.push({
                vessel_id: vesselId,
                vessel_name: vesselName,
                activity_type: finalType,
                geofence_id: block.geoId,
                geofence_name: block.geoId ? geoMap.get(block.geoId)?.name : null,
                start_time: block.start,
                end_time: block.end,
                duration_minutes: durMin
            });
        }
    }

    console.log(`\n🎉 Ricostruite ${rebuiltActivities.length} attività T+1 certificate per Luglio 2026!`);

    // 5. CONFRONTO E METRICHE DI SCOSTAMENTO (Live vs T+1)
    const liveUnloadingCount = liveActs.filter(a => a.activity_type === 'Unloading').length;
    const t1UnloadingCount = rebuiltActivities.filter(a => a.activity_type === 'Unloading').length;
    const t1TechStandbyCount = rebuiltActivities.filter(a => a.activity_type === 'Technical Standby').length;

    const liveLoadingCount = liveActs.filter(a => a.activity_type === 'Loading').length;
    const t1LoadingCount = rebuiltActivities.filter(a => a.activity_type === 'Loading').length;

    const summaryReport = {
        total_live_activities: liveActs.length,
        total_t1_certified_activities: rebuiltActivities.length,
        unloading_comparison: {
            live_unloading_count: liveUnloadingCount,
            t1_certified_unloading_count: t1UnloadingCount,
            reclassified_as_technical_standby: t1TechStandbyCount,
            false_positive_reduction_percentage: `${(((liveUnloadingCount - t1UnloadingCount) / (liveUnloadingCount || 1)) * 100).toFixed(1)}%`
        },
        loading_comparison: {
            live_loading_count: liveLoadingCount,
            t1_certified_loading_count: t1LoadingCount
        },
        t1_activity_breakdown: {
            unloading: t1UnloadingCount,
            loading: t1LoadingCount,
            technical_standby: t1TechStandbyCount,
            navigation: rebuiltActivities.filter(a => a.activity_type === 'Navigation').length,
            anchorage: rebuiltActivities.filter(a => a.activity_type === 'Anchorage').length,
            port_operations: rebuiltActivities.filter(a => a.activity_type === 'Port Operations').length
        }
    };

    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'july_rebuild_comparison.json'), JSON.stringify(summaryReport, null, 2));
    console.log("\n📊 STATISTICHE COMPLETI DI SCOSTAMENTO LUGLIO 2026 (LIVE vs T+1 CERTIFICATO):");
    console.log(JSON.stringify(summaryReport, null, 2));
}

rebuildAndCompareJulyFast();

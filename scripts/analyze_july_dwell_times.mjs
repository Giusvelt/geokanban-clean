import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function analyzeJulyDwellTimes() {
    console.log("📊 Avvio analisi forense dei tempi di permanenza per Luglio 2026...");

    // 1. Fetch geofences lookup
    const { data: geosList } = await supabase.from('geofences').select('id, name, nature');
    const geoMap = new Map((geosList || []).map(g => [g.id, g]));

    // 2. Fetch vessels lookup
    const { data: vesselsList } = await supabase.from('vessels').select('id, name');
    const vesselMap = new Map((vesselsList || []).map(v => [v.id, v.name]));

    // 3. Paginated fetch of all July activities
    let allActs = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('vessel_activity')
            .select('vessel_id, activity_type, geofence_id, start_time, end_time, duration_minutes')
            .gte('start_time', '2026-07-01T00:00:00Z')
            .lte('start_time', '2026-07-31T23:59:59Z')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error("❌ Errore query:", error.message);
            return;
        }

        if (data && data.length > 0) {
            allActs = allActs.concat(data);
            page++;
            if (data.length < pageSize) hasMore = false;
        } else {
            hasMore = false;
        }
    }

    console.log(`✅ Recuperate ${allActs.length} attività registrate per il mese di Luglio 2026.`);

    // Aggregazione per Nave e Geofence
    const stats = {};

    for (const a of allActs) {
        const vesselName = vesselMap.get(a.vessel_id) || 'Nave Sconosciuta';
        const geoObj = a.geofence_id ? geoMap.get(a.geofence_id) : null;
        const geoName = geoObj ? geoObj.name : (a.activity_type === 'Navigation' ? 'Navigation' : 'Anchorage');
        const nature = geoObj ? geoObj.nature : a.activity_type;
        const durMin = a.duration_minutes || (a.end_time ? Math.round((new Date(a.end_time).getTime() - new Date(a.start_time).getTime()) / 60000) : 0);

        if (durMin <= 0) continue;

        const key = `${vesselName}___${geoName}`;
        if (!stats[key]) {
            stats[key] = {
                vessel: vesselName,
                geo: geoName,
                nature: nature,
                count: 0,
                totalMin: 0,
                minMin: durMin,
                maxMin: durMin,
                durations: []
            };
        }

        stats[key].count++;
        stats[key].totalMin += durMin;
        stats[key].durations.push(durMin);
        if (durMin < stats[key].minMin) stats[key].minMin = durMin;
        if (durMin > stats[key].maxMin) stats[key].maxMin = durMin;
    }

    const rows = Object.values(stats).map(s => {
        const avgMin = Math.round(s.totalMin / s.count);
        const avgHours = (s.totalMin / s.count / 60).toFixed(2);
        // Median calculation
        const sorted = [...s.durations].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const medianMin = sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);

        return {
            vessel: s.vessel,
            geo: s.geo,
            nature: s.nature,
            count: s.count,
            avgMin,
            avgHours,
            medianMin,
            minMin: s.minMin,
            maxMin: s.maxMin,
            totalHours: (s.totalMin / 60).toFixed(1)
        };
    });

    // Filtra per Unloading Sites (Scarico) e Loading Sites (Carico)
    const unloadingSites = rows.filter(r => 
        ['unloading_site', 'Unloading'].includes(r.nature) || 
        ['Settore T6', 'Scanno Diga T1', 'Scanno Diga T2-T3', 'Scanno Diga T7', 'T5'].includes(r.geo)
    ).sort((a, b) => a.vessel.localeCompare(b.vessel) || b.count - a.count);

    const loadingSites = rows.filter(r => 
        ['loading_site', 'Loading'].includes(r.nature) || 
        ['SA_35', 'MARINA DI CARRARA', 'MARINA DI CARRARA Fiorillo', 'Vado Scassa Nord', 'GE SANTORO', 'GE_Canzio', 'Civitavecchia', 'Porto Torres', 'Porto Caronte Marsilia', 'CARTAGENA_ES', 'PB_Briccole'].includes(r.geo)
    ).sort((a, b) => a.vessel.localeCompare(b.vessel) || b.count - a.count);

    const reportData = {
        total_activities: allActs.length,
        unloading_sites: unloadingSites,
        loading_sites: loadingSites,
        all_sites: rows
    };

    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'july_dwell_times.json'), JSON.stringify(reportData, null, 2));
    console.log("💾 Analisi salvata in scratch/july_dwell_times.json");

    return reportData;
}

analyzeJulyDwellTimes();

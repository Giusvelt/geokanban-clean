import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function healVesselDay(vesselId, dateStr) {
    console.log(`🚀 Bonifica deterministica del giorno ${dateStr} per nave ${vesselId}...`);
    
    const startIso = `${dateStr}T00:00:00Z`;
    const endIso = `${dateStr}T23:59:59Z`;

    // 1. Scarica i punti ad alta frequenza da vessel_positions_history
    const { data: pts } = await supabase
        .from('vessel_positions_history')
        .select('*')
        .eq('vessel_id', vesselId)
        .gte('timestamp', startIso)
        .lte('timestamp', endIso)
        .order('timestamp', { ascending: true });

    if (!pts || pts.length === 0) {
        console.log("   ⚠️ Nessun punto in vessel_positions_history.");
        return;
    }

    console.log(`   📊 Trovati ${pts.length} punti in vessel_positions_history.`);

    // 2. Classificazione punto-per-punto via PostGIS
    const classifiedPoints = [];
    for (const p of pts) {
        const { data: geos } = await supabase.rpc('get_geofences_at_point', { p_lat: p.lat, p_lon: p.lon });
        const geo = (geos || [])[0];
        
        let actType = 'Navigation';
        let geoId = null;
        let geoName = null;

        if (geo) {
            geoId = geo.id;
            geoName = geo.name;
            switch (geo.nature) {
                case 'loading_site': actType = 'Loading'; break;
                case 'unloading_site': actType = 'Unloading'; break;
                case 'base_port': actType = 'Port Operations'; break;
                case 'anchorage': actType = 'Anchorage'; break;
                default: actType = 'Port Operations'; break;
            }
            // Se la velocità è elevata (>= 3.0 kn) e il punto è in un geofence ampio di rada/base_port, si tratta di transito/navigazione
            if (p.speed >= 3.0 && geo.nature === 'base_port') {
                actType = 'Navigation';
                geoId = null;
                geoName = null;
            }
        } else {
            if (p.speed < 0.5) {
                actType = 'Anchorage';
            } else {
                actType = 'Navigation';
            }
        }

        classifiedPoints.push({
            timestamp: p.timestamp,
            speed: p.speed,
            lat: p.lat,
            lon: p.lon,
            actType,
            geoId,
            geoName
        });
    }

    // 3. Raggruppamento in attività continue
    const mergedActivities = [];
    let currentBlock = null;

    for (const pt of classifiedPoints) {
        const key = `${pt.actType}_${pt.geoId ?? 'NULL'}`;
        
        if (!currentBlock || currentBlock.key !== key) {
            if (currentBlock) {
                currentBlock.end = pt.timestamp;
                mergedActivities.push(currentBlock);
            }
            currentBlock = {
                key,
                vessel_id: vesselId,
                activity_type: pt.actType,
                geofence_id: pt.geoId,
                geofence_name: pt.geoName,
                start: pt.timestamp,
                end: pt.timestamp,
                points: [pt]
            };
        } else {
            currentBlock.end = pt.timestamp;
            currentBlock.points.push(pt);
        }
    }
    if (currentBlock) {
        mergedActivities.push(currentBlock);
    }

    // 4. Filtraggio micro-ghost (< 2 min) eccetto Navigation
    const cleanActivities = [];
    for (const act of mergedActivities) {
        const durMin = Math.round((new Date(act.end).getTime() - new Date(act.start).getTime()) / 60000);
        if (act.activity_type !== 'Navigation' && durMin < 2) {
            console.log(`   🧹 Ignorato micro-ghost: ${act.activity_type} (${durMin}m)`);
            continue;
        }
        act.durMin = durMin;
        cleanActivities.push(act);
    }

    // 5. Purge delle vecchie attività incomplete o sovrapposte su quella finestra temporale
    const { data: oldActs } = await supabase
        .from('vessel_activity')
        .select('id, start_time')
        .eq('vessel_id', vesselId)
        .gte('start_time', startIso)
        .lte('start_time', endIso);

    if (oldActs && oldActs.length > 0) {
        console.log(`   🧹 Purge di ${oldActs.length} vecchie attività sovrapposte...`);
        for (const old of oldActs) {
            await supabase.from('vessel_activity').delete().eq("id", old.id);
        }
    }

    // 6. Inserimento delle attività certificate e pulite
    console.log(`   ✨ Inserisco ${cleanActivities.length} attività certificate nel DB Supabase:`);
    for (const act of cleanActivities) {
        const startIT = new Date(new Date(act.start).getTime() + 7200000).toISOString().substring(11, 16);
        const endIT = new Date(new Date(act.end).getTime() + 7200000).toISOString().substring(11, 16);
        console.log(`      • ${act.activity_type} | ${act.geofence_name ?? 'Navigation'} | ${startIT} -> ${endIT} (${act.durMin}m)`);

        await supabase.from('vessel_activity').insert({
            vessel_id: vesselId,
            activity_type: act.activity_type,
            geofence_id: act.geofence_id,
            start_time: act.start,
            end_time: act.end,
            duration_minutes: act.durMin,
            status: 'completed',
            source: 'healer_v2'
        });
    }

    console.log(`✅ Bonifica deterministica completata per ${vesselId} su ${dateStr}!`);
}

healVesselDay('c6de46ab-0a71-4df5-8de5-9cee136edfe0', '2026-08-01');

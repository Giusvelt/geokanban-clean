import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Load local environment for execution
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const datadockedKey = process.env.VITE_DATADOCKED_API_KEY || process.env.DATADOCKED_API_KEY;

if (!supabaseUrl || !supabaseKey || !datadockedKey) {
  console.error("❌ Missing required environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATADOCKED_API_KEY). Check .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const DATADOCKED_BASE = "https://datadocked.com/api/vessels_operations";
const RATE_LIMIT_DELAY_MS = 5000; // 5 secondi di pausa tra le chiamate API
const BATCH_SIZE_DAYS = 1; // Processiamo 1 giorno alla volta

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchHistoricalData(mmsi, fromIso, toIso) {
    const url = `${DATADOCKED_BASE}/get-vessel-historical-data?imo_or_mmsi=${mmsi}&from_date=${fromIso}&to_date=${toIso}&interval=2`;

    console.log(`      🌐 GET ${url}`);
    const res = await fetch(url, {
        headers: {
            "X-API-Key": datadockedKey,
            "Authorization": `Bearer ${datadockedKey}`
        }
    });

    if (res.status === 429) {
        console.warn(`      ⚠️ Rate limit DataDocked (429)! Aspetto 30 secondi...`);
        await delay(30000);
        return fetchHistoricalData(mmsi, fromIso, toIso);
    }

    if (!res.ok) {
        throw new Error(`DataDocked HTTP Error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return data;
}

async function runBackfill(vesselMmsi, startDateStr, endDateStr) {
    console.log(`\n🚀 Inizio Backfill Gentile per MMSI ${vesselMmsi}`);
    console.log(`   Da: ${startDateStr} | A: ${endDateStr}`);
    console.log(`   Rate Limit: ${RATE_LIMIT_DELAY_MS}ms tra le richieste\n`);

    const { data: vesselData, error: vErr } = await supabase
        .from('vessels')
        .select('id, name')
        .eq('mmsi', vesselMmsi)
        .single();

    if (vErr || !vesselData) {
        console.error("❌ Impossibile trovare la nave con MMSI:", vesselMmsi);
        return;
    }

    const vesselId = vesselData.id;
    let currentStart = new Date(startDateStr);
    const finalEnd = new Date(endDateStr);

    let totalHealed = 0;
    const logData = [];

    while (currentStart < finalEnd) {
        const currentEnd = new Date(currentStart);
        currentEnd.setUTCDate(currentStart.getUTCDate() + BATCH_SIZE_DAYS);
        if (currentEnd > finalEnd) currentEnd.setTime(finalEnd.getTime());

        const batchStartIso = currentStart.toISOString();
        const batchEndIso = currentEnd.toISOString();
        console.log(`\n📅 Analizzo batch: ${batchStartIso.split('T')[0]} -> ${batchEndIso.split('T')[0]}`);

        // 1. Cerca eventi ENTER/EXIT con potenziale gap
        const { data: events, error: evErr } = await supabase
            .from("geofence_events")
            .select("id, geofence_id, event_type, timestamp, speed")
            .eq("vessel_id", vesselId)
            .gte("timestamp", batchStartIso)
            .lt("timestamp", batchEndIso)
            .order("timestamp", { ascending: true });

        if (evErr) {
            console.error("Errore fetch eventi:", evErr);
            break;
        }

        console.log(`   Trovati ${events.length} eventi nel batch.`);

        for (const event of events) {
            // Troviamo il punto precedente per misurare il gap
            const { data: prevTrack } = await supabase
                .from("vessel_tracking")
                .select("timestamp")
                .eq("vessel_id", vesselId)
                .lt("timestamp", event.timestamp)
                .order("timestamp", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!prevTrack) continue;

            const gapMinutes = (new Date(event.timestamp).getTime() - new Date(prevTrack.timestamp).getTime()) / 60000;
            if (gapMinutes <= 15) continue; // Gap ok

            console.log(`\n   🔍 Evento: ${event.event_type} @ ${event.timestamp}`);
            console.log(`      Gap: ${Math.round(gapMinutes)}m -> Fetch storici necessari`);

            // FORMATO DATA CORRETTO SENZA MILLISECONDI
            const fromIsoFixed = new Date(prevTrack.timestamp).toISOString().split('.')[0] + 'Z';
            const toIsoFixed = new Date(event.timestamp).toISOString().split('.')[0] + 'Z';

            try {
                const histData = await fetchHistoricalData(vesselMmsi, fromIsoFixed, toIsoFixed);

                let points = [];
                if (histData?.response?.data && Array.isArray(histData.response.data)) {
                    points = histData.response.data;
                }

                if (points.length > 0) {
                    points.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

                    let exactTime = null;
                    const isEnter = event.event_type === "ENTER";

                    for (const pt of points) {
                        const { data: ptGeos } = await supabase.rpc("get_geofences_at_point", { p_lat: pt.lat, p_lon: pt.lng });
                        const ptGeoIds = new Set((ptGeos || []).map((g) => g.id));
                        const ptInside = ptGeoIds.has(event.geofence_id);

                        if ((isEnter && ptInside) || (!isEnter && !ptInside)) {
                            exactTime = pt.time;
                            break;
                        }
                    }

                    if (exactTime && exactTime !== event.timestamp) {
                        console.log(`      🎯 Correzione trovata: ${event.timestamp} -> ${exactTime}`);

                        // LOG THE FIX (Non facciamo update massivi distruttivi, aggiorniamo ma teniamo traccia)
                        logData.push({
                            event_id: event.id,
                            old_timestamp: event.timestamp,
                            new_timestamp: exactTime,
                            gap_minutes: Math.round(gapMinutes)
                        });

                        // UPDATE EVENT
                        await supabase.from("geofence_events").update({ timestamp: exactTime }).eq("id", event.id);

                        // CASCADE UPDATE ACTIVITY
                        const { data: acts } = await supabase.from("vessel_activity")
                            .select("id, start_time, end_time")
                            .eq("vessel_id", vesselId)
                            .or(`start_time.eq.${event.timestamp},end_time.eq.${event.timestamp}`);

                        for(const act of (acts || [])){
                             const updates = {};
                             if (act.start_time === event.timestamp) updates.start_time = exactTime;
                             if (act.end_time === event.timestamp) updates.end_time = exactTime;
                             await supabase.from("vessel_activity").update(updates).eq("id", act.id);
                        }

                        totalHealed++;
                    } else {
                        console.log(`      ❌ Nessuna intersezione migliore trovata o orario già ottimale.`);
                    }
                } else {
                    console.log(`      ❌ Nessun dato ritornato da DataDocked per il range.`);
                }

            } catch (err) {
                console.error(`      ❌ Errore API:`, err.message);
            }

            // PAUSA GENTILE RATE LIMIT
            console.log(`      ⏳ Attendo ${RATE_LIMIT_DELAY_MS}ms prima del prossimo...`);
            await delay(RATE_LIMIT_DELAY_MS);
        }

        currentStart = currentEnd;
    }

    fs.writeFileSync(`scripts/backfill_report_${vesselMmsi}.json`, JSON.stringify(logData, null, 2));
    console.log(`\n✅ Backfill completato! Corretti ${totalHealed} eventi. Report salvato.`);
}

// Configura i parametri qui (es. Maria Vittoria Z = MMSI 247164900, dal 1 Maggio al 31 Maggio)
const TARGET_MMSI = process.argv[2] || "247164900";
const START_DATE = process.argv[3] || "2026-05-01T00:00:00Z";
const END_DATE = process.argv[4] || "2026-05-31T23:59:59Z";

runBackfill(TARGET_MMSI, START_DATE, END_DATE);

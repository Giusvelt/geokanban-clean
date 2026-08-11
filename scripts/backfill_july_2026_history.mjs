import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DATADOCKED_API_KEY = process.env.VITE_DATADOCKED_API_KEY;
const DATADOCKED_BASE = "https://datadocked.com/api/vessels_operations";

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url, maxRetries = 5) {
    let attempt = 0;
    while (attempt < maxRetries) {
        attempt++;
        const res = await fetch(url, {
            headers: {
                "X-API-Key": DATADOCKED_API_KEY,
                "Authorization": `Bearer ${DATADOCKED_API_KEY}`
            }
        });

        if (res.status === 429) {
            const waitMs = attempt * 3000;
            console.log(`   ⏳ HTTP 429 Rate Limit. Attesa di ${waitMs / 1000}s (Tentativo ${attempt}/${maxRetries})...`);
            await delay(waitMs);
            continue;
        }

        return res;
    }
    return null;
}

async function backfillJuly2026History() {
    console.log("🚀 [Passo 2 - Resilient Backfill] Ripresa Scarico Storico 2 Minuti DataDocked per Luglio 2026...");

    // 1. Fetch active fleet
    const { data: vessels, error: vErr } = await supabase.from('active_vessels').select('id, name, mmsi').order('name');
    if (vErr || !vessels) {
        console.error("❌ Errore caricamento flotta navi:", vErr?.message);
        return;
    }

    console.log(`🚢 Flotta Target (${vessels.length} navi):`, vessels.map(v => v.name).join(", "));

    let totalPointsInserted = 0;
    let totalCreditsSpent = 0;

    // Iteriamo giorno per giorno per Luglio 2026 (dal 1 al 31 Luglio)
    for (let day = 1; day <= 31; day++) {
        const dayStr = day.toString().padStart(2, '0');
        const fromIso = `2026-07-${dayStr}T00:00:00Z`;
        const toIso = `2026-07-${dayStr}T23:59:59Z`;

        console.log(`\n📅 Processing Giorno 2026-07-${dayStr}...`);

        for (const vessel of vessels) {
            if (!vessel.mmsi) continue;

            try {
                const url = `${DATADOCKED_BASE}/get-vessel-historical-data?imo_or_mmsi=${vessel.mmsi}&from_date=${fromIso}&to_date=${toIso}&interval=2`;
                const res = await fetchWithRetry(url);

                if (res && res.ok) {
                    const json = await res.json();
                    let rawPoints = [];

                    if (json?.response?.data && Array.isArray(json.response.data)) {
                        rawPoints = json.response.data;
                    } else if (json?.tracks) {
                        const key = Object.keys(json.tracks)[0];
                        const trPoints = json.tracks[key]?.response?.data;
                        if (Array.isArray(trPoints)) rawPoints = trPoints;
                    }

                    if (rawPoints.length > 0) {
                        const rowsToInsert = rawPoints.map(pt => ({
                            vessel_id: vessel.id,
                            mmsi: vessel.mmsi,
                            lat: pt.lat,
                            lon: pt.lng,
                            speed: pt.speed || 0.0,
                            course: pt.course || 0.0,
                            heading: pt.heading || 0.0,
                            timestamp: pt.time,
                            raw_data: pt
                        }));

                        for (let c = 0; c < rowsToInsert.length; c += 500) {
                            const chunk = rowsToInsert.slice(c, c + 500);
                            await supabase.from("vessel_positions_history").upsert(chunk, { onConflict: "vessel_id,timestamp", ignoreDuplicates: true });
                        }

                        totalPointsInserted += rawPoints.length;
                        totalCreditsSpent += 5;
                        console.log(`   • ${vessel.name}: +${rawPoints.length} punti scaricati`);
                    } else {
                        console.log(`   ⚠️ ${vessel.name}: nessun punto disponibile per il 2026-07-${dayStr}`);
                    }
                } else {
                    console.error(`   ❌ ${vessel.name} error HTTP ${res ? res.status : 'NO_RESPONSE'}`);
                }
            } catch (err) {
                console.error(`   ❌ ${vessel.name} exception:`, err.message);
            }

            await delay(1200); // 1.2s delay to comply strictly with DataDocked API rate limits
        }
    }

    // Final total check
    const { count: finalCount } = await supabase.from('vessel_positions_history').select('*', { count: 'exact', head: true }).gte('timestamp', '2026-07-01T00:00:00Z').lte('timestamp', '2026-07-31T23:59:59Z');

    console.log("\n=======================================================");
    console.log(`🎉 [SCARICO STORICO LUGLIO COMPLETATO]`);
    console.log(`📊 Totale Punti Posizione Salvati nel DB per Luglio: ${finalCount}`);
    console.log(`💳 Totale Crediti Consumati in questa sessione: ~${totalCreditsSpent} crediti`);
    console.log("=======================================================");
}

backfillJuly2026History();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function populateRetroactiveDraught() {
  console.log("\n=============================================================");
  console.log("🚀 POPOLAMENTO E RETRO-IMPUTAZIONE AIS DRAUGHT (LUGLIO 2026)");
  console.log("=============================================================\n");

  const { data: activities, error: aErr } = await supabase
    .from("vessel_activity")
    .select("id, vessel_id, activity_type, start_time, end_time, status")
    .gte("start_time", "2026-07-01T00:00:00Z")
    .order("start_time", { ascending: true });

  if (aErr || !activities) {
    console.error("Errore fetch attività:", aErr?.message);
    return;
  }

  console.log(`Trovate ${activities.length} attività totali da elaborare a Luglio...`);

  // Raggruppiamo per vessel_id per efficienza
  const vesselIds = [...new Set(activities.map(a => a.vessel_id))];
  let totalUpdated = 0;

  for (const vId of vesselIds) {
    const vActivities = activities.filter(a => a.vessel_id === vId);

    // Fetch tracking posizioni del mese per questa nave
    const { data: tracking } = await supabase
      .from("vessel_tracking")
      .select("timestamp, raw_data")
      .eq("vessel_id", vId)
      .gte("timestamp", "2026-07-01T00:00:00Z")
      .order("timestamp", { ascending: true });

    const draughtPoints = (tracking || []).map(t => {
      const dStr = t.raw_data?.draught || t.raw_data?.draft || null;
      let dVal = null;
      if (dStr) {
        const match = dStr.toString().match(/([0-9.]+)/);
        if (match) dVal = parseFloat(match[1]);
      }
      return {
        timestamp: t.timestamp,
        timeMs: new Date(t.timestamp).getTime(),
        draughtVal: dVal
      };
    }).filter(d => d.draughtVal !== null);

    if (draughtPoints.length === 0) continue;

    for (const act of vActivities) {
      const actStartMs = new Date(act.start_time).getTime();
      const actEndMs = act.end_time ? new Date(act.end_time).getTime() : Date.now();

      // Pescaggio di inizio: ultimo pescaggio valido prima o durante l'inizio
      const pointsBefore = draughtPoints.filter(d => d.timeMs <= actStartMs + (15 * 60 * 1000));
      const startD = pointsBefore.length > 0 ? pointsBefore[pointsBefore.length - 1].draughtVal : draughtPoints[0].draughtVal;

      // Pescaggio di fine con finestra di retro-imputazione fino a 12 ore dopo la chiusura
      const pointsWindow = draughtPoints.filter(d => d.timeMs >= actStartMs && d.timeMs <= (actEndMs + 12 * 60 * 60 * 1000));

      let endD = startD;
      for (const pt of pointsWindow) {
        if (Math.abs(pt.draughtVal - startD) > 0.1) {
          endD = pt.draughtVal;
          break; // Trovata la prima variazione valida post-partenza
        }
      }

      if (startD !== null || endD !== null) {
        await supabase
          .from("vessel_activity")
          .update({
            ais_start_draught: startD,
            ais_end_draught: endD
          })
          .eq("id", act.id);

        totalUpdated++;
      }
    }
  }

  console.log(`\n✅ POPOLAMENTO E RETRO-IMPUTAZIONE COMPLETATA! ${totalUpdated} attività aggiornate con i dati AIS Draught!`);
}

populateRetroactiveDraught();

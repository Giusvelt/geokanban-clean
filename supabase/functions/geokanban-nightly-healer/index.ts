// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const DATADOCKED_BASE = "https://datadocked.com/api/vessels_operations";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );
  const DATADOCKED_API_KEY = Deno.env.get("DATADOCKED_API_KEY");

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setUTCDate(now.getUTCDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);
  const startOfYesterday = yesterday.toISOString();
  yesterday.setUTCHours(23, 59, 59, 999);
  const endOfYesterday = yesterday.toISOString();
  const dateStr = startOfYesterday.split("T")[0];

  console.log(`\n🌙 Nightly Healer Ibrido avviato per il giorno: ${dateStr}`);

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    const { data: allVessels, error: vErr } = await supabase
      .from("active_vessels")
      .select("id, name, mmsi")
      .order("name");

    if (vErr) throw vErr;

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Rome",
      hour: "numeric",
      hour12: false
    });
    const romeHour = parseInt(formatter.format(new Date()), 10);
    
    let targetVessels = allVessels || [];
    if (romeHour >= 7 && romeHour <= 9) {
      const groupIndex = romeHour - 7;
      const chunkSize = Math.ceil(targetVessels.length / 3);
      const startIndex = groupIndex * chunkSize;
      targetVessels = targetVessels.slice(startIndex, startIndex + chunkSize);
      console.log(`[Nightly Healer] Ora di Roma: ${romeHour} (Gruppo ${groupIndex}) | Target navi:`, targetVessels.map(v => v.name));
    } else {
      console.log(`[Nightly Healer] Ora di Roma: ${romeHour} (Esecuzione manuale/fuori finestra) | Target: Tutte le navi.`);
    }

    // ── FASE 1: INGESTIONE BULK DATADOCKED ➔ TABELLA vessel_positions_history ──
    console.log(`\n📥 [FASE 1] Ingestione nastro ad alta frequenza (2 min) su vessel_positions_history...`);
    
    const fromIso = startOfYesterday.split('.')[0] + 'Z';
    const toIso = endOfYesterday.split('.')[0] + 'Z';

    for (const vessel of targetVessels) {
      if (!vessel.mmsi) continue;
      
      try {
        console.log(`   🚢 Fetching nastro 24h per ${vessel.name} (MMSI: ${vessel.mmsi})...`);
        const histUrl = `${DATADOCKED_BASE}/get-vessel-historical-data?imo_or_mmsi=${vessel.mmsi}&from_date=${fromIso}&to_date=${toIso}&interval=2`;
        const histRes = await fetch(histUrl, { headers: { "X-API-Key": DATADOCKED_API_KEY, "Authorization": `Bearer ${DATADOCKED_API_KEY}` } });
        
        if (histRes.ok) {
          const histData = await histRes.json();
          let rawPoints = [];
          if (histData?.response?.data && Array.isArray(histData.response.data)) {
            rawPoints = histData.response.data;
          } else if (histData?.tracks) {
            const key = Object.keys(histData.tracks)[0];
            const trPoints = histData.tracks[key]?.response?.data;
            if (Array.isArray(trPoints)) rawPoints = trPoints;
          }

          if (rawPoints.length > 0) {
            const rowsToInsert = rawPoints.map((pt: any) => ({
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

            const { error: upsertErr } = await supabase
              .from("vessel_positions_history")
              .upsert(rowsToInsert, { onConflict: "vessel_id,timestamp", ignoreDuplicates: true });

            if (upsertErr) {
              console.error(`      ⚠️ Errore salvataggio vessel_positions_history per ${vessel.name}:`, upsertErr.message);
            } else {
              console.log(`      ✅ Ingestati ${rowsToInsert.length} punti storici per ${vessel.name}.`);
            }
          } else {
            console.log(`      ℹ️ Nessun punto restituito da DataDocked per ${vessel.name}.`);
          }
        } else {
          console.error(`      ❌ DataDocked HTTP ${histRes.status} per ${vessel.name}`);
        }
      } catch (err: any) {
        console.error(`      ❌ Errore ingestione per ${vessel.name}:`, err.message);
      }
      await delay(2000);
    }

    console.log(`\n🔒 [FASE 1 COMPLETATA] Connessione a DataDocked chiusa. Ora procedo con bonifica 100% DETERMINISTICA dal DB Supabase.`);

    // ── FASE 2: BONIFICA DETERMINISTICA DAL NASTRO vessel_positions_history ──
    let totalHealedVessels = 0;

    for (const vessel of targetVessels) {
      const healed = await healVesselDayDeterministic(vessel.id, vessel.name, startOfYesterday, endOfYesterday, supabase);
      if (healed) totalHealedVessels++;
    }

    console.log(`\n🎉 [NIGHTLY HEALER COMPLETATO] Certificate le attività di ${totalHealedVessels} navi per il giorno ${dateStr}.`);
    return new Response(JSON.stringify({ status: "success", healedVessels: totalHealedVessels, date: dateStr }), { headers: { "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("Errore generale Nightly Healer:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});

async function healVesselDayDeterministic(
  vesselId: string,
  vesselName: string,
  startIso: string,
  endIso: string,
  supabase: any
): Promise<boolean> {
  console.log(`\n✨ [Bonifica Deterministica] Elaborazione ${vesselName} per finestra ${startIso.substring(0, 10)}...`);

  // 1. Scarica i punti ad alta frequenza da vessel_positions_history
  const { data: pts, error: pErr } = await supabase
    .from("vessel_positions_history")
    .select("timestamp, lat, lon, speed")
    .eq("vessel_id", vesselId)
    .gte("timestamp", startIso)
    .lte("timestamp", endIso)
    .order("timestamp", { ascending: true });

  if (pErr || !pts || pts.length === 0) {
    console.log(`   ℹ️ Nessun punto salvato in vessel_positions_history per ${vesselName}.`);
    return false;
  }

  console.log(`   📊 Trovati ${pts.length} punti satellitari per ${vesselName}.`);

  // 2. Classificazione punto-per-punto via PostGIS
  const classifiedPoints = [];
  for (const p of pts) {
    const { data: geos } = await supabase.rpc("get_geofences_at_point", { p_lat: p.lat, p_lon: p.lon });
    const geo = (geos || [])[0];
    
    let actType = "Navigation";
    let geoId = null;
    let geoName = null;

    if (geo) {
      geoId = geo.id;
      geoName = geo.name;
      switch (geo.nature) {
        case "loading_site": actType = "Loading"; break;
        case "unloading_site": actType = "Unloading"; break;
        case "base_port": actType = "Port Operations"; break;
        case "anchorage": actType = "Anchorage"; break;
        default: actType = "Port Operations"; break;
      }
      // Se la velocità è elevata (>= 3.0 kn) in un geofence ampio di base_port/rada, si tratta di navigazione/transito
      if (p.speed >= 3.0 && geo.nature === "base_port") {
        actType = "Navigation";
        geoId = null;
        geoName = null;
      }
    } else {
      if (p.speed < 0.5) {
        actType = "Anchorage";
      } else {
        actType = "Navigation";
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
  let currentBlock: any = null;

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
    if (act.activity_type !== "Navigation" && durMin < 2) {
      console.log(`   🧹 Ignorato micro-ghost per ${vesselName}: ${act.activity_type} (${durMin}m)`);
      continue;
    }
    act.durMin = durMin;
    cleanActivities.push(act);
  }

  // 5. PURGE TOTALE del rumore live vecchio per la giornata target
  // Rimuove qualsiasi attività (inclusi record fantasma a cavallo di più giorni) per la finestra target
  const { data: oldActs } = await supabase
    .from("vessel_activity")
    .select("id")
    .eq("vessel_id", vesselId)
    .gte("start_time", startIso)
    .lte("start_time", endIso);

  if (oldActs && oldActs.length > 0) {
    console.log(`   🧹 Purge di ${oldActs.length} vecchie attività live per ${vesselName}...`);
    for (const old of oldActs) {
      await supabase.from("vessel_activity").delete().eq("id", old.id);
    }
  }

  // 6. Inserimento delle attività certificate e pulite
  console.log(`   ✨ Inserisco ${cleanActivities.length} attività certificate in vessel_activity per ${vesselName}:`);
  for (const act of cleanActivities) {
    const midLat = act.points[0]?.lat || 44.4;
    const midLon = act.points[0]?.lon || 8.9;
    const weather = await fetchHistoricalWeather(midLat, midLon, act.start);

    await supabase.from("vessel_activity").insert({
      vessel_id: vesselId,
      activity_type: act.activity_type,
      geofence_id: act.geofence_id,
      start_time: act.start,
      end_time: act.end,
      duration_minutes: act.durMin,
      status: "completed",
      source: "healer_deterministic_v2",
      weather_wave: weather.wave,
      weather_wind: weather.wind
    });
  }

  return true;
}

async function fetchHistoricalWeather(lat: number, lon: number, timestamp: string): Promise<{ wave: string; wind: string }> {
  try {
    const date = new Date(timestamp);
    const dateStr = date.toISOString().split("T")[0];
    const hour = date.getUTCHours();
    const latRound = Math.round(lat * 10) / 10;
    const lonRound = Math.round(lon * 10) / 10;

    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latRound}&longitude=${lonRound}&start_date=${dateStr}&end_date=${dateStr}&hourly=wind_speed_10m&wind_speed_unit=kn`;
    const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${latRound}&longitude=${lonRound}&start_date=${dateStr}&end_date=${dateStr}&hourly=wave_height`;

    const [forecastRes, marineRes] = await Promise.all([
      fetch(forecastUrl),
      fetch(marineUrl)
    ]);

    if (!forecastRes.ok || !marineRes.ok) return { wave: "—", wind: "—" };

    const forecastJson = await forecastRes.json();
    const marineJson = await marineJson.json();

    const windSpeed = forecastJson?.hourly?.wind_speed_10m?.[hour];
    const waveHeight = marineJson?.hourly?.wave_height?.[hour];

    return {
      wave: waveHeight !== undefined ? `${waveHeight.toFixed(1)} m` : '—',
      wind: windSpeed !== undefined ? `${Math.round(windSpeed)} kn` : '—'
    };
  } catch (err) {
    return { wave: "—", wind: "—" };
  }
}

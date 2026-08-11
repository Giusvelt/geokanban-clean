// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const DATADOCKED_BASE = "https://datadocked.com/api/vessels_operations";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * 🚢 GeoKanban T+1 Activity Builder (Nuovo Motore Deterministico da Scratch)
 * 
 * Regole di Dominio:
 * 1. Scarica i 720 punti a 2 min dal DB o da DataDocked per il giorno precedente (T-1).
 * 2. Valuta punto-per-punto le coordinate via PostGIS.
 * 3. Applica la soglia minima di 45 minuti per Unloading / Loading commerciale.
 * 4. Se la permanenza nel geofence di Carico/Scarico è < 45 min, assegna 'Technical Standby'.
 * 5. Accorpa i tocchi contigui sullo stesso Hub Diga.
 * 6. Preserva al 100% tutte le altre funzioni senza toccare il vecchio Nightly Healer o Tracker.
 */
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

  console.log(`\n🏗️ [GeoKanban T+1 Activity Builder] Avviato per la data: ${dateStr}`);

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
      console.log(`[Activity Builder] Ora di Roma: ${romeHour} (Gruppo ${groupIndex}) | Target navi:`, targetVessels.map(v => v.name));
    }

    // ── FASE 1: INGESTIONE 24H DA DATADOCKED SU vessel_positions_history ──
    const fromIso = startOfYesterday.split('.')[0] + 'Z';
    const toIso = endOfYesterday.split('.')[0] + 'Z';

    for (const vessel of targetVessels) {
      if (!vessel.mmsi) continue;
      
      try {
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

            await supabase
              .from("vessel_positions_history")
              .upsert(rowsToInsert, { onConflict: "vessel_id,timestamp", ignoreDuplicates: true });
          }
        }
      } catch (err: any) {
        console.error(`Errror fetching ${vessel.name}:`, err.message);
      }
      await delay(1500);
    }

    // ── FASE 2: COSTRUZIONE DETERMINISTICA CON SOGLIA TECHNICAL STANDBY (45 MIN) ──
    let processedCount = 0;
    for (const vessel of targetVessels) {
      const ok = await buildVesselDailyActivities(vessel.id, vessel.name, startOfYesterday, endOfYesterday, supabase);
      if (ok) processedCount++;
    }

    return new Response(JSON.stringify({ status: "success", processedVessels: processedCount, date: dateStr }), { headers: { "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});

async function buildVesselDailyActivities(
  vesselId: string,
  vesselName: string,
  startIso: string,
  endIso: string,
  supabase: any
): Promise<boolean> {
  const { data: pts } = await supabase
    .from("vessel_positions_history")
    .select("timestamp, lat, lon, speed")
    .eq("vessel_id", vesselId)
    .gte("timestamp", startIso)
    .lte("timestamp", endIso)
    .order("timestamp", { ascending: true });

  if (!pts || pts.length === 0) return false;

  // 1. Classificazione punto-per-punto
  const classified = [];
  for (const p of pts) {
    const { data: geos } = await supabase.rpc("get_geofences_at_point", { p_lat: p.lat, p_lon: p.lon });
    const geo = (geos || [])[0];
    
    let baseType = "Navigation";
    let geoId = null;
    let geoName = null;

    if (geo) {
      geoId = geo.id;
      geoName = geo.name;
      switch (geo.nature) {
        case "loading_site": baseType = "Loading"; break;
        case "unloading_site": baseType = "Unloading"; break;
        case "base_port": baseType = "Port Operations"; break;
        case "anchorage": baseType = "Anchorage"; break;
        default: baseType = "Port Operations"; break;
      }
      if (p.speed >= 3.0 && geo.nature === "base_port") {
        baseType = "Navigation";
        geoId = null;
        geoName = null;
      }
    } else {
      if (p.speed < 0.5) {
        baseType = "Anchorage";
      } else {
        baseType = "Navigation";
      }
    }

    classified.push({ timestamp: p.timestamp, speed: p.speed, lat: p.lat, lon: p.lon, baseType, geoId, geoName });
  }

  // 2. Aggregazione blocchi continui
  const blocks = [];
  let curr: any = null;

  for (const pt of classified) {
    const key = `${pt.baseType}_${pt.geoId ?? 'NULL'}`;
    if (!curr || curr.key !== key) {
      if (curr) {
        curr.end = pt.timestamp;
        blocks.push(curr);
      }
      curr = { key, vessel_id: vesselId, baseType: pt.baseType, geoId: pt.geoId, geoName: pt.geoName, start: pt.timestamp, end: pt.timestamp, points: [pt] };
    } else {
      curr.end = pt.timestamp;
      curr.points.push(pt);
    }
  }
  if (curr) blocks.push(curr);

  // 3. Applicazione Soglia 45 min per 'Technical Standby'
  const finalActivities = [];
  for (const block of blocks) {
    const durMin = Math.round((new Date(block.end).getTime() - new Date(block.start).getTime()) / 60000);
    let finalType = block.baseType;

    // Se l'attività è di tipo Carico o Scarico ma dura MENO DI 45 MINUTI -> diventa Technical Standby
    if (["Unloading", "Loading"].includes(block.baseType) && durMin < 45) {
      finalType = "Technical Standby";
      console.log(`   💡 Permanenza su ${block.geoName} di ${durMin}m < 45m -> Assegnato 'Technical Standby' per ${vesselName}`);
    }

    if (durMin < 2 && finalType !== "Navigation") continue; // Scarta i micro-ghost < 2 min

    finalActivities.push({
      vessel_id: vesselId,
      activity_type: finalType,
      geofence_id: block.geoId,
      start_time: block.start,
      end_time: block.end,
      duration_minutes: durMin,
      status: "completed",
      source: "activity_builder_v1",
      midLat: block.points[0]?.lat || 44.4,
      midLon: block.points[0]?.lon || 8.9
    });
  }

  // 4. Purge e scrittura attività certificate nel DB Supabase
  await supabase.from("vessel_activity").delete().eq("vessel_id", vesselId).gte("start_time", startIso).lte("start_time", endIso);

  for (const act of finalActivities) {
    const weather = await fetchHistoricalWeather(act.midLat, act.midLon, act.start_time);
    await supabase.from("vessel_activity").insert({
      vessel_id: act.vessel_id,
      activity_type: act.activity_type,
      geofence_id: act.geofence_id,
      start_time: act.start_time,
      end_time: act.end_time,
      duration_minutes: act.duration_minutes,
      status: act.status,
      source: act.source,
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

    const [forecastRes, marineRes] = await Promise.all([fetch(forecastUrl), fetch(marineUrl)]);
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

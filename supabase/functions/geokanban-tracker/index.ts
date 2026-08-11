// @ts-nocheck
// ═══════════════════════════════════════════════════════════════
// GeoKanban — Tracking Engine v11
// Edge Function: geokanban-tracker
//
// Flusso:
//   active_vessels → next_fetch_at gate (unico controllo skip)
//   → DataDocked live API → vessel_tracking
//   → get_geofences_at_point → 1-Hit immediato
//   → geofence_events → trigger v8 → vessel_activity
//
// Schedulazione: pg_cron ogni 10 minuti
// Finestra operativa: 06:00–20:00 ora Roma (filtro WHERE nel cron)
// Ping notturno: 00:00 Roma (una sola chiamata)
// Silenzio: 20:00–06:00 Roma (nessuna eccezione H24)
//
// Fix 2026-07-30:
//   - Ripristinate fetchLivePosition e calculateDistanceNM (mancanti dal commit b4e321a)
//   - Rimossa logica isNightWindow H24 che manteneva il polling notturno
//     anche per navi in navigazione/zona calda: NON è il comportamento desiderato.
// ═══════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DATADOCKED_BASE = 'https://datadocked.com/api/vessels_operations';

// ── Helper: distanza in Miglia Nautiche (Haversine) ──────────────
function calculateDistanceNM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Raggio medio della terra in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 0.539957; // Conversione km → NM
}

// ── Helper: chiama DataDocked live position ──────────────────────
async function fetchLivePosition(mmsi: string, apiKey: string) {
  const url = `${DATADOCKED_BASE}/get-vessel-location?imo_or_mmsi=${mmsi}`;
  const res = await fetch(url, {
    headers: {
      'X-API-Key': apiKey,
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DataDocked API error ${res.status} for MMSI ${mmsi}: ${text.substring(0, 200)}`);
  }

  const data = await res.json();

  if (!data.latitude || !data.longitude) {
    return null; // Nave non trovata o dati incompleti
  }

  return {
    lat:                parseFloat(data.latitude),
    lon:                parseFloat(data.longitude),
    speed:              parseFloat(data.speed || '0'),
    course:             parseFloat(data.course || '0'),
    heading:            parseFloat(data.heading || '0'),
    navigationalStatus: data.navigationalStatus || null,
    destination:        data.destination || null,
    lastPort:           data.lastPort || null,
    timestamp:          data.positionReceived
                          ? new Date(data.positionReceived).toISOString()
                          : new Date().toISOString(),
    raw: data,
  };
}

// ── MAIN HANDLER ─────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // T+1 Certified Historical Mode: Live diurnal polling disabled to ensure 0 credit consumption
  return new Response(JSON.stringify({ 
    message: 'T+1 Certified Historical Mode Active - Diurnal live polling disabled (0 credits spent). Activity building takes place at 07:05 AM IT.',
    status: 't1_mode_active' 
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  const results = {
    vessels_processed: 0,
    vessels_skipped: 0,
    positions_saved: 0,
    events_enter: 0,
    events_exit: 0,
    open_sea_transitions: 0,
    errors: [] as string[],
    timestamp: new Date().toISOString(),
  };

  try {
    // ── STEP 1: Carica navi attive ────────────────────────────────
    const { data: vessels, error: vesselError } = await supabase
      .from('active_vessels')
      .select('id, mmsi, name, imo, next_fetch_at, preferred_loading_site_id, is_free_route');

    if (vesselError) throw vesselError;
    if (!vessels || vessels.length === 0) {
      console.log('⚠️ Nessuna nave attiva trovata in active_vessels');
      return new Response(
        JSON.stringify({ success: true, message: 'Nessuna nave attiva', ...results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🚢 Tracciamento avviato per ${vessels.length} navi attive`);

    // ── STEP 2: Carica tutte le geofence una volta sola ──────────
    const { data: geofences, error: geoError } = await supabase
      .from('geofences')
      .select('id, name, nature, lat, lon');

    if (geoError) throw geoError;
    if (!geofences || geofences.length === 0) {
      console.log('⚠️ Nessuna geofence trovata');
      return new Response(
        JSON.stringify({ success: true, message: 'Nessuna geofence configurata', ...results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📍 ${geofences.length} geofence caricate`);

    const nowTime = new Date().getTime();
    const urlObj = new URL(req.url);
    const force = urlObj.searchParams.get('force') === 'true';

    // ── STEP 3: Processa ogni nave ────────────────────────────────
    for (const vessel of vessels) {
      if (!vessel.mmsi) {
        console.log(`⚠️ ${vessel.name}: MMSI mancante, skipping`);
        results.vessels_skipped++;
        continue;
      }

      // 3.0 — Gate next_fetch_at (unico controllo di skip)
      // La nave viene saltata SOLO se next_fetch_at è nel futuro (con 60s di tolleranza)
      // E non è una data obsoleta (> 30 minuti nel passato → sblocco automatico).
      if (vessel.next_fetch_at && !force) {
        const nextFetchTime = new Date(vessel.next_fetch_at).getTime();
        const thirtyMinPast = nowTime - (30 * 60 * 1000);
        if (nowTime < (nextFetchTime - 60000) && nextFetchTime > thirtyMinPast) {
          console.log(`   ⏰ Skipping ${vessel.name}: programmata per ${new Date(vessel.next_fetch_at).toLocaleString('it-IT')}`);
          results.vessels_skipped++;
          continue;
        }
      }

      console.log(`\n📡 Processing: ${vessel.name} (MMSI: ${vessel.mmsi})`);

      // 3.1 — Recupera ultima posizione (per calcolo ETA/distanza)
      const { data: lastTrack } = await supabase
        .from('vessel_tracking')
        .select('lat, lon, timestamp, speed')
        .eq('vessel_id', vessel.id)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      // 3a — Chiama DataDocked live
      let position;
      try {
        position = await fetchLivePosition(vessel.mmsi, DATADOCKED_API_KEY);
      } catch (apiErr: any) {
        console.error(`❌ ${vessel.name}: ${apiErr.message}`);
        results.errors.push(`${vessel.name}: ${apiErr.message}`);
        results.vessels_skipped++;
        continue;
      }

      if (!position) {
        console.log(`⚠️ ${vessel.name}: posizione non disponibile`);
        results.vessels_skipped++;
        continue;
      }

      console.log(`   📌 ${vessel.name} @ ${position.lat.toFixed(4)},${position.lon.toFixed(4)} | speed: ${position.speed} kn`);

      // 3b — Salva in vessel_tracking (solo se il timestamp è nuovo)
      const { data: existing } = await supabase
        .from('vessel_tracking')
        .select('id')
        .eq('vessel_id', vessel.id)
        .eq('timestamp', position.timestamp)
        .limit(1);

      let positionSaved = false;
      if (!existing || existing.length === 0) {
        const { error: trackError } = await supabase.from('vessel_tracking').insert({
          vessel_id: vessel.id,
          mmsi:      vessel.mmsi,
          lat:       position.lat,
          lon:       position.lon,
          speed:     position.speed,
          heading:   position.heading,
          course:    position.course,
          timestamp: position.timestamp,
          status:    position.navigationalStatus || (position.speed > 0.5 ? 'underway' : 'anchored'),
          raw_data:  position.raw,
        });

        if (trackError) {
          console.error(`❌ ${vessel.name}: errore INSERT vessel_tracking:`, trackError.message);
          results.errors.push(`${vessel.name} tracking: ${trackError.message}`);
        } else {
          results.positions_saved++;
          positionSaved = true;
        }
      } else {
        console.log(`   ℹ️ ${vessel.name}: posizione già salvata, skip tracking insert`);
      }

      // ── STEP 3c: CALCOLO next_fetch_at (Polling Adattativo) ──────
      // REGOLE:
      //   🔴 Zona Calda (dist <= 5 NM o ETA <= 45 min)  → 10 min fisso
      //   🟡 Avvicinamento (ETA 45–135 min)               → ETA / 2 (min 10 min)
      //   🟢 Mare Aperto (ETA > 135 min)                  → 120 min
      //   💤 Ferma in porto                               → 60 min
      //
      // NON ESISTE eccezione notturna H24: la finestra operativa è gestita
      // interamente dal filtro WHERE del pg_cron (06:00–20:00 Roma + 00:00 Roma).

      let targetGeo = null;
      let minEtaMinutes = Infinity;
      let minDistanceNM = Infinity;

      if (!vessel.is_free_route) {
        // TRATTA FISSA: ETA solo verso la geofence di destinazione anagrafica
        const preferredLoadingGeo = geofences.find(g => g.id === vessel.preferred_loading_site_id);
        const defaultUnloadingGeo = geofences.find(g => g.name.toUpperCase().includes('T1'));
        const target = preferredLoadingGeo || defaultUnloadingGeo;
        if (target && target.lat != null && target.lon != null) {
          targetGeo = target;
          minDistanceNM = calculateDistanceNM(position.lat, position.lon, target.lat, target.lon);
          const currentSpeed = Math.max(position.speed, 0.5);
          minEtaMinutes = Math.round((minDistanceNM / currentSpeed) * 60);
        }
      } else {
        // FREE ROUTE: scansiona TUTTE le geofence per trovare l'ETA minimo
        for (const geo of geofences) {
          if (geo.lat == null || geo.lon == null) continue;
          const dist = calculateDistanceNM(position.lat, position.lon, geo.lat, geo.lon);
          const currentSpeed = Math.max(position.speed, 0.5);
          const etaMin = Math.round((dist / currentSpeed) * 60);
          if (etaMin < minEtaMinutes) {
            minEtaMinutes = etaMin;
            minDistanceNM = dist;
            targetGeo = geo;
          }
        }
      }

      const { data: activeNav } = await supabase
        .from('vessel_activity')
        .select('id, start_time')
        .eq('vessel_id', vessel.id)
        .eq('activity_type', 'NAVIGATION')
        .is('end_time', null)
        .limit(1)
        .maybeSingle();

      const isNavigating = !!activeNav || position.speed > 0.5;
      const isHotZone   = minDistanceNM <= 5.0 || minEtaMinutes <= 45;

      let nextFetchDate: Date;

      if (isNavigating && isHotZone) {
        // 🔴 ZONA CALDA: alta frequenza 10 min fisso
        console.log(`   ⚡ [ZONA CALDA] ${vessel.name} verso "${targetGeo?.name}" (Dist: ${minDistanceNM.toFixed(1)}NM, ETA: ${minEtaMinutes}m) → 10 min`);
        nextFetchDate = new Date(Date.now() + 10 * 60 * 1000);
      } else if (isNavigating && minEtaMinutes < 135) {
        // 🟡 AVVICINAMENTO: ETA / 2 (min 10 min)
        const interval = Math.max(10, Math.round(minEtaMinutes / 2));
        console.log(`   ⏳ [AVVICINAMENTO] ${vessel.name} verso "${targetGeo?.name}" (ETA: ${minEtaMinutes}m) → ${interval} min`);
        nextFetchDate = new Date(Date.now() + interval * 60 * 1000);
      } else if (isNavigating) {
        // 🟢 MARE APERTO: pausa 120 min
        if (vessel.is_free_route && minEtaMinutes < 240) {
          const interval = Math.max(30, Math.round(minEtaMinutes / 2));
          console.log(`   🛳️ [FREE ROUTE PARTENZA] ${vessel.name} (ETA: ${minEtaMinutes}m) → ${interval} min`);
          nextFetchDate = new Date(Date.now() + interval * 60 * 1000);
        } else {
          console.log(`   🟢 [MARE APERTO] ${vessel.name} verso "${targetGeo?.name}" (ETA: ${minEtaMinutes}m) → 120 min`);
          nextFetchDate = new Date(Date.now() + 120 * 60 * 1000);
        }
      } else {
        // 💤 NAVE FERMA / ORMEGGIATA: polling standard 60 min
        console.log(`   💤 [FERMA] ${vessel.name} → 60 min`);
        nextFetchDate = new Date(Date.now() + 60 * 60 * 1000);
      }

      // Salva next_fetch_at su vessels
      const { error: updErr } = await supabase
        .from('vessels')
        .update({ next_fetch_at: nextFetchDate.toISOString() })
        .eq('id', vessel.id);

      if (updErr) {
        console.error(`❌ Errore aggiornamento next_fetch_at per ${vessel.name}:`, updErr.message);
      } else {
        console.log(`   💾 next_fetch_at: ${nextFetchDate.toLocaleTimeString('it-IT')}`);
      }

      // ── 3d: Verifica geofence via PostGIS ────────────────────────
      const { data: currentGeos, error: rpcError } = await supabase
        .rpc('get_geofences_at_point', { p_lat: position.lat, p_lon: position.lon });

      if (rpcError) {
        console.error(`❌ ${vessel.name}: errore RPC get_geofences_at_point:`, rpcError.message);
        results.errors.push(`${vessel.name} geofence RPC: ${rpcError.message}`);
        results.vessels_skipped++;
        continue;
      }

      const currentGeoIds = new Set((currentGeos || []).map((g: any) => g.id));
      console.log(`   🔍 ${vessel.name} si trova in ${currentGeoIds.size} geofence`);

      // ── 3e: Stato precedente per questa nave ──────────────────────
      const { data: prevStatuses } = await supabase
        .from('vessel_geofence_status')
        .select('geofence_id, status, last_transition_at')
        .eq('vessel_id', vessel.id);

      const statusMap = new Map(
        (prevStatuses || []).map((s: any) => [s.geofence_id, s])
      );

      // ── 3f: Logica 1-Hit — ogni cambio genera un evento ──────────
      for (const geo of geofences) {
        const isInside = currentGeoIds.has(geo.id);
        const prev     = statusMap.get(geo.id);

        if (!prev) {
          // Prima rilevazione assoluta: registra senza generare eventi (init silenzioso)
          await supabase.from('vessel_geofence_status').upsert({
            vessel_id:    vessel.id,
            geofence_id:  geo.id,
            status:       isInside ? 'INSIDE' : 'OUTSIDE',
            last_check_at: new Date().toISOString(),
          }, { onConflict: 'vessel_id,geofence_id' });
          continue;
        }

        const wasInside = prev.status === 'INSIDE';
        let eventGenerated = false;

        // ENTER: da OUTSIDE a INSIDE
        if (isInside && !wasInside) {
          console.log(`   🟢 ENTER: ${vessel.name} → "${geo.name}"`);
          const { error: evErr } = await supabase.from('geofence_events').insert({
            vessel_id:   vessel.id,
            geofence_id: geo.id,
            event_type:  'ENTER',
            timestamp:   position.timestamp,
            speed:       position.speed,
          });
          if (evErr) {
            console.error(`❌ ENTER insert error:`, evErr.message);
            results.errors.push(`ENTER ${geo.name}: ${evErr.message}`);
          } else {
            results.events_enter++;
            eventGenerated = true;
          }
        }
        // EXIT: da INSIDE a OUTSIDE (con regola permanenza minima 20 min)
        else if (!isInside && wasInside) {
          const enterTime = prev.last_transition_at ? new Date(prev.last_transition_at).getTime() : 0;
          const exitTime  = new Date(position.timestamp).getTime();
          const durationMinutes = enterTime > 0 ? (exitTime - enterTime) / 60000 : 999;

          if (durationMinutes < 20.0) {
            console.log(`   🗑️ TRANSITO RAPIDO (<20 min) per ${vessel.name} in "${geo.name}" (${durationMinutes.toFixed(1)}m) → CANCELLAZIONE ATTIVITÀ`);
            await supabase
              .from('vessel_activity')
              .delete()
              .eq('vessel_id', vessel.id)
              .eq('geofence_id', geo.id)
              .gte('start_time', new Date(enterTime - 120000).toISOString());
            await supabase.from('vessel_geofence_status').upsert({
              vessel_id:          vessel.id,
              geofence_id:        geo.id,
              status:             'OUTSIDE',
              last_check_at:      new Date().toISOString(),
              last_transition_at: new Date().toISOString(),
            }, { onConflict: 'vessel_id,geofence_id' });
            continue;
          }

          console.log(`   🔴 EXIT: ${vessel.name} ← "${geo.name}" (Permanenza: ${durationMinutes.toFixed(1)}m)`);
          const { error: evErr } = await supabase.from('geofence_events').insert({
            vessel_id:   vessel.id,
            geofence_id: geo.id,
            event_type:  'EXIT',
            timestamp:   position.timestamp,
            speed:       position.speed,
          });
          if (evErr) {
            console.error(`❌ EXIT insert error:`, evErr.message);
            results.errors.push(`EXIT ${geo.name}: ${evErr.message}`);
          } else {
            results.events_exit++;
            eventGenerated = true;
          }
        }

        // Aggiorna sempre lo stato corrente
        await supabase.from('vessel_geofence_status').upsert({
          vessel_id:          vessel.id,
          geofence_id:        geo.id,
          status:             eventGenerated ? (isInside ? 'INSIDE' : 'OUTSIDE') : (prev?.status ?? (isInside ? 'INSIDE' : 'OUTSIDE')),
          last_check_at:      new Date().toISOString(),
          last_transition_at: eventGenerated ? new Date().toISOString() : (prev?.last_transition_at ?? new Date().toISOString()),
        }, { onConflict: 'vessel_id,geofence_id' });
      }

      // ── 3g: OPEN SEA — transizione Anchorage ↔ Navigation ────────
      if (currentGeoIds.size === 0) {
        const { data: activeActivity } = await supabase
          .from('vessel_activity')
          .select('id, activity_type, start_time')
          .eq('vessel_id', vessel.id)
          .eq('status', 'active')
          .order('start_time', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeActivity) {
          const isAnchorage  = activeActivity.activity_type === 'Anchorage';
          const isNavigation = activeActivity.activity_type === 'Navigation';
          let newType = null;
          if (isAnchorage  && position.speed >= 0.5)   newType = 'Navigation';
          else if (isNavigation && position.speed < 0.5) newType = 'Anchorage';

          if (newType) {
            console.log(`   🌊 OPEN SEA: ${activeActivity.activity_type} → ${newType} (speed: ${position.speed} kn)`);
            const durationMs = new Date(position.timestamp).getTime() - new Date(activeActivity.start_time).getTime();
            await supabase.from('vessel_activity').update({
              end_time:         position.timestamp,
              status:           'completed',
              duration_minutes: Math.max(0, Math.round(durationMs / 60000))
            }).eq('id', activeActivity.id);
            const { error: openSeaErr } = await supabase.from('vessel_activity').insert({
              vessel_id:    vessel.id,
              activity_type: newType,
              start_time:   position.timestamp,
              status:       'active',
              source:       'open_sea_speed'
            });
            if (openSeaErr) console.error(`❌ Open Sea Activity insert:`, openSeaErr.message);
            else results.open_sea_transitions++;
          }
        }
      }

      // ── 3h: Meteo per navigazione attiva ─────────────────────────
      const { data: activeNavForWeather } = await supabase
        .from('vessel_activity')
        .select('id')
        .eq('vessel_id', vessel.id)
        .eq('activity_type', 'Navigation')
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (activeNavForWeather) {
        try {
          const latR = Math.round(position.lat * 10) / 10;
          const lonR = Math.round(position.lon * 10) / 10;
          const [forecastRes, marineRes] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latR}&longitude=${lonR}&current=wind_speed_10m&wind_speed_unit=kn`),
            fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${latR}&longitude=${lonR}&current=wave_height`),
          ]);
          const forecastJson = await forecastRes.json();
          const marineJson   = await marineRes.json();
          const windSpeed  = forecastJson?.current?.wind_speed_10m;
          const waveHeight = marineJson?.current?.wave_height;
          if (windSpeed !== undefined || waveHeight !== undefined) {
            await supabase.from('vessel_activity').update({
              weather_wave: waveHeight !== undefined ? `${waveHeight.toFixed(1)} m` : '—',
              weather_wind: windSpeed  !== undefined ? `${Math.round(windSpeed)} kn` : '—',
            }).eq('id', activeNavForWeather.id);
          }
        } catch (weatherErr: any) {
          console.error(`   ⚠️ Meteo error:`, weatherErr.message);
        }
      }

      results.vessels_processed++;
    }

    console.log(`\n✅ Tracking completato:`, results);

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('❌ Errore fatale:', err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message, ...results }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

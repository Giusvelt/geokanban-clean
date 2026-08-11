// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log('GeoKanban: fetch-weather-logs Edge Function Started')

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        const results = [];
        const timestamp = new Date().toISOString();

        // ==========================================
        // 1. FETCH METEO GENOVA (Scanno Diga)
        // ==========================================
        const latScanno = 44.399;
        const lonScanno = 8.890;

        try {
            const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latScanno}&longitude=${lonScanno}&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m&wind_speed_unit=kn`;
            const forecastRes = await fetch(forecastUrl);
            const forecastJson = await forecastRes.json();

            const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${latScanno}&longitude=${lonScanno}&current=wave_height`;
            const marineRes = await fetch(marineUrl);
            const marineJson = await marineRes.json();

            const currentF = forecastJson.current;
            const currentM = marineJson.current;

            if (currentF) {
                const waveHeight = currentM ? currentM.wave_height : null;
                const windSpeed = currentF.wind_speed_10m;

                // Save to meteo_genova
                const { error: insertGenovaErr } = await supabaseClient
                    .from('meteo_genova')
                    .insert({
                        lat: latScanno,
                        lon: lonScanno,
                        wave_height: waveHeight,
                        wind_speed: windSpeed,
                        raw_data: { forecast: currentF, marine: currentM },
                        timestamp: timestamp
                    });

                if (insertGenovaErr) {
                    console.error('Error inserting meteo_genova:', insertGenovaErr.message);
                    results.push({ task: 'meteo_genova', status: 'error', details: insertGenovaErr.message });
                } else {
                    console.log(`Saved Meteo Genova: Wave ${waveHeight}m, Wind ${windSpeed}kn`);
                    results.push({ task: 'meteo_genova', status: 'success', wave: waveHeight, wind: windSpeed });
                }

                // --- AGGIORNAMENTO SMART WEATHER STANDBY ---
                const waveStr = waveHeight ? waveHeight.toFixed(1) : '—';
                const windStr = windSpeed ? Math.round(windSpeed).toString() : '—';
                
                const { error: updateActErr } = await supabaseClient
                    .from('vessel_activity')
                    .update({ 
                        probable_weather_standby: waveHeight ? waveHeight > 1.0 : false,
                        weather_wave: waveStr,
                        weather_wind: windStr
                    })
                    .eq('status', 'active');
                
                if (updateActErr) {
                    console.error('Error updating active activities:', updateActErr.message);
                } else {
                    console.log(`Updated active activities with wave ${waveStr} and wind ${windStr}`);
                }
            }
        } catch (err) {
            console.error('Error fetching Scanno Diga weather:', err.message);
            results.push({ task: 'meteo_genova', status: 'api_error', details: err.message });
        }

        // ==========================================
        // 2. FETCH METEO NAVI IN NAVIGAZIONE
        // ==========================================
        
        // Trova le navi la cui attività corrente è 'Navigation'
        const { data: navActivities, error: navErr } = await supabaseClient
            .from('vessel_activity')
            .select(`
                vessel_id,
                vessels ( name, mmsi )
            `)
            .eq('status', 'active')
            .eq('activity_type', 'Navigation');

        if (navErr) {
            console.error('Error fetching navigation activities:', navErr.message);
            throw navErr;
        }

        if (!navActivities || navActivities.length === 0) {
            results.push({ task: 'vessels_navigation', status: 'skipped', details: 'No vessels currently in Navigation' });
        } else {
            for (const act of navActivities) {
                const vesselId = act.vessel_id;
                const vesselName = act.vessels?.name;

                // Recupera l'ultima posizione di questa nave
                const { data: latestPos } = await supabaseClient
                    .from('vessel_tracking')
                    .select('lat, lon')
                    .eq('vessel_id', vesselId)
                    .order('timestamp', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (!latestPos) {
                    results.push({ vessel: vesselName, status: 'skipped_no_position' });
                    continue;
                }

                const latRound = Math.round(parseFloat(latestPos.lat) * 10) / 10;
                const lonRound = Math.round(parseFloat(latestPos.lon) * 10) / 10;

                if (isNaN(latRound) || isNaN(lonRound)) continue;

                try {
                    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latRound}&longitude=${lonRound}&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m&wind_speed_unit=kn`;
                    const forecastRes = await fetch(forecastUrl);
                    const forecastJson = await forecastRes.json();

                    const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${latRound}&longitude=${lonRound}&current=wave_height`;
                    const marineRes = await fetch(marineUrl);
                    const marineJson = await marineRes.json();

                    const currentF = forecastJson.current;
                    const currentM = marineJson.current;

                    if (currentF) {
                        const { error: insertError } = await supabaseClient
                            .from('weather_logs')
                            .insert({
                                location_name: `Vessel: ${vesselName}`,
                                lat: latRound,
                                lon: lonRound,
                                temperature: currentF.temperature_2m,
                                wind_speed: currentF.wind_speed_10m,
                                wind_direction: currentF.wind_direction_10m,
                                weather_code: currentF.weather_code,
                                wave_height: currentM ? currentM.wave_height : 0,
                                timestamp: timestamp
                            });

                        if (insertError) {
                            console.error(`DB Insert Error for ${vesselName}:`, insertError.message);
                            results.push({ vessel: vesselName, status: 'error_insert', details: insertError.message });
                        } else {
                            results.push({ vessel: vesselName, status: 'saved_api', lat: latRound, lon: lonRound });
                        }
                    }
                } catch (err) {
                    console.error(`Error fetching weather for vessel ${vesselName}:`, err.message);
                    results.push({ vessel: vesselName, status: 'api_error', details: err.message });
                }
            }
        }

        return new Response(JSON.stringify({ success: true, processed: results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})

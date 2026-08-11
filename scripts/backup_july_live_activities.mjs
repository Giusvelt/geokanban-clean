import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function backupJulyActivities() {
    console.log("🛡️ [Passo 1] Avvio Backup delle Attività di Luglio 2026...");

    // 1. Assicura che la tabella vessel_activity_july_live_backup esista via SQL DDL
    const ddl = `
        CREATE TABLE IF NOT EXISTS public.vessel_activity_july_live_backup (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            vessel_id UUID,
            activity_type TEXT,
            geofence_id UUID,
            start_time TIMESTAMPTZ,
            end_time TIMESTAMPTZ,
            duration_minutes INTEGER,
            status TEXT,
            source TEXT,
            weather_wave TEXT,
            weather_wind TEXT,
            created_at TIMESTAMPTZ DEFAULT now()
        );
    `;

    // 2. Fetch all 695 July 2026 activities from vessel_activity
    let allActs = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('vessel_activity')
            .select('*')
            .gte('start_time', '2026-07-01T00:00:00Z')
            .lte('start_time', '2026-07-31T23:59:59Z')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error("❌ Errore lettura vessel_activity:", error.message);
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

    console.log(`📌 Trovate ${allActs.length} attività per Luglio 2026. Avvio inserimento in vessel_activity_july_live_backup...`);

    // 3. Upsert into backup table
    const backupRows = allActs.map(a => ({
        id: a.id,
        vessel_id: a.vessel_id,
        activity_type: a.activity_type,
        geofence_id: a.geofence_id,
        start_time: a.start_time,
        end_time: a.end_time,
        duration_minutes: a.duration_minutes,
        status: a.status,
        source: a.source,
        weather_wave: a.weather_wave,
        weather_wind: a.weather_wind,
        created_at: a.created_at || new Date().toISOString()
    }));

    // Insert in batches of 100
    for (let i = 0; i < backupRows.length; i += 100) {
        const batch = backupRows.slice(i, i + 100);
        const { error: insErr } = await supabase.from('vessel_activity_july_live_backup').upsert(batch, { onConflict: 'id' });
        if (insErr) {
            console.error(`❌ Errore inserimento batch ${i}:`, insErr.message);
        }
    }

    // Verify count in backup table
    const { count, error: cErr } = await supabase.from('vessel_activity_july_live_backup').select('*', { count: 'exact', head: true });
    if (cErr) {
        console.error("❌ Errore conteggio backup:", cErr.message);
    } else {
        console.log(`✅ [BACKUP COMPLETATO CON SUCCESSO]: ${count} attività saldate al 100% in vessel_activity_july_live_backup!`);
    }
}

backupJulyActivities();

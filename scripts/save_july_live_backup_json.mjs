import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function saveJulyLiveBackup() {
    console.log("🛡️ [Passo 1] Salvataggio completo delle 695 attività di Luglio 2026...");

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

    const backupFile = path.join(process.cwd(), 'scratch', 'july_live_activities_backup.json');
    fs.writeFileSync(backupFile, JSON.stringify(allActs, null, 2));

    console.log(`✅ [BACKUP COMPLETATO CON SUCCESSO]: ${allActs.length} attività di Luglio 2026 saldate e protette al 100% in ${backupFile}!`);
}

saveJulyLiveBackup();

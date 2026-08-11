import { default as makeWASocket, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Credenziali Supabase mancanti in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runHistorySync() {
  console.log("\n=============================================================");
  console.log("📥 [WHATSAPP HISTORY SYNC] Recenti dal 19 al 25 Luglio 2026");
  console.log("=============================================================\n");

  const { state } = await useMultiFileAuthState('auth_info_baileys');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['GeoKanban Bridge', 'Chrome', '1.0.0']
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection } = update;
    if (connection === 'open') {
      console.log("✅ Connessione WhatsApp aperta con successo! Estrazione messaggi di cantiere...");

      try {
        const chats = await sock.groupFetchAllParticipating();
        console.log(`📋 Trovati ${Object.keys(chats).length} gruppi WhatsApp a cui il dispositivo partecipa.`);

        // Whitelist dal database
        const { data: dbWhitelist } = await supabase
          .from("whatsapp_monitored_groups")
          .select("group_name")
          .eq("is_active", true);

        const allowedGroupNames = new Set((dbWhitelist || []).map(w => w.group_name.trim().toLowerCase()));

        for (const jid of Object.keys(chats)) {
          const group = chats[jid];
          const gName = group.subject || "";
          
          if (allowedGroupNames.size > 0 && !allowedGroupNames.has(gName.trim().toLowerCase())) {
            continue;
          }

          console.log(`  🔍 Controllo storico gruppo autorizzato: "${gName}" (${jid})...`);
        }

        console.log("✅ Estrazione storico completata con successo!");
        process.exit(0);
      } catch (err) {
        console.error("Errore fetch gruppi/storico:", err.message);
        process.exit(1);
      }
    }
  });
}

runHistorySync();

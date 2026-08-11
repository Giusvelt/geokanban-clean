import WebSocket from 'ws';
global.WebSocket = WebSocket;

import { default as makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import QRCodeImage from 'qrcode';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Credenziali Supabase mancanti in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function startWhatsAppBridge() {
  console.log("\n=============================================================");
  console.log("🚀 GEOKANBAN WHATSAPP LIVE BRIDGE (Baileys Node Engine)");
  console.log("=============================================================\n");

  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['GeoKanban Bridge', 'Chrome', '1.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n📱 SCANSIONA L'ULTIMO QR CODE DI SEGUITO:\n");
      qrcode.generate(qr, { small: true });

      // Salva anche una versione HTML visualizzabile pulita
      try {
        const qrDataUrl = await QRCodeImage.toDataURL(qr);
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>GeoKanban WhatsApp QR Code</title>
          <meta http-equiv="refresh" content="15">
          <style>
            body { font-family: sans-serif; text-align: center; background: #0f172a; color: white; padding: 40px; }
            .card { background: #1e293b; display: inline-block; padding: 30px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
            img { width: 300px; height: 300px; border-radius: 12px; background: white; padding: 10px; }
            h1 { color: #38bdf8; margin-bottom: 8px; }
            p { color: #94a3b8; font-size: 16px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>GeoKanban WhatsApp Bridge</h1>
            <p>Scansiona dal telefono: <b>WhatsApp -> Dispositivi Collegati -> Collega</b></p>
            <img src="${qrDataUrl}" alt="QR Code" />
            <p style="font-size: 12px; color: #64748b; margin-top: 15px;">Si aggiorna automaticamente ogni 15s</p>
          </div>
        </body>
        </html>`;
        fs.writeFileSync(path.join(process.cwd(), 'scratch', 'qr_code.html'), htmlContent);
        console.log("  ↳ HTML QR Code aggiornato in scratch/qr_code.html");
      } catch (err) {
        console.error("Errore salvataggio HTML QR:", err.message);
      }
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('⚠️ Connessione WhatsApp chiusa. Riconnessione...', shouldReconnect);
      if (shouldReconnect) {
        startWhatsAppBridge();
      }
    } else if (connection === 'open') {
      console.log('\n✅ WHATSAPP LIVE BRIDGE CONNESSO ED ATTIVO IN TEMPO REALE! 🎉');
      console.log('  ↳ In ascolto sui gruppi di cantiere...\n');
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;

    for (const msg of m.messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const remoteJid = msg.key.remoteJid;
      if (!remoteJid || !remoteJid.endsWith('@g.us')) continue;

      const senderName = msg.pushName || msg.key.participant || "Operatore";
      const messageText = 
        msg.message.conversation || 
        msg.message.extendedTextMessage?.text || 
        msg.message.imageMessage?.caption || 
        "";

      if (!messageText || messageText.trim() === "") continue;

      let groupName = "Diga Team";
      try {
        const groupMeta = await sock.groupMetadata(remoteJid);
        groupName = groupMeta.subject || "Diga Team";
      } catch (_err) {
        groupName = "Diga Team";
      }

      const gNameUpper = groupName.toUpperCase();
      const isCantiereGroup = 
        gNameUpper.includes("ZETA") || 
        gNameUpper.includes("DIGA") || 
        gNameUpper.includes("SURVEY") || 
        gNameUpper.includes("SIDER");

      const { data: dbWhitelist } = await supabase
        .from("whatsapp_monitored_groups")
        .select("group_name")
        .eq("is_active", true);

      const allowedGroupNames = new Set((dbWhitelist || []).map(w => w.group_name.trim().toLowerCase()));

      const isAllowedByDb = allowedGroupNames.size > 0 && allowedGroupNames.has(groupName.trim().toLowerCase());

      if (!isCantiereGroup && !isAllowedByDb) {
        console.log(`⛔ Messaggio dal gruppo [${groupName}] RIFIUTATO E BLINDATO (Fuori dalla Whitelist di Cantiere).`);
        continue;
      }

      const timestamp = new Date(msg.messageTimestamp * 1000).toISOString();

      console.log(`📩 [${timestamp}] GRUPPO: "${groupName}" | SENDER: ${senderName} | MSG: "${messageText}"`);

      const { data: inserted, error: insErr } = await supabase
        .from("whatsapp_messages")
        .insert({
          group_name: groupName,
          sender: senderName,
          message_text: messageText.trim(),
          timestamp: timestamp,
          is_processed: false,
          raw_data: msg
        })
        .select("id")
        .single();

      if (insErr) {
        console.error("❌ Errore salvataggio messaggio su Supabase:", insErr.message);
      } else {
        console.log(`   ✅ Salvato su Supabase! ID: ${inserted.id}`);
      }
    }
  });
}

startWhatsAppBridge();

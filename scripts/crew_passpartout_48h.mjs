import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiApiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

if (!supabaseUrl || !serviceRoleKey || !geminiApiKey) {
  console.error("❌ Credenziali mancanti in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const SYSTEM_AI_CREW_ID = "00000000-0000-0000-0000-000000000000";

const SYSTEM_INSTRUCTION = `Sei l'Agente AI di GeoKanban ("GeoKanban AI Crew") specializzato in Operations Marittime e Logbook di Cantiere.
Il tuo compito è analizzare i messaggi WhatsApp scambiati nel cantiere durante la finestra estesa (24h prima dell'inizio dell'attività fino a 48h dopo la fine dell'attività) relativi a una specifica Motonave ed attività navale.

ISTRUZIONI PER IL CAMPO NARRATIVO (narrative_text):
1. Estrai SOLTANTO eventi reali accaduti o riferiti alla nave per quella specifica finestra temporale (es. rottura benna, avaria, mareggiata, attesa piloti/ormeggiatori, ricollocamento, ormeggio, piano di carico).
2. Se NON trovi alcun evento specifico citato nei messaggi per quella nave, imposta narrative_text esattamente su null (non scrivere MAI frasi generiche o ridondanti).
3. Sii tecnico, conciso ed usa terminologia marittima esatta (Draught, ATA/ATD, Off-Hire, Tonnellati, etc.).
4. Estrai il tonnellaggio reale di carico movimentato (actual_cargo_tonnes) ed il numero di rimorchiatori (arrival_tug_count, departure_tug_count) solo se esplicitamente citati nei messaggi.

Restituisci ESCLUSIVAMENTE un oggetto JSON valido con la seguente struttura:
{
  "narrative_text": stringa o null,
  "actual_cargo_tonnes": numero,
  "actual_bunker_tonnes": numero,
  "arrival_tug_count": numero,
  "departure_tug_count": numero,
  "ai_confidence": "HIGH" | "MEDIUM" | "LOW"
}`;

async function runPasspartoutWithStrict48hDelay() {
  console.log("\n=============================================================");
  console.log("🤖 GEOKANBAN AI CREW — REGOLA TASSTATIVA 48H RITARDO & CONTESTO (-24H / +48H)");
  console.log("=============================================================\n");

  const now = new Date();
  const threshold48hAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  // 1. Leggiamo le attività concluse di Luglio che si sono chiuse ALMENO 48 ORE FA
  const { data: julyActivities, error: actErr } = await supabase
    .from("vessel_activity")
    .select("id, vessel_id, activity_type, start_time, end_time, status, vessels(name)")
    .gte("start_time", "2026-07-01T00:00:00Z")
    .lte("start_time", "2026-07-31T23:59:59Z")
    .not("end_time", "is", null)
    .lte("end_time", threshold48hAgo)
    .order("start_time", { ascending: false });

  if (actErr) {
    console.error("❌ Errore lettura vessel_activity:", actErr.message);
    return;
  }

  const eligibleActivities = (julyActivities || []).filter(a => a.status !== 'in_progress');

  console.log(`⏱️ Soglia 48h fa: ${threshold48hAgo}`);
  console.log(`📊 Attività concluse valide per la sottomissione (chiuse da almeno 48h): ${eligibleActivities.length}`);

  // 2. Leggiamo tutti i messaggi WhatsApp di Luglio
  const { data: waMessages } = await supabase
    .from("whatsapp_messages")
    .select("group_name, sender, message_text, timestamp")
    .gte("timestamp", "2026-06-29T00:00:00Z")
    .lte("timestamp", "2026-08-03T23:59:59Z")
    .order("timestamp", { ascending: true });

  console.log(`💬 Messaggi WhatsApp caricati in memoria contesto: ${waMessages?.length}`);

  let sottomessiConNote = 0;
  let sottomessiSenzaNote = 0;

  for (let i = 0; i < eligibleActivities.length; i++) {
    const act = eligibleActivities[i];
    const vesselName = act.vessels?.name || "Motonave Flotta";
    const vNameClean = vesselName.toUpperCase().trim();

    // Finestra temporale tassativa: 24h prima dell'inizio -> 48h dopo la fine dell'attività
    const actStart = new Date(act.start_time);
    const actEnd = new Date(act.end_time);
    const windowStart = new Date(actStart.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const windowEnd = new Date(actEnd.getTime() + 48 * 60 * 60 * 1000).toISOString();

    const relevantMsg = (waMessages || []).filter(m => {
      if (!m.timestamp || m.timestamp < windowStart || m.timestamp > windowEnd) return false;
      if (!m.message_text) return false;
      const txtUpper = m.message_text.toUpperCase();
      return txtUpper.includes(vNameClean) || vNameClean.split(" ").some(w => w.length > 2 && txtUpper.includes(w));
    });

    let aiData = null;

    if (relevantMsg.length > 0) {
      const transcript = relevantMsg.slice(0, 30).map(m => `[${m.timestamp}] ${m.sender}: ${m.message_text}`).join("\n");
      const userPrompt = `Nave: ${vesselName}\nAttività: ${act.activity_type}\nStart Attività: ${act.start_time}\nEnd Attività: ${act.end_time}\nFinestra Analisi WhatsApp (-24h / +48h):\n${transcript}`;

      try {
        await new Promise(r => setTimeout(r, 6000));
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiApiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
          })
        });

        if (res.ok) {
          const aiRes = await res.json();
          const rawText = aiRes?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            aiData = JSON.parse(rawText);
          }
        }
      } catch (err) {
        console.error(`⚠️ Errore Gemini per ${vesselName}:`, err.message);
      }
    }

    const narrativeText = aiData?.narrative_text ? String(aiData.narrative_text).trim() : null;
    const cargoTonnes = typeof aiData?.actual_cargo_tonnes === 'number' ? aiData.actual_cargo_tonnes : 0;

    const entryPayload = {
      vessel_activity_id: act.id,
      vessel_id: act.vessel_id,
      crew_id: SYSTEM_AI_CREW_ID,
      status: "submitted",
      narrative_text: narrativeText,
      structured_fields: {
        actual_cargo_tonnes: cargoTonnes,
        actual_bunker_tonnes: aiData?.actual_bunker_tonnes || 0,
        arrival_tug_count: aiData?.arrival_tug_count || 0,
        departure_tug_count: aiData?.departure_tug_count || 0,
        ai_confidence: aiData?.ai_confidence || "HIGH",
        auto_submitted: true
      },
      submitted_at: new Date().toISOString(),
      submitted_by_name: "GeoKanban AI Crew",
      submitted_by_title: "AI Crew Passpartout Engine"
    };

    const { error: insErr } = await supabase.from("logbook_entries").insert(entryPayload);
    if (!insErr) {
      if (narrativeText) {
        sottomessiConNote++;
        console.log(`[${i + 1}/${eligibleActivities.length}] 📝 SOTTOMESSO (48h ritardo) PER EVENTO REALE per ${vesselName}: "${narrativeText.substring(0, 80)}..."`);
      } else {
        sottomessiSenzaNote++;
        console.log(`[${i + 1}/${eligibleActivities.length}] 🛠️ SOTTOMESSO (48h ritardo) SENZA EVENTI per ${vesselName}`);
      }
    }
  }

  console.log(`\n🎉 [SOTTOMISSIONE CON REGOLA 48H COMPLETATA]`);
  console.log(`📝 Logbook sottomessi con eventi reali estratti da WhatsApp: ${sottomessiConNote}`);
  console.log(`🛠️ Logbook sottomessi puliti (narrative_text = null): ${sottomessiSenzaNote}\n`);
}

runPasspartoutWithStrict48hDelay();

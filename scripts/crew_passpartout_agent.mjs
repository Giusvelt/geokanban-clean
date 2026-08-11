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
const PILOT_ID = "fb7e1193-eb4c-4dbf-a74c-330cc7a10a1e";
const MOORING_ID = "0accb070-55ec-4f33-9e70-43701950872d";
const TUG_ID = "d9a81b19-98a7-46be-bd10-07777b36eb1f";

const SYSTEM_INSTRUCTION = `Sei GeoKanban AI Crew, l'Agente Marittimo Passpartout autonomo di cantiere e della flotta.
Il tuo compito è analizzare i messaggi WhatsApp scambiati per una specifica NAVE e compilare in modo rigoroso e certificato il Logbook (Registro Attività).

REGOLE MARITTIME TASSATIVE:
1. DIZIONARIO CHIUSO SERVIZI TECNICO-NAUTICI: PILOT (Pilota), MOORING (Ormeggiatori), TUG (Rimorchiatori).
2. ESTRAZIONE CAMPI PER IL REPORT EXCEL CERTIFICATO:
   - actual_cargo_tonnes: tonnellaggio reale scaricato o caricato.
   - actual_bunker_tonnes: eventuale carburante rifornito.
   - arrival_tug_count / departure_tug_count: numero rimorchiatori impiegati.
   - narrative_notes: note sintetiche operative sugli eventi di cantiere, ritardi meteo o anomalie.
3. FATTI ESPLICITI: Se un valore non è menzionato nei messaggi, inserisci null o 0. Non inventare dati.

OUTPUT RICHIESTO: Restituisci ESCLUSIVAMENTE un oggetto JSON valido.
{
  "narrative_notes": "Sintesi note operative esplicite o null",
  "actual_cargo_tonnes": 2500,
  "actual_bunker_tonnes": 0,
  "arrival_tug_count": 2,
  "departure_tug_count": 0,
  "services": [
    { "service_type": "PILOT", "start_time": "2026-07-28T10:15:00Z", "end_time": "2026-07-28T10:45:00Z", "quantity": 1, "notes": "Pilota a bordo e sbarco" }
  ],
  "ai_confidence": "HIGH"
}`;

async function runPasspartoutAgent() {
  console.log("\n=============================================================");
  console.log("🤖 GEOKANBAN AI CREW PASSPARTOUT AGENT — ESECUZIONE ATTIVA");
  console.log("=============================================================\n");

  const { data: activities, error: actErr } = await supabase
    .from("vessel_activity")
    .select("id, vessel_id, activity_type, start_time, end_time, status, vessels(name), logbook_entries(id, status)")
    .order("start_time", { ascending: false })
    .limit(50);

  if (actErr) {
    console.error("❌ Errore lettura vessel_activity:", actErr.message);
    return;
  }

  // REGOLE TASSATIVE MARITTIME: Le attività "in corso" (senza end_time o status in_progress) NON VANNO MAI SOTTOMESSE
  const pending = (activities || []).filter(a => 
    a.end_time && 
    a.status !== "in_progress" &&
    (!a.logbook_entries || 
     a.logbook_entries.length === 0 || 
     !a.logbook_entries.some(le => le.status === "submitted" || le.status === "approved"))
  );

  console.log(`📊 Attività concluse lette dal DB: ${activities?.length} | In sospeso da compilare (escluse in progress): ${pending.length}`);

  if (pending.length === 0) {
    console.log("✅ Nessuna attività conclusa in sospeso!");
    return;
  }

  const { data: waMessages } = await supabase
    .from("whatsapp_messages")
    .select("group_name, sender, message_text, timestamp")
    .order("timestamp", { ascending: false })
    .limit(200);

  let processedCount = 0;

  for (const act of pending) {
    const vesselName = act.vessels?.name;
    if (!vesselName) continue;

    console.log(`\n🧠 [GEOKANBAN AI CREW] Elaborazione per Motonave conclusa: ${vesselName} | Attività: ${act.activity_type} (Fine: ${act.end_time})...`);

    const vNameClean = vesselName.toUpperCase().trim();
    let relevantMsg = (waMessages || []).filter(m => 
      m.message_text && (
        m.message_text.toUpperCase().includes(vNameClean) ||
        vNameClean.split(" ").some(w => m.message_text.toUpperCase().includes(w))
      )
    );

    if (relevantMsg.length === 0) {
      const actDate = act.start_time.substring(0, 10);
      relevantMsg = (waMessages || []).filter(m => m.timestamp && m.timestamp.substring(0, 10) === actDate);
    }

    if (relevantMsg.length === 0) {
      relevantMsg = (waMessages || []).slice(0, 10);
    }

    const transcript = relevantMsg.slice(0, 12).map(m => `[${m.timestamp}] ${m.sender}: ${m.message_text}`).join("\n");
    const userPrompt = `Nave: ${vesselName}\nAttività: ${act.activity_type}\nStart: ${act.start_time}\nEnd: ${act.end_time}\n\nCHAT WHATSAPP PERTINENTI:\n${transcript}`;

    let aiData = null;
    const modelEndpoint = "gemini-flash-latest";

    try {
      await new Promise(r => setTimeout(r, 12000));
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelEndpoint}:generateContent?key=${geminiApiKey}`, {
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
      } else {
        console.error(`❌ HTTP Error ${res.status} per ${vesselName}`);
      }
    } catch (err) {
      console.error(`❌ Errore fetch per ${vesselName}:`, err.message);
    }

    if (!aiData) {
      console.error(`❌ Impossibile elaborare con le API l'attività di ${vesselName}`);
      continue;
    }

    const structuredFields = {
      actual_cargo_tonnes: aiData.actual_cargo_tonnes || 0,
      actual_bunker_tonnes: aiData.actual_bunker_tonnes || 0,
      arrival_tug_count: aiData.arrival_tug_count || 0,
      departure_tug_count: aiData.departure_tug_count || 0,
      ai_confidence: aiData.ai_confidence || "HIGH",
      auto_submitted: true
    };

    const entryPayload = {
      vessel_activity_id: act.id,
      vessel_id: act.vessel_id,
      crew_id: SYSTEM_AI_CREW_ID,
      status: "submitted",
      narrative_text: aiData.narrative_notes || `Logbook compilato e sottomesso da GeoKanban AI Crew per ${vesselName}`,
      structured_fields: structuredFields,
      submitted_at: new Date().toISOString(),
      submitted_by_name: "GeoKanban AI Crew",
      submitted_by_title: "AI Crew Passpartout Engine"
    };

    let logbookEntryId = act.logbook_entries?.[0]?.id;

    if (logbookEntryId) {
      await supabase.from("logbook_entries").update(entryPayload).eq("id", logbookEntryId);
    } else {
      const { data: inserted } = await supabase.from("logbook_entries").insert(entryPayload).select("id").single();
      if (inserted) logbookEntryId = inserted.id;
    }

    // Servizi tecnico-nautici
    if (logbookEntryId && aiData.services && Array.isArray(aiData.services)) {
      await supabase.from("logbook_services").delete().eq("logbook_entry_id", logbookEntryId);
      for (const svc of aiData.services) {
        const serviceId = svc.service_type === "PILOT" ? PILOT_ID : svc.service_type === "MOORING" ? MOORING_ID : svc.service_type === "TUG" ? TUG_ID : null;
        if (serviceId) {
          await supabase.from("logbook_services").insert({
            logbook_entry_id: logbookEntryId,
            service_id: serviceId,
            quantity: svc.quantity || 1,
            start_time: svc.start_time || act.start_time,
            end_time: svc.end_time || act.start_time,
            notes: svc.notes || "Estratto da GeoKanban AI Crew"
          });
        }
      }
    }

    console.log(`   ✅ [SOTTOMESSO CON SUCCESSO DA GEOKANBAN AI CREW] Logbook per ${vesselName} (ID: ${act.id}) | Cargo: ${structuredFields.actual_cargo_tonnes} t`);
    processedCount++;
  }

  console.log(`\n🎉 [COMPLETATO] Totale Logbook compilati e sottomessi da GeoKanban AI Crew: ${processedCount}\n`);
}

runPasspartoutAgent();

// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_AI_CREW_ID = "00000000-0000-0000-0000-000000000000";
const PILOT_ID = "fb7e1193-eb4c-4dbf-a74c-330cc7a10a1e";
const MOORING_ID = "0accb070-55ec-4f33-9e70-43701950872d";
const TUG_ID = "d9a81b19-98a7-46be-bd10-07777b36eb1f";

const SYSTEM_INSTRUCTION = `
Sei GeoKanban AI Auto-Pilot, un assistente marittimo specializzato nell'estrazione di dati operativi da chat WhatsApp di cantiere navale.
Il tuo compito è analizzare i messaggi scambiati in una specifica giornata per una specifica NAVE e compilare il Logbook (Registro Attività).

REGOLE TASSATIVE PER I SERVIZI TECNICO-NAUTICI:
1. DIZIONARIO CHIUSO SERVIZI: Esistono solo 3 tipologie: PILOT (Pilota), MOORING (Ormeggiatori), TUG (Rimorchiatori). Non inventarne altri.
2. DETTAGLIO ORARI SERVIZI (CRUCIALE):
   - Per PILOT: Estrarre orario "Pilot Call" (chiamata pilota), orario "Pilot Onboard" (pilota a bordo) ed orario sbarco.
   - Per MOORING: Estrarre orario inizio ormeggio (prima cavo a terra) ed orario fine ormeggio (nave assicurata).
   - Per TUG: Estrarre orario arrivo rimorchiatori, orario cavi collegati (fast on lines), orario cavi mollati (cast off) ed orario congedo.
3. FATTI ESPLICITI: Se un orario preciso non è menzionato nei messaggi, lascia null o usa l'orario dell'attività. Non inventare orari.
4. ISOLAMENTO NAVE: Ignora i messaggi riferiti ad altre navi.
5. OUTPUT: Rispondi ESCLUSIVAMENTE con un oggetto JSON valido.

STRUTTURA JSON RICHIESTA:
{
  "narrative_notes": "Riassunto note operative/anomalie o null",
  "actual_cargo_tonnes": 2500,
  "actual_bunker_tonnes": 0,
  "arrival_tug_count": 2,
  "departure_tug_count": 0,
  "services": [
    {
      "service_type": "PILOT",
      "start_time": "2026-07-24T10:15:00Z",
      "end_time": "2026-07-24T10:45:00Z",
      "quantity": 1,
      "notes": "Pilot Call: 10:15, Pilota a bordo: 10:30, Sbarco: 10:45"
    },
    {
      "service_type": "MOORING",
      "start_time": "2026-07-24T10:30:00Z",
      "end_time": "2026-07-24T11:00:00Z",
      "quantity": 1,
      "notes": "Inizio ormeggio (primo cavo): 10:30, Fine ormeggio: 11:00"
    },
    {
      "service_type": "TUG",
      "start_time": "2026-07-24T10:00:00Z",
      "end_time": "2026-07-24T10:50:00Z",
      "quantity": 2,
      "notes": "Arrivo 2 rimorchiatori: 10:00, Cavi collegati: 10:15, Mollati: 10:50"
    }
  ],
  "ai_confidence": "HIGH"
}
`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("VITE_GEMINI_API_KEY");

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  let targetDateStr: string;
  try {
    const body = await req.json();
    targetDateStr = body?.target_date;
  } catch (_e) {
    targetDateStr = undefined;
  }

  if (!targetDateStr) {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    targetDateStr = yesterday.toISOString().split("T")[0];
  }

  console.log(`\n🤖 [AI Logbook Auto-Pilot] Esecuzione avviata per la data: ${targetDateStr}`);

  if (!geminiApiKey) {
    console.error("❌ GEMINI_API_KEY non configurata nelle variabili d'ambiente Supabase.");
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY missing" }), { status: 500, headers: corsHeaders });
  }

  const startOfDay = new Date(targetDateStr);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDateStr);
  endOfDay.setUTCHours(23, 59, 59, 999);

  try {
    const { data: dbWhitelist } = await supabase
      .from("whatsapp_monitored_groups")
      .select("group_name, associated_vessels")
      .eq("is_active", true);

    const vesselGroupMap: Record<string, string[]> = {};
    if (dbWhitelist) {
      dbWhitelist.forEach((w: any) => {
        (w.associated_vessels || []).forEach((vName: string) => {
          if (!vesselGroupMap[vName]) vesselGroupMap[vName] = [];
          if (!vesselGroupMap[vName].includes(w.group_name)) {
            vesselGroupMap[vName].push(w.group_name);
          }
        });
      });
    }

    const { data: activities, error: actErr } = await supabase
      .from("vessel_activity")
      .select(`
        id, vessel_id, activity_type, geofence_id, start_time, end_time, status,
        vessels (name),
        logbook_entries (id, status)
      `)
      .gte("start_time", startOfDay.toISOString())
      .lte("start_time", endOfDay.toISOString());

    if (actErr) throw actErr;

    if (!activities || activities.length === 0) {
      return new Response(JSON.stringify({ status: "success", processed: 0, message: "No activities found" }), { headers: corsHeaders });
    }

    const pendingActivities = activities.filter((a: any) => {
      if (!a.logbook_entries || a.logbook_entries.length === 0) return true;
      return !a.logbook_entries.some((le: any) => le.status === "submitted" || le.status === "approved");
    });

    if (pendingActivities.length === 0) {
      return new Response(JSON.stringify({ status: "success", processed: 0, message: "All activities already submitted" }), { headers: corsHeaders });
    }

    const { data: dailyMessages } = await supabase
      .from("whatsapp_messages")
      .select("group_name, sender, message_text, timestamp")
      .gte("timestamp", startOfDay.toISOString())
      .lte("timestamp", endOfDay.toISOString())
      .order("timestamp", { ascending: true });

    if (!dailyMessages || dailyMessages.length === 0) {
      return new Response(JSON.stringify({ status: "success", processed: 0, message: "No whatsapp messages for date" }), { headers: corsHeaders });
    }

    let processedCount = 0;

    for (const act of pendingActivities) {
      const vesselName = act.vessels?.name;
      if (!vesselName) continue;

      const relevantGroups = vesselGroupMap[vesselName] || vesselGroupMap[vesselName.toUpperCase()] || [];
      const relevantMessages = dailyMessages.filter((m: any) => relevantGroups.length === 0 || relevantGroups.includes(m.group_name));

      if (relevantMessages.length === 0) continue;

      console.log(`   🧠 Elaborazione AI per [${vesselName}] - ${act.activity_type} (${relevantMessages.length} msg da gruppi ${relevantGroups.join(", ")})...`);

      const chatTranscript = relevantMessages.map((m: any) => `[${m.timestamp}] ${m.group_name} - ${m.sender}: ${m.message_text}`).join("\n");
      const userPrompt = `Nave: ${vesselName}\nOperazione: ${act.activity_type}\nInizio: ${act.start_time}\nFine: ${act.end_time || "in corso"}\n\nCHAT WHATSAPP:\n${chatTranscript}`;

      const aiData = await queryGemini(userPrompt, geminiApiKey);
      if (!aiData) continue;

      let logbookEntryId = act.logbook_entries?.[0]?.id;
      const structuredFields = {
        actual_cargo_tonnes: aiData.actual_cargo_tonnes || null,
        actual_bunker_tonnes: aiData.actual_bunker_tonnes || null,
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
        narrative_text: aiData.narrative_notes || "Compilato automaticamente da GeoKanban AI Auto-Pilot",
        structured_fields: structuredFields,
        submitted_at: new Date().toISOString(),
        submitted_by_name: "GeoKanban AI Crew",
        submitted_by_title: "AI Crew Engine"
      };

      if (logbookEntryId) {
        await supabase.from("logbook_entries").update(entryPayload).eq("id", logbookEntryId);
      } else {
        const { data: newEntry } = await supabase.from("logbook_entries").insert(entryPayload).select("id").single();
        if (newEntry) logbookEntryId = newEntry.id;
      }

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
              end_time: svc.end_time || act.end_time || act.start_time,
              notes: "Estratto da GeoKanban AI Auto-Pilot"
            });
          }
        }
      }

      console.log(`      ✅ Logbook per attività ${act.id} sottomesso con successo da AI Auto-Pilot!`);
      processedCount++;
    }

    return new Response(JSON.stringify({ status: "success", processed: processedCount }), { headers: corsHeaders });
  } catch (error: any) {
    console.error("❌ Errore Edge Function geokanban-ai-logbook:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});

async function queryGemini(prompt: string, apiKey: string): Promise<any | null> {
  const modelsToTry = [
    "gemini-2.5-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro"
  ];

  for (const modelName of modelsToTry) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        })
      });

      if (!res.ok) continue;

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const cleanJson = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      return JSON.parse(cleanJson);
    } catch (_err) {
      continue;
    }
  }

  return null;
}

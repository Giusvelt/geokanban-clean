import urllib.request
import json
import os
import time
import dotenv
from datetime import datetime, timezone
from supabase import create_client

# 1. Caricamento Credenziali
dotenv.load_dotenv('.env.local')
supabase_url = os.environ.get('VITE_SUPABASE_URL')
service_role_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
gemini_api_key = os.environ.get('VITE_GEMINI_API_KEY') or os.environ.get('GEMINI_API_KEY')

if not supabase_url or not service_role_key or not gemini_api_key:
    print("CREDENZIALI MANCANTI in .env.local")
    exit(1)

supabase = create_client(supabase_url, service_role_key)

SYSTEM_AI_CREW_ID = "00000000-0000-0000-0000-000000000000"
PILOT_ID = "fb7e1193-eb4c-4dbf-a74c-330cc7a10a1e"
MOORING_ID = "0accb070-55ec-4f33-9e70-43701950872d"
TUG_ID = "d9a81b19-98a7-46be-bd10-07777b36eb1f"

SYSTEM_INSTRUCTION = """
Sei GeoKanban AI Crew, l'Agente Marittimo Passpartout autonomo di cantiere e della flotta.
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
    {
      "service_type": "PILOT",
      "start_time": "2026-07-28T10:15:00Z",
      "end_time": "2026-07-28T10:45:00Z",
      "quantity": 1,
      "notes": "Pilota a bordo e sbarco"
    }
  ],
  "ai_confidence": "HIGH"
}
"""

def run_passpartout_agent():
    print("\n=============================================================")
    print("[GEOKANBAN AI CREW PASSPARTOUT AGENT] ESECUZIONE ATTIVA")
    print("=============================================================\n")

    res = supabase.from_("vessel_activity").select(
        "id, vessel_id, activity_type, start_time, end_time, status, vessels(name), logbook_entries(id, status)"
    ).order("start_time", desc=True).limit(20).execute()

    activities = res.data or []
    pending = [
        a for a in activities 
        if not a.get("logbook_entries") or len(a["logbook_entries"]) == 0 or not any(le.get("status") in ["submitted", "approved"] for le in a["logbook_entries"])
    ]

    print(f"Attivita in sospeso da compilare con GeoKanban AI Crew: {len(pending)}")

    if not pending:
        print("Nessuna attivita in sospeso!")
        return

    wa_res = supabase.from_("whatsapp_messages").select("group_name, sender, message_text, timestamp").order("timestamp", desc=True).limit(300).execute()
    wa_messages = wa_res.data or []

    processed_count = 0
    model_name = "gemini-2.5-flash"

    for act in pending:
        vessel_name = act.get("vessels", {}).get("name")
        if not vessel_name:
            continue

        v_name_clean = vessel_name.upper().strip()
        relevant_msg = [
            m for m in wa_messages 
            if v_name_clean in m.get("message_text", "").upper() or any(w in m.get("message_text", "").upper() for w in v_name_clean.split())
        ]

        if not relevant_msg:
            act_date = act.get("start_time", "")[:10]
            relevant_msg = [m for m in wa_messages if m.get("timestamp", "")[:10] == act_date]

        if not relevant_msg:
            relevant_msg = wa_messages[:10]

        print(f"\n[GEOKANBAN AI CREW] Elaborazione per Motonave: {vessel_name} | Attivita: {act.get('activity_type')} ({len(relevant_msg)} msg)...")

        transcript = "\n".join([f"[{m.get('timestamp')}] {m.get('sender')}: {m.get('message_text')}" for m in relevant_msg[:12]])
        user_prompt = f"Nave: {vessel_name}\nAttività: {act.get('activity_type')}\nStart: {act.get('start_time')}\nEnd: {act.get('end_time') or 'in corso'}\n\nCHAT WHATSAPP PERTINENTI:\n{transcript}"

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_api_key}"
        payload = json.dumps({
            "systemInstruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]},
            "contents": [{"parts": [{"text": user_prompt}]}],
            "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}
        }).encode("utf-8")

        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})

        try:
            with urllib.request.urlopen(req) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                raw_json = res_data["candidates"][0]["content"]["parts"][0]["text"]
                ai_data = json.loads(raw_json)

                structured_fields = {
                    "actual_cargo_tonnes": ai_data.get("actual_cargo_tonnes") or 0,
                    "actual_bunker_tonnes": ai_data.get("actual_bunker_tonnes") or 0,
                    "arrival_tug_count": ai_data.get("arrival_tug_count") or 0,
                    "departure_tug_count": ai_data.get("departure_tug_count") or 0,
                    "ai_confidence": ai_data.get("ai_confidence") or "HIGH",
                    "auto_submitted": True
                }

                entry_payload = {
                    "vessel_activity_id": act["id"],
                    "vessel_id": act["vessel_id"],
                    "crew_id": SYSTEM_AI_CREW_ID,
                    "status": "submitted",
                    "narrative_text": ai_data.get("narrative_notes") or f"Logbook compilato e sottomesso da GeoKanban AI Crew per {vessel_name}",
                    "structured_fields": structured_fields,
                    "submitted_at": datetime.now(timezone.utc).isoformat(),
                    "submitted_by_name": "GeoKanban AI Crew",
                    "submitted_by_title": "AI Crew Passpartout Engine"
                }

                logbook_entry_id = act.get("logbook_entries", [{}])[0].get("id") if act.get("logbook_entries") else None

                if logbook_entry_id:
                    supabase.from_("logbook_entries").update(entry_payload).eq("id", logbook_entry_id).execute()
                else:
                    ins = supabase.from_("logbook_entries").insert(entry_payload).execute()
                    if ins.data:
                        logbook_entry_id = ins.data[0]["id"]

                # Servizi nautici
                if logbook_entry_id and ai_data.get("services"):
                    supabase.from_("logbook_services").delete().eq("logbook_entry_id", logbook_entry_id).execute()
                    for svc in ai_data["services"]:
                        s_type = svc.get("service_type")
                        s_id = PILOT_ID if s_type == "PILOT" else MOORING_ID if s_type == "MOORING" else TUG_ID if s_type == "TUG" else None
                        if s_id:
                            supabase.from_("logbook_services").insert({
                                "logbook_entry_id": logbook_entry_id,
                                "service_id": s_id,
                                "quantity": svc.get("quantity") or 1,
                                "start_time": svc.get("start_time") or act.get("start_time"),
                                "end_time": svc.get("end_time") or act.get("start_time"),
                                "notes": svc.get("notes") or "Estratto da GeoKanban AI Crew"
                            }).execute()

                print(f"   [SOTTOMESSO DA GEOKANBAN AI CREW] Logbook per {vessel_name} (ID: {act['id']}) | Cargo: {structured_fields['actual_cargo_tonnes']} t")
                processed_count += 1
                time.sleep(3) # Pausa di 3 secondi per rate-limiting Gemini 2.5 Flash

        except Exception as e:
            print(f"Errore durante l'elaborazione AI per {vessel_name}: {e}")
            time.sleep(3)
            continue

    print(f"\n[COMPLETATO] Totale Logbook compilati e sottomessi da GeoKanban AI Crew: {processed_count}\n")

if __name__ == "__main__":
    run_passpartout_agent()

import os
import sys
import json
import time
import requests
import dotenv
from datetime import datetime, timedelta, timezone
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')
dotenv.load_dotenv('.env.local')

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
DEEPSEEK_API_KEY = os.getenv("VITE_DEEPSEEK_API_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ CREDENZIALI SUPABASE MANCANTI!")
    sys.exit(1)

if not DEEPSEEK_API_KEY:
    print("❌ VITE_DEEPSEEK_API_KEY MANCANTE!")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

SYSTEM_PROMPT_PASSARTOUT = """
Sei il SENIOR LOGBOOK ENGINEER DELL'AI CREW GEOKANBAN.
Il tuo compito è analizzare i messaggi reali scambiati sui gruppi WhatsApp di cantiere relativi ad un'attività navale e compilare il DIARIO DI BORDO UFFICIALE (LOGBOOK SUBMITTED).

Le colonne da estrarre ed inferire rigorosamente a DIZIONARIO CHIUSO sono:
- pilot_in: Ora di chiamata o arrivo pilota (formato ISO 8601 UTC stringa, oppure null se non citato)
- pilot_out: Ora di sbarco pilota (formato ISO 8601 UTC stringa, oppure null se non citato)
- mooring_in: Ora inizio ormeggio / primo cavo (formato ISO 8601 UTC stringa, oppure null se non citato)
- mooring_out: Ora fine ormeggio / nave assicurata (formato ISO 8601 UTC stringa, oppure null se non citato)
- tug_in: Ora arrivo rimorchiatori / cavi collegati (formato ISO 8601 UTC stringa, oppure null se non citato)
- tug_out: Ora congedo rimorchiatori / cavi mollati (formato ISO 8601 UTC stringa, oppure null se non citato)
- tug_count: Numero di rimorchiatori utilizzati (numero intero >= 0, oppure null se non citato)
- actual_cargo_tonnes: Tonnellaggio effettivo scaricato o caricato a bordo (numero intero >= 0, oppure null se non citato)
- actual_bunker_tonnes: Tonnellaggio bunkeraggio (numero intero >= 0, oppure null se non citato)
- narrative_notes: Nota sintetico-operativa esplicita del cantiere (max 150 caratteri, oppure null se nessuna nota citata nelle chat)

🚨 REGOLE DI PRIVACY E DETERMINISMO:
1. NON inventare orari o pesi non citati esplicitamente nelle chat.
2. NON citare MAI nomi di persone fisiche, numeri di telefono o mittenti.
3. Rispondi TASSATIVAMENTE ed ESCLUSIVAMENTE con un oggetto JSON valido privo di formattazione markdown extra:
{
  "pilot_in": "ISO_STRING or null",
  "pilot_out": "ISO_STRING or null",
  "mooring_in": "ISO_STRING or null",
  "mooring_out": "ISO_STRING or null",
  "tug_in": "ISO_STRING or null",
  "tug_out": "ISO_STRING or null",
  "tug_count": null,
  "actual_cargo_tonnes": null,
  "actual_bunker_tonnes": null,
  "narrative_notes": "Sintesi operativa cantiere"
}
"""

def extract_logbook_with_deepseek(activity_info, messages):
    context_text = "\n".join([f"[{m.get('timestamp')}] {m.get('message_text')}" for m in messages])
    
    prompt = f"""
--- DETTAGLIO ATTIVITÀ NAVALE ---
Motonave: {activity_info.get('vessel_name')}
Tipo Operazione: {activity_info.get('activity_type')}
Geofence/Sito: {activity_info.get('geofence_name')}
ATA (Ora Arrivo): {activity_info.get('start_time')}
ATD (Ora Partenza): {activity_info.get('end_time')}

--- MESSAGGI WHATSAPP DI CANTIERE (FINESTRA 48H) ---
{context_text if context_text.strip() else 'Nessun messaggio WhatsApp specifico trovato per questa finestra.'}
"""

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
    }

    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT_PASSARTOUT},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1
    }

    try:
        res = requests.post("https://api.deepseek.com/chat/completions", headers=headers, json=payload, timeout=30)
        if res.status_code == 200:
            content = res.json()["choices"][0]["message"]["content"].strip()
            # Pulisci eventuali tag markdown backticks
            if content.startswith("```json"):
                content = content[7:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()
            return json.loads(content)
    except Exception as err:
        print(f"⚠️ Errore estrazione DeepSeek: {err}")
    
    return {
        "pilot_in": None, "pilot_out": None,
        "mooring_in": None, "mooring_out": None,
        "tug_in": None, "tug_out": None, "tug_count": None,
        "actual_cargo_tonnes": None, "actual_bunker_tonnes": None,
        "narrative_notes": None
    }

def run_july_logbook_bonifica():
    print("============================================================")
    print("🧹 INIZIO BONIFICA & INGESTIONE LOGBOOK LUGLIO 2026 (48H REASONING)")
    print("============================================================\n")

    # 1. Recupera le attività del mese di Luglio 2026
    start_july = "2026-07-01T00:00:00Z"
    # Cutoff rigido 48h: processa esclusivamente attività concluse da almeno 48 ore
    cutoff_48h = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
    end_july = cutoff_48h

    res_act = sb.table('vessel_activity') \
        .select('id, vessel_id, activity_type, start_time, end_time, ais_start_draught, ais_end_draught, vessels(name), geofences!vessel_activity_geofence_id_fkey(name)') \
        .gte('start_time', start_july) \
        .lte('start_time', end_july) \
        .order('start_time', desc=False) \
        .execute()

    activities = res_act.data or []
    print(f"📦 Trovate {len(activities)} attività navali per il mese di Luglio 2026.")

    success_count = 0

    for idx, act in enumerate(activities, 1):
        vessel_name = act.get('vessels', {}).get('name', 'N/A') if act.get('vessels') else 'N/A'
        geofence_name = act.get('geofences', {}).get('name', 'N/A') if act.get('geofences') else 'N/A'
        
        start_t = act.get('start_time')
        end_t = act.get('end_time') or start_t

        # Finestra contesto WhatsApp (-24h dall'inizio e +48h dalla fine)
        t_start_dt = datetime.fromisoformat(start_t.replace('Z', '+00:00')) - timedelta(hours=24)
        t_end_dt = datetime.fromisoformat(end_t.replace('Z', '+00:00')) + timedelta(hours=48)

        # Cerca messaggi WhatsApp reali nella finestra
        res_wa = sb.table('whatsapp_messages') \
            .select('group_name, sender, message_text, timestamp') \
            .gte('timestamp', t_start_dt.isoformat()) \
            .lte('timestamp', t_end_dt.isoformat()) \
            .limit(50) \
            .execute()

        wa_msgs = res_wa.data or []

        act_info = {
            "vessel_name": vessel_name,
            "activity_type": act.get('activity_type'),
            "geofence_name": geofence_name,
            "start_time": start_t,
            "end_time": end_t
        }

        extracted = extract_logbook_with_deepseek(act_info, wa_msgs)

        structured_fields = {
            "actual_cargo_tonnes": extracted.get("actual_cargo_tonnes"),
            "actual_bunker_tonnes": extracted.get("actual_bunker_tonnes"),
            "pilot_in": extracted.get("pilot_in"),
            "pilot_out": extracted.get("pilot_out"),
            "mooring_in": extracted.get("mooring_in"),
            "mooring_out": extracted.get("mooring_out"),
            "tug_in": extracted.get("tug_in"),
            "tug_out": extracted.get("tug_out"),
            "tug_count": extracted.get("tug_count")
        }

        # Controlla se esiste già un logbook per questa attività
        res_check = sb.table('logbook_entries').select('id').eq('vessel_activity_id', act['id']).execute()
        existing = res_check.data

        entry_payload = {
            "vessel_id": act.get('vessel_id'),
            "vessel_activity_id": act['id'],
            "crew_id": "00000000-0000-0000-0000-000000000000",
            "narrative_text": extracted.get("narrative_notes"),
            "structured_fields": structured_fields,
            "status": "submitted",
            "submitted_at": datetime.utcnow().isoformat() + "Z",
            "submitted_by_name": "GeoKanban AI Crew",
            "submitted_by_title": "Senior Logbook Engineer",
            "version": 1
        }

        if existing and len(existing) > 0:
            sb.table('logbook_entries').update(entry_payload).eq('id', existing[0]['id']).execute()
        else:
            sb.table('logbook_entries').insert(entry_payload).execute()

        print(f"[{idx}/{len(activities)}] ✅ Logbook bonificato | {vessel_name} @ {geofence_name} ({act.get('activity_type')}) | Carico: {extracted.get('actual_cargo_tonnes')}t")
        success_count += 1
        time.sleep(0.3)

    print("\n============================================================")
    print(f"🎉 BONIFICA LOGBOOK LUGLIO COMPLETATA! {success_count}/{len(activities)} LOGBOOK RICREATI.")
    print("============================================================")

if __name__ == "__main__":
    run_july_logbook_bonifica()

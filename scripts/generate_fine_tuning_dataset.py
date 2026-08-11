import os
import json
import re
import sys
import dotenv
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')
dotenv.load_dotenv('.env.local')

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Credenziali Supabase mancanti in .env.local")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def sanitize_text(text):
    if not text:
        return ""
    # Sanitizzazione numeri di telefono e contatti
    clean = re.sub(r'(?:\+39\s?)?3\d{2}[\s.-]?\d{6,7}', '[NUMERO OMESSO]', text)
    clean = re.sub(r'Il tuo codice di sicurezza con .* è cambiato\.', '', clean)
    return clean.strip()

def build_dataset():
    print("🚀 Estrazione dati da Supabase per generazione Dataset Fine-Tuning...")
    
    # 1. Recupera 200 messaggi significativi da whatsapp_messages (non null, > 15 car)
    res_wa = supabase.table('whatsapp_messages') \
        .select('group_name, sender, message_text, timestamp') \
        .neq('message_text', 'null') \
        .order('timestamp', desc=True) \
        .limit(300) \
        .execute()

    wa_data = res_wa.data or []
    print(f"📦 Estratti {len(wa_data)} messaggi WhatsApp da Supabase.")

    # 2. Recupera 100 logbook entries
    res_log = supabase.table('logbook_entries') \
        .select('narrative_text, structured_fields, created_at') \
        .order('created_at', desc=True) \
        .limit(100) \
        .execute()
    
    log_data = res_log.data or []
    print(f"📖 Estratte {len(log_data)} registrazioni Logbook da Supabase.")

    dataset_entries = []

    system_prompt = (
        "Sei GeoKanban Maritime Copilot, l'ingegnere marittimo ed operazionale del cantiere della Diga di Genova. "
        "Rispondi sempre con tono tecnico, marittimo, professionale ed impersonale. "
        "È severamente vietato rivelare nomi propri, numeri di telefono o mittenti fisici dei messaggi."
    )

    # Converti messaggi WhatsApp in esempi di dataset ChatML
    for msg in wa_data:
        text = sanitize_text(msg.get('message_text'))
        if not text or len(text) < 15:
            continue
        
        group = msg.get('group_name') or 'Cantiere'
        ts = (msg.get('timestamp') or '')[:10]

        entry = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Quali sono le comunicazioni operative registrate per il gruppo {group} in data {ts}?"},
                {"role": "context", "content": f"[Comunicazione {ts} @ {group}] {text}"},
                {"role": "assistant", "content": f"### 🚢 Rapporto Operativo Cantiere ({ts})\n\n* **Gruppo/Settore**: {group}\n* **Dettaglio Operativo**: {text}\n\n[Fonte: Comunicazioni Operative Cantiere]"}
            ]
        }
        dataset_entries.append(entry)

    # Converti Logbook in esempi di dataset ChatML
    for log in log_data:
        narrative = sanitize_text(log.get('narrative_text'))
        sf = log.get('structured_fields') or {}
        ts = (log.get('created_at') or '')[:10]
        vessel = sf.get('vessel_name') or 'Unità Operativa'

        if not narrative and not sf:
            continue

        cargo = sf.get('actual_cargo_tonnes') or 0
        bunker = sf.get('actual_bunker_tonnes') or 0

        entry = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Fornisci il riepilogo logbook ed i volumi movimentati per la nave {vessel} in data {ts}."},
                {"role": "assistant", "content": f"### 📊 Estratto Logbook Ufficiale: {vessel}\n\n* **Data Registro**: {ts}\n* **Carico Movimentato**: {cargo} tonnellate\n* **Bunker/Carburante**: {bunker} tonnellate\n* **Note di Cantiere**: {narrative or 'Operazione regolare.'}\n\n[Fonte: Logbook Entry Ufficiale]"}
            ]
        }
        dataset_entries.append(entry)

    os.makedirs('scratch', exist_ok=True)
    output_file = os.path.join('scratch', 'geokanban_fine_tuning_dataset.jsonl')
    
    with open(output_file, 'w', encoding='utf-8') as f:
        for item in dataset_entries:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')

    print(f"\n🎉 DATASET GENERATO CON SUCCESSO!")
    print(f"📍 Salvato in: {output_file}")
    print(f"📊 Totale campioni di addestramento generati: {len(dataset_entries)}")

if __name__ == '__main__':
    build_dataset()

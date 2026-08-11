import os
import sys
import dotenv
import json
import pandas as pd
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')
dotenv.load_dotenv('.env.local')

url = os.environ.get('VITE_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
sb = create_client(url, key)

print("[INFO] Estraggo tutti i messaggi PROGRAMMA e CONSUNTIVO dal gruppo Diga Team...")

res = sb.table('whatsapp_messages') \
    .select('id, sender, message_text, timestamp') \
    .ilike('group_name', '%diga%') \
    .order('timestamp', desc=False) \
    .execute()

messages = res.data or []
print(f"[INFO] Analisi di {len(messages)} messaggi...")

programmi = []
consuntivi = []

for m in messages:
    txt = m.get('message_text', '')
    txt_upper = txt.upper()
    ts = m.get('timestamp', '')[:10]
    sender = m.get('sender', 'N/A')
    
    if 'PROGRAMMA' in txt_upper:
        programmi.append({'date': ts, 'sender': sender, 'text': txt})
    elif 'CONSUNTIVO' in txt_upper or 'ATTIVITÀ' in txt_upper and ('VERSATO' in txt_upper or 'SALPATI' in txt_upper or 'RICOLLOCATI' in txt_upper):
        consuntivi.append({'date': ts, 'sender': sender, 'text': txt})

print(f"[INFO] Trovati {len(programmi)} messaggi PROGRAMMA e {len(consuntivi)} messaggi CONSUNTIVO.")

# Salva un report grezzo per ispezione
with open(r"scratch\extracted_programmi_consuntivi.json", "w", encoding="utf-8") as f:
    json.dump({'programmi': programmi, 'consuntivi': consuntivi}, f, indent=2, ensure_ascii=False)

print("[SUCCESS] Dati estratti salvati in scratch/extracted_programmi_consuntivi.json")

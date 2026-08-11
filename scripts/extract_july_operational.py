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

print("[INFO] Analisi approfondita di TUTTI i messaggi di Luglio 2026 per estrarre PROGRAMMI e CONSUNTIVI...")

res = sb.table('whatsapp_messages') \
    .select('id, sender, message_text, timestamp') \
    .ilike('group_name', '%diga%') \
    .gte('timestamp', '2026-07-01T00:00:00Z') \
    .order('timestamp', desc=False) \
    .execute()

msgs = res.data or []
print(f"[INFO] Trovati {len(msgs)} messaggi in totale nel mese di Luglio 2026.")

extracted = []

for m in msgs:
    txt = m.get('message_text', '')
    ts = m.get('timestamp', '')
    sender = m.get('sender', '')
    
    # Criteri di ricerca per Programmi e Consuntivi
    if any(k in txt.upper() for k in ['PROGRAMMA', 'CONSUNTIVO', 'RILIEVI', 'ATTIVITÀ', 'VERSATO', 'COMMESSA']):
        extracted.append({
            'timestamp': ts,
            'sender': sender,
            'text': txt
        })

print(f"[INFO] Estratti {len(extracted)} messaggi operativi rilevanti.")

with open(r"scratch\jul_2026_operational_messages.json", "w", encoding="utf-8") as f:
    json.dump(extracted, f, indent=2, ensure_ascii=False)

for item in extracted:
    print(f"=== [{item['timestamp']}] {item['sender']} ===")
    print(item['text'])
    print("-" * 60)

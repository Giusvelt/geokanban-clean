import os
import re
import sys
import dotenv
import json
from datetime import datetime, timezone
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')
dotenv.load_dotenv('.env.local')

url = os.environ.get('VITE_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
sb = create_client(url, key)

file_path = r"c:\Users\giuse\Desktop\ANTIGRAVITY\HANDOVER_GEOKANBAN\scratch\wapp_chat_export\WhatsApp Chat - Diga Team 29_07_17-\_chat.txt"

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"[INFO] Totale righe lette nel file esportato: {len(lines)}")

# Data inizio ultima settimana (22 Luglio 2026 00:00:00 UTC)
# WhatsApp export format: [29/07/26, 17:34:12] Nome: Messaggio
export_messages = []
pattern = re.compile(r'^\[(\d{2}/\d{2}/\d{2}),?\s+(\d{2}:\d{2}:\d{2})\]\s+([^:]+):\s+(.*)$')

current_msg = None

for line in lines:
    match = pattern.match(line)
    if match:
        if current_msg:
            export_messages.append(current_msg)
        date_str, time_str, sender, text = match.groups()
        # Converte 29/07/26 in YYYY-MM-DD
        day, month, year = date_str.split('/')
        full_year = f"20{year}"
        dt_iso = f"{full_year}-{month}-{day}T{time_str}Z"
        current_msg = {
            'dt_iso': dt_iso,
            'day_str': f"{full_year}-{month}-{day}",
            'sender': sender.strip(),
            'text': text.strip()
        }
    else:
        if current_msg:
            current_msg['text'] += "\n" + line.strip()

if current_msg:
    export_messages.append(current_msg)

# Filtra solo l'ultima settimana (dal 22 Luglio 2026 al 29 Luglio 2026 inclusi)
last_week_export = [m for m in export_messages if m['day_str'] >= '2026-07-22']

print(f"[INFO] Totale messaggi trovati nel FILE ESPORTATO per l'ultima settimana (22-29 Luglio): {len(last_week_export)}")

# Recupera dal DB Supabase tutti i messaggi del gruppo "Diga Team" dal 22 Luglio 2026
db_res = sb.table('whatsapp_messages') \
    .select('id, sender, message_text, timestamp') \
    .ilike('group_name', '%diga%') \
    .gte('timestamp', '2026-07-22T00:00:00Z') \
    .execute()

db_messages = db_res.data or []
print(f"[INFO] Totale messaggi trovati su SUPABASE DB per 'Diga Team' nell'ultima settimana: {len(db_messages)}")

# Calcolo differenza esatta (No Bullshit)
missing_count = len(last_week_export) - len(db_messages)

print("\n============================================================")
print(f"ANALISI RIGOROSA E CONFRONTO ESATTO:")
print(f"- Messaggi su File WhatsApp Export (22-29 Luglio): {len(last_week_export)}")
print(f"- Messaggi presenti su Supabase DB (22-29 Luglio): {len(db_messages)}")
print(f"- MESSAGGI MANCANTI SUL DATABASE SUPABASE: {missing_count}")
print("============================================================")

if last_week_export and len(db_messages) < len(last_week_export):
    print("\nUltimi 5 messaggi del FILE ESPORTATO (Oggi 29 Luglio):")
    for m in last_week_export[-5:]:
        print(f"[{m['dt_iso']}] {m['sender']}: {m['text'][:80]}...")

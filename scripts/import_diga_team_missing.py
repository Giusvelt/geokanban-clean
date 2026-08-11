import os
import re
import sys
import dotenv
from supabase import create_client
from sentence_transformers import SentenceTransformer

sys.stdout.reconfigure(encoding='utf-8')
dotenv.load_dotenv('.env.local')

url = os.environ.get('VITE_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
sb = create_client(url, key)

file_path = r"c:\Users\giuse\Desktop\ANTIGRAVITY\HANDOVER_GEOKANBAN\scratch\wapp_chat_export\WhatsApp Chat - Diga Team 29_07_17-\_chat.txt"

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print("[INFO] Analisi ed estrazione messaggi da file export...")

export_messages = []
pattern = re.compile(r'^\[(\d{2}/\d{2}/\d{2}),?\s+(\d{2}:\d{2}:\d{2})\]\s+([^:]+):\s+(.*)$')
current_msg = None

for line in lines:
    match = pattern.match(line)
    if match:
        if current_msg:
            export_messages.append(current_msg)
        date_str, time_str, sender, text = match.groups()
        day, month, year = date_str.split('/')
        full_year = f"20{year}"
        dt_iso = f"{full_year}-{month}-{day}T{time_str}+00:00"
        current_msg = {
            'dt_iso': dt_iso,
            'day_str': f"{full_year}-{month}-{day}",
            'group_name': 'Diga Team',
            'sender': sender.strip(),
            'message_text': text.strip()
        }
    else:
        if current_msg:
            current_msg['message_text'] += "\n" + line.strip()

if current_msg:
    export_messages.append(current_msg)

# Seleziona dal 22 Luglio 2026 in poi
last_week_msgs = [m for m in export_messages if m['day_str'] >= '2026-07-22']

print(f"[INFO] Caricamento modello vettoriale all-mpnet-base-v2...")
model = SentenceTransformer('all-mpnet-base-v2')

inserted_count = 0
vectorized_count = 0

for m in last_week_msgs:
    # Controlla se il messaggio esiste già su Supabase per timestamp e testo identici
    check_res = sb.table('whatsapp_messages') \
        .select('id, embedding') \
        .ilike('group_name', '%diga%') \
        .eq('timestamp', m['dt_iso']) \
        .execute()
    
    if not check_res.data:
        # Calcola embedding 768d
        text_to_embed = f"[{m['group_name']}] {m['sender']}: {m['message_text']}"
        emb = model.encode(text_to_embed).tolist()
        
        insert_data = {
            'group_name': m['group_name'],
            'sender': m['sender'],
            'message_text': m['message_text'],
            'timestamp': m['dt_iso'],
            'is_processed': True,
            'embedding': emb
        }
        
        ins_res = sb.table('whatsapp_messages').insert(insert_data).execute()
        if ins_res.data:
            inserted_count += 1
            vectorized_count += 1

print("\n============================================================")
print(f"[SUCCESS] SINCRONIZZAZIONE ED INGGESTIONE COMPLETATA!")
print(f"- Nuovi messaggi inseriti e vettorializzati su Supabase: {inserted_count}")
print("============================================================")

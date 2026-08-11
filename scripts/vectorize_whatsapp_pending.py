import os
import sys
import dotenv
from supabase import create_client
from sentence_transformers import SentenceTransformer

sys.stdout.reconfigure(encoding='utf-8')
dotenv.load_dotenv('.env.local')

url = os.environ.get('VITE_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
sb = create_client(url, key)

print("[INFO] Caricamento modello embedding (all-mpnet-base-v2)...")
model = SentenceTransformer('all-mpnet-base-v2')

res = sb.table('whatsapp_messages').select('id, group_name, sender, message_text').is_('embedding', 'null').execute()
pending_messages = res.data or []

print(f"[INFO] Trovati {len(pending_messages)} messaggi WhatsApp non vettorializzati.")

for idx, m in enumerate(pending_messages, 1):
    text_to_embed = f"[{m.get('group_name')}] {m.get('sender')}: {m.get('message_text')}"
    embedding_vector = model.encode(text_to_embed).tolist()
    
    sb.table('whatsapp_messages').update({'embedding': embedding_vector}).eq('id', m['id']).execute()
    print(f"[{idx}/{len(pending_messages)}] Vettorializzato messaggio ID: {m['id']} ({m.get('group_name')})")

print("============================================================")
print("[SUCCESS] VETTORIALIZZAZIONE MESSAGGI WHATSAPP COMPLETATA AL 100%!")
print("============================================================")

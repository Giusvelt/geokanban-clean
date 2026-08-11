import os
import dotenv
import sys
import json
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')
dotenv.load_dotenv('.env.local')

url = os.environ.get('VITE_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
sb = create_client(url, key)

print("=== VERIFICA ESECUZIONI GEOKANBAN-NIGHTLY-HEALER ===")
try:
    res = sb.table('healer_logs').select('*').order('created_at', desc=True).limit(10).execute()
    print(f"Log trovati in healer_logs: {len(res.data)}")
    for l in res.data:
        print(f"📅 {l.get('created_at')} | {l.get('healer_run_id')} | Status: {l.get('status')} | Details: {json.dumps(l.get('details'))[:150]}")
except Exception as e:
    print(f"⚠️ Tabella healer_logs non direttamente accessibile o vuota: {e}")

print("\n=== VERIFICA CRONJOB SUPABASE HTTP / EDGE FUNCTIONS ===")
try:
    res2 = sb.table('whatsapp_messages').select('timestamp').order('timestamp', desc=True).limit(1).execute()
    print(f"Ultimo messaggio DB: {res2.data[0]['timestamp'] if res2.data else 'N/A'}")
except Exception as e:
    print(f"Error: {e}")

import os
import dotenv
import sys
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')
dotenv.load_dotenv('.env.local')

url = os.environ.get('VITE_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
sb = create_client(url, key)

res = sb.table('whatsapp_messages') \
    .select('timestamp, message_text') \
    .ilike('group_name', '%diga%') \
    .gte('timestamp', '2026-07-01T00:00:00Z') \
    .lte('timestamp', '2026-07-15T23:59:59Z') \
    .ilike('message_text', '%CONSUNTIVO%') \
    .execute()

print(f"Trovati {len(res.data)} messaggi di CONSUNTIVO tra il 1 e il 15 Luglio nel DB Supabase:")
for m in res.data:
    print(f"=== {m['timestamp']} ===")
    print(m['message_text'][:400])
    print("-" * 50)

import os
import dotenv
import sys
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')
dotenv.load_dotenv('.env.local')

url = os.environ.get('VITE_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
sb = create_client(url, key)

print("🚀 Resetting next_fetch_at to current time for all active vessels...")
res = sb.table('vessels').update({'next_fetch_at': '2026-07-29T20:00:00Z'}).neq('id', '00000000-0000-0000-0000-000000000000').execute()
print(f"Updated {len(res.data or [])} vessels next_fetch_at.")

import os
import dotenv
import sys
import json
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')
dotenv.load_dotenv('.env.local')

url = os.environ.get('VITE_SUPABASE_URL') + '/functions/v1/geokanban-tracker?force=true'
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

print(f"🚀 Invocazione diretta Edge Function geokanban-tracker: {url}")
req = urllib.request.Request(url, headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})

try:
    with urllib.request.urlopen(req, timeout=45) as resp:
        print("✅ RISPOSTA EDGE FUNCTION:")
        print(json.dumps(json.loads(resp.read().decode('utf-8')), indent=2))
except Exception as e:
    print(f"❌ Errore: {e}")

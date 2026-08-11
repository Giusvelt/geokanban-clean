import os
import dotenv
import sys
import json
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')
dotenv.load_dotenv('.env.local')

url = os.environ.get('VITE_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

print("--- RECENT GEOFENCE EVENTS (ANY TIMESTAMP) ---")
req = urllib.request.Request(f"{url}/rest/v1/geofence_events?order=timestamp.desc&limit=10", headers={'apikey': key, 'Authorization': f'Bearer {key}'})
with urllib.request.urlopen(req) as resp:
    evs = json.loads(resp.read().decode('utf-8'))
    for e in evs:
        print(f"  - [{e.get('timestamp')}] Vessel: {e.get('vessel_id')} | Event: {e.get('event_type')}")

print("\n--- RECENT VESSEL TRACKING (ANY TIMESTAMP) ---")
req2 = urllib.request.Request(f"{url}/rest/v1/vessel_tracking?order=timestamp.desc&limit=10", headers={'apikey': key, 'Authorization': f'Bearer {key}'})
with urllib.request.urlopen(req2) as resp:
    tr = json.loads(resp.read().decode('utf-8'))
    for t in tr:
        print(f"  - [{t.get('timestamp')}] MMSI: {t.get('mmsi')} | Speed: {t.get('speed')} kn")

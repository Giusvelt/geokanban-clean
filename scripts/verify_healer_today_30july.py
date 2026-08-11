import os
import dotenv
import sys
import json
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')
dotenv.load_dotenv('.env.local')

url = os.environ.get('VITE_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

print("==================================================================")
print("🔍 VERIFICA RIGOROSA ESECUZIONE NIGHTLY HEALER — OGGI 30 LUGLIO 2026")
print("==================================================================")

# Finestra 07:00 - 09:00 IT del 30 Luglio (05:00 - 07:00 UTC)
start_utc = "2026-07-30T05:00:00Z"
end_utc = "2026-07-30T07:00:00Z"

# 1. Verifica eventi Geofence sanati/registrati stamattina
print("\n--- 1. EVENTI GEOFENCE PROCESSATI STAMATTINA (07:00 - 09:00 IT) ---")
url_events = f"{url}/rest/v1/geofence_events?timestamp=gte.{start_utc}&timestamp=lte.{end_utc}&order=timestamp.desc"
req_events = urllib.request.Request(url_events, headers={'apikey': key, 'Authorization': f'Bearer {key}'})

try:
    with urllib.request.urlopen(req_events) as resp:
        events = json.loads(resp.read().decode('utf-8'))
        print(f"Eventi trovati tra 07:00 e 09:00 IT: {len(events)}")
        for e in events:
            print(f"  - [{e.get('timestamp')}] Vessel ID: {e.get('vessel_id')} | Event: {e.get('event_type')} | Speed: {e.get('speed')} kn")
except Exception as err:
    print(f"❌ Errore recupero geofence_events: {err}")

# 2. Verifica attività create/sanate con fonte geofence_v8 o open_sea_speed o auto stamattina
print("\n--- 2. ATTIVITÀ AUTOMATICHE CREATE/SANATE STAMATTINA (07:00 - 09:00 IT) ---")
url_act = f"{url}/rest/v1/vessel_activity?created_at=gte.{start_utc}&created_at=lte.{end_utc}&order=created_at.desc"
req_act = urllib.request.Request(url_act, headers={'apikey': key, 'Authorization': f'Bearer {key}'})

try:
    with urllib.request.urlopen(req_act) as resp:
        activities = json.loads(resp.read().decode('utf-8'))
        print(f"Attività create/modificate tra 07:00 e 09:00 IT: {len(activities)}")
        for a in activities:
            print(f"  - ID: {a.get('id')} | Type: {a.get('activity_type')} | Source: {a.get('source')} | Start: {a.get('start_time')} | End: {a.get('end_time')}")
except Exception as err:
    print(f"❌ Errore recupero vessel_activity: {err}")

# 3. Controlliamo se ci sono stati eventi Healer anche nella finestra notturna estesa fino a quest'ora (30 Luglio intero)
print("\n--- 3. ATTIVITÀ AUTOMATICHE TOTALI REGISTRATE OGGI 30 LUGLIO (00:00 - 11:15 IT) ---")
url_today = f"{url}/rest/v1/vessel_activity?created_at=gte.2026-07-29T22:00:00Z&order=created_at.desc&limit=10"
req_today = urllib.request.Request(url_today, headers={'apikey': key, 'Authorization': f'Bearer {key}'})

try:
    with urllib.request.urlopen(req_today) as resp:
        acts_today = json.loads(resp.read().decode('utf-8'))
        print(f"Ultime {len(acts_today)} attività registrate/modificate oggi:")
        for a in acts_today:
            print(f"  - [{a.get('created_at')}] Type: {a.get('activity_type')} | Source: {a.get('source')} | Status: {a.get('status')}")
except Exception as err:
    print(f"❌ Errore query generale oggi: {err}")

print("\n==================================================================")

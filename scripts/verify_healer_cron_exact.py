import os
import dotenv
import sys
import json
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')
dotenv.load_dotenv('.env.local')

url = os.environ.get('VITE_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

print("=== 1. VERIFICA CRONJOB E CHIAMATE HTTP SU SUPABASE ===")
# Verifichiamo se ci sono log di HTTP requests o estrazioni cron nell'infrastruttura Supabase via Postgres pg_cron / net.http_collect
req_cron = urllib.request.Request(
    f"{url}/rest/v1/rpc/get_cron_jobs", 
    headers={'apikey': key, 'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}
)

# Se l'RPC non esiste, interroghiamo direttamente le tabelle di sistema o geofence_events creati stamattina tra le 07:00 e le 09:00
print("\n=== 2. VERIFICA EVENTI SANATI O MODIFICATI STAMATTINA TRA LE 07:00 E LE 09:00 AM ===")
req_events = urllib.request.Request(
    f"{url}/rest/v1/geofence_events?timestamp=gte.2026-07-29T05:00:00Z&timestamp=lte.2026-07-29T08:00:00Z&order=timestamp.desc",
    headers={'apikey': key, 'Authorization': f'Bearer {key}'}
)

try:
    with urllib.request.urlopen(req_events) as resp:
        events = json.loads(resp.read().decode('utf-8'))
        print(f"Eventi registrati stamattina tra 07:00 e 09:00 IT (05:00-07:00 UTC): {len(events)}")
        for e in events:
            print(f"  - [{e.get('timestamp')}] Vessel: {e.get('vessel_id')} | Event: {e.get('event_type')} | Speed: {e.get('speed')}")
except Exception as e:
    print(f"Errore query geofence_events: {e}")

print("\n=== 3. VERIFICA ATTIVITÀ AUTOMATICHE RIGENERATE / HEALED OGGI 29 LUGLIO ===")
req_act = urllib.request.Request(
    f"{url}/rest/v1/vessel_activity?created_at=gte.2026-07-29T05:00:00Z&created_at=lte.2026-07-29T09:00:00Z&order=created_at.desc",
    headers={'apikey': key, 'Authorization': f'Bearer {key}'}
)

try:
    with urllib.request.urlopen(req_act) as resp:
        activities = json.loads(resp.read().decode('utf-8'))
        print(f"Attività create/sanate dal Healer stamattina (07:00-09:00 IT): {len(activities)}")
        for a in activities:
            print(f"  - ID: {a.get('id')} | Type: {a.get('activity_type')} | Start: {a.get('start_time')} | Source: {a.get('source')}")
except Exception as e:
    print(f"Errore query vessel_activity: {e}")

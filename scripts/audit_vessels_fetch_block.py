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
print("🔍 AUDIT CRITICO: STATO DI TRACCIAMENTO LIVE E PROSSIMO FETCH NAVI")
print("==================================================================")

# 1. Recupera tutte le navi attive dal registry con last_fetch e next_fetch_at
req_vessels = urllib.request.Request(
    f"{url}/rest/v1/active_vessels?select=id,name,mmsi,next_fetch_at,is_free_route",
    headers={'apikey': key, 'Authorization': f'Bearer {key}'}
)

with urllib.request.urlopen(req_vessels) as resp:
    vessels = json.loads(resp.read().decode('utf-8'))

print(f"Navi attive analizzate: {len(vessels)}\n")

for v in sorted(vessels, key=lambda x: x['name']):
    # Recupera l'ultimo record assoluto inserito in vessel_tracking
    req_last = urllib.request.Request(
        f"{url}/rest/v1/vessel_tracking?vessel_id=eq.{v['id']}&order=timestamp.desc&limit=1",
        headers={'apikey': key, 'Authorization': f'Bearer {key}'}
    )
    with urllib.request.urlopen(req_last) as r_last:
        tracks = json.loads(r_last.read().decode('utf-8'))
        last_t = tracks[0] if tracks else {}

    last_timestamp = last_t.get('timestamp', 'NESSUN TRACCIAMENTO')
    last_speed = last_t.get('speed', '—')
    last_status = last_t.get('status', '—')
    next_fetch = v.get('next_fetch_at', 'NON IMPOSTATO')
    route_type = "FREE ROUTE" if v.get('is_free_route') else "TRATTA FISSA"

    print(f"🚢 {v['name']:<20} | {route_type:<12}")
    print(f"   - Ultimo Posizionamento DB (Last Fetch): {last_timestamp}")
    print(f"   - Ultima Velocità / Stato:             {last_speed} kn ({last_status})")
    print(f"   - Prossimo Fetch Programmato:            {next_fetch}")
    print("------------------------------------------------------------------")

print("\n==================================================================")

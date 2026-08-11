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
print("🔍 GEOKANBAN VERIFY — AUDIT COMPLETO INTEGRITÀ EDES EDGE FUNCTIONS / DB")
print("==================================================================")

# 1. Verification of active vessels tracking parameters
req_vessels = urllib.request.Request(f"{url}/rest/v1/active_vessels?select=id,name,is_free_route,next_fetch_at", headers={'apikey': key, 'Authorization': f'Bearer {key}'})
with urllib.request.urlopen(req_vessels) as r:
    v_data = json.loads(r.read().decode('utf-8'))
    print(f"\n1. NAVI ATTIVE NEL REGISTRY: {len(v_data)}")
    free_routes = [v['name'] for v in v_data if v.get('is_free_route')]
    fixed_routes = [v['name'] for v in v_data if not v.get('is_free_route')]
    print(f"   - Free Route ({len(free_routes)}): {', '.join(free_routes)}")
    print(f"   - Tratta Fissa ({len(fixed_routes)}): {', '.join(fixed_routes)}")

# 2. Verification of latest live tracking position
req_track = urllib.request.Request(f"{url}/rest/v1/vessel_tracking?order=timestamp.desc&limit=5", headers={'apikey': key, 'Authorization': f'Bearer {key}'})
with urllib.request.urlopen(req_track) as r:
    t_data = json.loads(r.read().decode('utf-8'))
    print(f"\n2. ULTIMI 5 TRACCIAMENTI REGISTRATI SU DATABASE:")
    for t in t_data:
        print(f"   - [{t.get('timestamp')}] MMSI: {t.get('mmsi')} | Lat: {t.get('lat')} | Lon: {t.get('lon')} | Speed: {t.get('speed')} kn")

# 3. Verification of geofence 1-Hit events
req_events = urllib.request.Request(f"{url}/rest/v1/geofence_events?order=timestamp.desc&limit=5", headers={'apikey': key, 'Authorization': f'Bearer {key}'})
with urllib.request.urlopen(req_events) as r:
    e_data = json.loads(r.read().decode('utf-8'))
    print(f"\n3. ULTIMI 5 EVENTI GEOFENCE (ENTER/EXIT):")
    for e in e_data:
        print(f"   - [{e.get('timestamp')}] Vessel: {e.get('vessel_id')} | Event: {e.get('event_type')} | Speed: {e.get('speed')} kn")

# 4. Verification of compliance KPI JSON integrity
with open('src/data/compliance_kpi_data.json', 'r', encoding='utf-8') as f:
    c_data = json.load(f)
    print(f"\n4. DATASET COMPLIANCE KPI JSON: {len(c_data)} giornate registrate")
    july_27 = next((d for d in c_data if d['Data'] == '2026-07-27'), None)
    if july_27:
        print(f"   - Check 27 Luglio: Stato={july_27['Stato Cantiere']} | TER={july_27['Aderenza Programma (TER %)']}% | Deficit={july_27['Deficit Task (TDI)']}")

print("\n==================================================================")
print("✅ AUDIT BACKEND COMPLETO ULTIMATO!")
print("==================================================================")

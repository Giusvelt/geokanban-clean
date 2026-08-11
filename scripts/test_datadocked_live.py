import os
import dotenv
import sys
import json
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')
dotenv.load_dotenv('.env.local')

url = os.environ.get('VITE_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
datadocked_key = os.environ.get('DATADOCKED_API_KEY') or os.environ.get('VITE_DATADOCKED_API_KEY') or ""
print(f"Key DataDocked presente: {bool(datadocked_key)}")
print("==================================================================")
print("📡 TEST DIRETTO DATADOCKED API — MONITORAGGIO AIS LIVE NAVI")
print("==================================================================")

req_vessels = urllib.request.Request(
    f"{url}/rest/v1/active_vessels?select=id,name,mmsi",
    headers={'apikey': key, 'Authorization': f'Bearer {key}'}
)

with urllib.request.urlopen(req_vessels) as resp:
    vessels = json.loads(resp.read().decode('utf-8'))

for v in vessels:
    mmsi = v['mmsi']
    name = v['name']
    dd_url = f"https://datadocked.com/api/vessels_operations/get-vessel-location?imo_or_mmsi={mmsi}"
    req_dd = urllib.request.Request(
        dd_url,
        headers={'X-API-Key': datadocked_key, 'Authorization': f'Bearer {datadocked_key}'}
    )
    try:
        with urllib.request.urlopen(req_dd) as r:
            res_json = json.loads(r.read().decode('utf-8'))
            lat = res_json.get('latitude')
            lon = res_json.get('longitude')
            speed = res_json.get('speed')
            time_rec = res_json.get('positionReceived')
            print(f"🚢 {name:<20} (MMSI: {mmsi}) ➔ Lat: {lat}, Lon: {lon} | Speed: {speed} kn | Timestamp AIS: {time_rec}")
    except Exception as err:
        print(f"❌ {name} (MMSI: {mmsi}): Errore DataDocked: {err}")

print("\n==================================================================")

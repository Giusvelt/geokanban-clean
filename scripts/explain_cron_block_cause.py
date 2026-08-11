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
print("🔍 ANALISI SPIEGATA: CHI ED A CHE ORA HA AGGIORNATO NEXT_FETCH_AT")
print("==================================================================")

# Legge per ogni nave: l'ultimo record in vessel_tracking (orario effettivo di inserimento a DB) ed il next_fetch_at in vessels
req_v = urllib.request.Request(f"{url}/rest/v1/vessels?select=id,name,next_fetch_at,updated_at", headers={'apikey': key, 'Authorization': f'Bearer {key}'})
with urllib.request.urlopen(req_v) as r:
    vessels = json.loads(r.read().decode('utf-8'))

for v in sorted(vessels, key=lambda x: x['name']):
    req_t = urllib.request.Request(f"{url}/rest/v1/vessel_tracking?vessel_id=eq.{v['id']}&order=timestamp.desc&limit=1", headers={'apikey': key, 'Authorization': f'Bearer {key}'})
    with urllib.request.urlopen(req_t) as r_t:
        t_data = json.loads(r_t.read().decode('utf-8'))
        last_t = t_data[0] if t_data else {}
        
    print(f"🚢 {v['name']:<20}:")
    print(f"   - Ultima scrittura a DB (created_at): {last_t.get('created_at', 'N/D')}")
    print(f"   - Timestamp AIS Posizione ricevuta:    {last_t.get('timestamp', 'N/D')}")
    print(f"   - next_fetch_at memorizzato su DB:   {v.get('next_fetch_at')}")
    print("------------------------------------------------------------------")

print("==================================================================")

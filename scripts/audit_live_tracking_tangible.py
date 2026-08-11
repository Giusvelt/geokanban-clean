import os
import dotenv
import sys
import json
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')
dotenv.load_dotenv('.env.local')

url = os.environ.get('VITE_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
sb = create_client(url, key)

print("=== 1. AUDIT ULTIMI POSIZIONAMENTI NAVI (TRACKING LIVE) ===")
vessels = sb.table('vessels').select('id, name, mmsi, next_fetch_at, is_free_route').order('name').execute().data

for v in vessels:
    tracks = sb.table('vessel_tracking') \
        .select('timestamp, lat, lon, speed, status') \
        .eq('vessel_id', v['id']) \
        .order('timestamp', desc=True) \
        .limit(1) \
        .execute().data
    
    last_t = tracks[0] if tracks else {}
    ts = last_t.get('timestamp', 'MAI')
    speed = last_t.get('speed', 0)
    st = last_t.get('status', 'N/A')
    nf = (v.get('next_fetch_at') or 'N/A')
    fr = "FREE ROUTE" if v.get('is_free_route') else "TRATTA FISSA"
    
    print(f"🚢 {v['name']:<20} | {fr:<12} | Status: {st:<10} | Speed: {speed:<4}kn | Last TS: {ts[:19]} | Next Fetch: {nf[:19]}")

print("\n=== 2. AUDIT ULTIMI EVENTI GEOFENCE (ENTER/EXIT) ===")
events = sb.table('geofence_events') \
    .select('vessel_id, geofence_id, event_type, timestamp, vessels(name), geofences(name)') \
    .order('timestamp', desc=True) \
    .limit(10) \
    .execute().data

for e in events:
    v_name = e.get('vessels', {}).get('name', 'Nave') if e.get('vessels') else 'N/A'
    g_name = e.get('geofences', {}).get('name', 'Geofence') if e.get('geofences') else 'N/A'
    print(f"⚡ [{e.get('timestamp')[:19]}] {v_name:<20} ➔ {e.get('event_type'):<6} @ {g_name}")

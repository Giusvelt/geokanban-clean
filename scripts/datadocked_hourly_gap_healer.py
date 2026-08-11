import os, sys, json, datetime, urllib.request, dotenv
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')

dotenv.load_dotenv('.env.local')
url = os.environ.get('VITE_SUPABASE_URL') or os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
datadocked_key = os.environ.get('DATADOCKED_API_KEY') or os.environ.get('VITE_DATADOCKED_API_KEY') or ""

if not url or not key or not datadocked_key:
    print("❌ Credenziali mancanti (VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o DATADOCKED_API_KEY) in .env.local")
    sys.exit(1)

supabase = create_client(url, key)

print("=" * 70)
print("⚡ GEOKANBAN — HEALER PERFORMANCE MODE: COLMATURA GAP DATADOCKED 30 LUGLIO 2026")
print("Target: Orari 00:00, 06:00, 07:00, 08:00, 09:00, 10:00, 11:00, 12:00, 13:00 CEST")
print("=" * 70 + "\n")

# 1. Recupero navi attive dal registry active_vessels
vessels_res = supabase.table('active_vessels').select('id, name, mmsi, imo').execute()
active_vessels = vessels_res.data or []


print(f"📋 Trovate {len(active_vessels)} navi attive da verificare:")
for v in active_vessels:
    print(f"   - {v['name']} (MMSI: {v['mmsi']})")

# Slot orari target per il 30 Luglio 2026 (Ora Locale Roma CEST, UTC+2)
# 00:00 CEST -> 2026-07-29T22:00:00Z
# 06:00 CEST -> 2026-07-30T04:00:00Z
# ... fino alle 13:00 CEST -> 2026-07-30T11:00:00Z
target_slots_cest = [
    (0, "2026-07-29T22:00:00Z"),
    (6, "2026-07-30T04:00:00Z"),
    (7, "2026-07-30T05:00:00Z"),
    (8, "2026-07-30T06:00:00Z"),
    (9, "2026-07-30T07:00:00Z"),
    (10, "2026-07-30T08:00:00Z"),
    (11, "2026-07-30T09:00:00Z"),
    (12, "2026-07-30T10:00:00Z"),
    (13, "2026-07-30T11:00:00Z"),
]

def fetch_datadocked_historical_slot(mmsi, from_iso, to_iso):
    """
    Chiama l'API DataDocked historical per recuperare le posizioni AIS nel range specificato.
    """
    dd_url = f"https://datadocked.com/api/vessels_operations/get-vessel-historical-data?imo_or_mmsi={mmsi}&from_date={from_iso}&to_date={to_iso}&interval=1"
    req = urllib.request.Request(
        dd_url,
        headers={'X-API-Key': datadocked_key, 'Authorization': f'Bearer {datadocked_key}'}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if data and isinstance(data, dict) and 'response' in data and isinstance(data['response'], dict):
                return data['response'].get('data') or []
            elif isinstance(data, list):
                return data
            return []
    except Exception as e:
        print(f"      ⚠️ API DataDocked error ({mmsi}): {e}")
        return []

total_positions_inserted = 0
total_events_generated = 0
total_activities_updated = 0

for v in active_vessels:
    v_id = v['id']
    v_name = v['name']
    v_mmsi = v['mmsi']
    print(f"\n🔍 [NAVE: {v_name}] (MMSI: {v_mmsi}) — Audit Gap Orari 00:00, 06:00-13:00...")

    # Recupera i tracciamenti già esistenti per la nave oggi
    existing_tr = supabase.table('vessel_tracking') \
        .select('id, timestamp') \
        .eq('vessel_id', v_id) \
        .gte('timestamp', '2026-07-29T22:00:00Z') \
        .lte('timestamp', '2026-07-30T12:00:00Z') \
        .execute()
    
    existing_timestamps = [t['timestamp'] for t in (existing_tr.data or [])]

    missing_slots = []
    for hour_cest, slot_utc in target_slots_cest:
        dt_slot = datetime.datetime.fromisoformat(slot_utc.replace('Z', '+00:00'))
        
        # Verifica se esiste una posizione entro +/- 20 minuti dallo slot
        has_pos = False
        for et in existing_timestamps:
            dt_et = datetime.datetime.fromisoformat(et.replace('Z', '+00:00'))
            diff_min = abs((dt_et - dt_slot).total_seconds()) / 60.0
            if diff_min <= 25:
                has_pos = True
                break

        if not has_pos:
            missing_slots.append((hour_cest, slot_utc, dt_slot))

    print(f"   ↳ Slot mancanti su DataDocked: {len(missing_slots)} / {len(target_slots_cest)}")

    for hour_cest, slot_utc, dt_slot in missing_slots:
        # Definiamo la finestra di ricerca DataDocked (+/- 30 min dall'ora target)
        from_dt = dt_slot - datetime.timedelta(minutes=30)
        to_dt = dt_slot + datetime.timedelta(minutes=30)
        from_iso = from_dt.strftime('%Y-%m-%dT%H:%M:%SZ')
        to_iso = to_dt.strftime('%Y-%m-%dT%H:%M:%SZ')

        print(f"   📡 Query DataDocked per slot {hour_cest}:00 CEST ({slot_utc}) | Window [{from_iso} -> {to_iso}]")
        pts = fetch_datadocked_historical_slot(v_mmsi, from_iso, to_iso)

        if not pts:
            # Fallback: proviamo il singolo punto live se l'orario è vicino a quello attuale
            print(f"      ℹ️ Nessun punto storico nel batch per {hour_cest}:00, tentativo fallback live location...")
            try:
                url_live = f"https://datadocked.com/api/vessels_operations/get-vessel-location?imo_or_mmsi={v_mmsi}"
                req_live = urllib.request.Request(url_live, headers={'X-API-Key': datadocked_key, 'Authorization': f'Bearer {datadocked_key}'})
                with urllib.request.urlopen(req_live, timeout=10) as r_live:
                    res_live = json.loads(r_live.read().decode('utf-8'))
                    if res_live and res_live.get('latitude'):
                        pts = [{
                            'lat': res_live.get('latitude'),
                            'lng': res_live.get('longitude'),
                            'speed': res_live.get('speed', 0),
                            'heading': res_live.get('heading', 0),
                            'time': res_live.get('positionReceived') or slot_utc
                        }]
            except Exception as live_err:
                print(f"      ⚠️ Fallback live error: {live_err}")

        if pts:
            print(f"      ✅ Trovati {len(pts)} punti da DataDocked per lo slot {hour_cest}:00.")
            for pt in pts:
                pt_time = pt.get('time') or slot_utc
                # Formattazione ISO pulita
                if '.' in pt_time:
                    pt_time = pt_time.split('.')[0] + 'Z'
                elif not pt_time.endswith('Z'):
                    pt_time = pt_time + 'Z'

                track_entry = {
                    'vessel_id': v_id,
                    'mmsi': str(v_mmsi),
                    'lat': float(pt.get('lat', 0)),
                    'lon': float(pt.get('lng') or pt.get('lon') or 0),
                    'speed': float(pt.get('speed') or 0),
                    'course': float(pt.get('heading') or pt.get('course') or 0),
                    'timestamp': pt_time,
                    'source': 'DATADOCKED_HEALER_GAP_FILL'
                }

                # Inserimento anti-duplicato
                try:
                    ins_res = supabase.table('vessel_tracking').insert(track_entry).execute()
                    if ins_res.data:
                        total_positions_inserted += 1
                except Exception as ins_err:
                    pass # Duplicato o gia presente

print("\n" + "=" * 70)
print(f"⚙️ ESECUZIONE MONITORAGGIO POSIZIONI ED AGGIORNAMENTO ATTIVITÀ GEOFENCE...")
print("=" * 70)

# Eseguiamo l'Edge Function geokanban-tracker per processare tutte le nuove posizioni ed aggiornare gli ingressi/uscite e le vessel_activity
edge_url = f"{url}/functions/v1/geokanban-tracker?force=true"
edge_req = urllib.request.Request(edge_url, headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})

try:
    with urllib.request.urlopen(edge_req, timeout=45) as resp:
        edge_res = json.loads(resp.read().decode('utf-8'))
        print("✅ Edge Function 'geokanban-tracker' eseguita con successo!")
        print("   ↳ Risultato Engine:", json.dumps(edge_res, indent=2))
except Exception as e:
    print(f"⚠️ Nota invocazione Edge Function: {e}")

# Verifichiamo il totale delle attività oggi
act_today = supabase.table('vessel_activity').select('id, vessel_id, activity_type, start_time, end_time, status, source').gte('start_time', '2026-07-29T22:00:00Z').execute()
today_activities = act_today.data or []

print("\n" + "=" * 70)
print(f"🎉 BILANCIO PERFORMANCE HEALER — 30 LUGLIO 2026 (dalle 00:00 alle 13:00)")
print(f"  - Nuove posizioni AIS inserite da DataDocked: {total_positions_inserted}")
print(f"  - Totale Vessel Activities attive/concluse oggi: {len(today_activities)}")
for a in today_activities:
    print(f"    • [Vessel: {a['vessel_id']}] Tipo: {a['activity_type']} | Stato: {a['status']} | Inizio: {a['start_time']} | Fine: {a.get('end_time') or 'In corso'}")
print("=" * 70 + "\n")

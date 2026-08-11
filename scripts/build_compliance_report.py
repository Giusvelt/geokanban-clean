import os
import sys
import dotenv
import json
import re
import pandas as pd
from datetime import datetime, timedelta
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')
dotenv.load_dotenv('.env.local')

url = os.environ.get('VITE_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
sb = create_client(url, key)

print("[INFO] Paginazione ed estrazione CORRETTA di TUTTI i messaggi dal 6 Maggio 2026 al 30 Luglio 2026...")

all_msgs = []
start_idx = 0
page_size = 1000

while True:
    res = sb.table('whatsapp_messages') \
        .select('id, sender, message_text, timestamp') \
        .ilike('group_name', '%diga%') \
        .gte('timestamp', '2026-05-06T00:00:00Z') \
        .order('timestamp', desc=False) \
        .range(start_idx, start_idx + page_size - 1) \
        .execute()
    
    batch = res.data or []
    all_msgs.extend(batch)
    if len(batch) < page_size:
        break
    start_idx += page_size

print(f"[SUCCESS] Estratti {len(all_msgs)} messaggi totali.")

data_by_day = {}
month_map = {'maggio': '05', 'giugno': '06', 'luglio': '07', 'agosto': '08'}

for m in all_msgs:
    txt = m.get('message_text', '')
    ts = m.get('timestamp', '')[:10]
    sender = m.get('sender', '')
    txt_upper = txt.upper()
    
    # 1. PROGRAMMA ATTIVITÀ
    if 'PROGRAMMA' in txt_upper and ('ATTIVITÀ' in txt_upper or 'COMMESSA' in txt_upper or 'MEZZI' in txt_upper):
        match_date = re.search(r'(\d{1,2})\s+(Maggio|Giugno|Luglio|Agosto)\s*(2026)?', txt, re.IGNORECASE)
        target_date = ts
        if match_date:
            day = int(match_date.group(1))
            m_str = match_date.group(2).lower()
            month_code = month_map.get(m_str, ts[5:7])
            target_date = f"2026-{month_code}-{day:02d}"
        else:
            try:
                dt_obj = datetime.strptime(ts, '%Y-%m-%d') + timedelta(days=1)
                target_date = dt_obj.strftime('%Y-%m-%d')
            except Exception:
                target_date = ts
            
        if target_date not in data_by_day:
            data_by_day[target_date] = {
                'programma_sender': sender, 'programma_tasks': [],
                'consuntivo_sender': '', 'consuntivo_tasks': [],
                'is_meteo_stby': False
            }
        
        data_by_day[target_date]['programma_sender'] = sender
        tasks = [l.strip() for l in txt.split('\n') if l.strip().startswith('-') or l.strip().startswith('•')]
        data_by_day[target_date]['programma_tasks'] = tasks

    # 2. CONSUNTIVO ATTIVITÀ
    if 'CONSUNTIVO' in txt_upper:
        match_date = re.search(r'(\d{1,2})\s+(Maggio|Giugno|Luglio|Agosto)\s*(2026)?', txt, re.IGNORECASE)
        target_date = ts
        if match_date:
            day = int(match_date.group(1))
            m_str = match_date.group(2).lower()
            month_code = month_map.get(m_str, ts[5:7])
            target_date = f"2026-{month_code}-{day:02d}"
            
        if target_date not in data_by_day:
            data_by_day[target_date] = {
                'programma_sender': '', 'programma_tasks': [],
                'consuntivo_sender': sender, 'consuntivo_tasks': [],
                'is_meteo_stby': False
            }
            
        data_by_day[target_date]['consuntivo_sender'] = sender
        
        if 'CONDIZIONI METEO AVVERSE' in txt_upper or 'NESSUN MEZZO HA OPERATO' in txt_upper:
            data_by_day[target_date]['is_meteo_stby'] = True
            
        tasks = [l.strip() for l in txt.split('\n') if l.strip().startswith('-') or l.strip().startswith('•')]
        data_by_day[target_date]['consuntivo_tasks'] = tasks

rows = []
for d in sorted(data_by_day.keys()):
    item = data_by_day[d]
    prog_n = len(item['programma_tasks'])
    cons_n = len(item['consuntivo_tasks'])
    
    is_meteo = item['is_meteo_stby']
    stby_status = "FERMO METEO" if is_meteo else "OPERATIVO"
    
    # CALCOLO RIGOROSO ADERENZA E DEFICIT (NO BUG SULL'AZZERAMENTO SE CONSUNTIVATO)
    if prog_n > 0:
        ter = round((cons_n / prog_n * 100), 1)
        deficit = max(0, prog_n - cons_n)
    else:
        # Se non c'era programma formale ma c'è consuntivo
        ter = 100.0 if cons_n > 0 else 0.0
        deficit = 0

    rows.append({
        'Data': d,
        'Stato Cantiere': stby_status,
        'Task Programmati (N)': prog_n,
        'Task Consuntivati (N)': cons_n,
        'Deficit Task (TDI)': deficit,
        'Aderenza Programma (TER %)': ter,
        'Programma Inviato Da': item['programma_sender'],
        'Consuntivo Inviato Da': item['consuntivo_sender']
    })

df = pd.DataFrame(rows)
# Ordina per data decrescente (Luglio in alto)
df_sorted = df.sort_values(by='Data', ascending=False)

csv_path = r"scratch\sintesi_aderenza_programmazione_2026.csv"
json_path = r"src\data\compliance_kpi_data.json"

df_sorted.to_csv(csv_path, index=False, encoding='utf-8-sig')

records = df_sorted[['Data', 'Stato Cantiere', 'Task Programmati (N)', 'Task Consuntivati (N)', 'Deficit Task (TDI)', 'Aderenza Programma (TER %)']].to_dict(orient='records')
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(records, f, indent=2, ensure_ascii=False)

print(f"\n============================================================")
print(f"[SUCCESS] FIX APPLICATO CON ESITO POSITIVO PER {len(df_sorted)} GIORNI!")
print(f"File CSV: {csv_path}")
print(f"File JSON: {json_path}")
print("============================================================")
print(df_sorted[df_sorted['Data'].str.contains('2026-05-11|2026-05-12|2026-05-10|2026-05-09')].to_string())

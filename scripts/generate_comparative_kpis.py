import os
import sys
import dotenv
import json
import re
import pandas as pd
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')
dotenv.load_dotenv('.env.local')

url = os.environ.get('VITE_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
sb = create_client(url, key)

print("[INFO] Avvio parsing strutturato di Programmi e Consuntivi dal DB Supabase...")

res = sb.table('whatsapp_messages') \
    .select('id, sender, message_text, timestamp') \
    .ilike('group_name', '%diga%') \
    .gte('timestamp', '2026-07-01T00:00:00Z') \
    .order('timestamp', desc=False) \
    .execute()

msgs = res.data or []

daily_data = {}

for m in msgs:
    txt = m.get('message_text', '')
    txt_upper = txt.upper()
    ts = m.get('timestamp', '')[:10]
    
    # 1. Parse PROGRAMMA attività
    if 'PROGRAMMA ATTIVITÀ' in txt_upper or 'PROGRAMMA' in txt_upper and ('COMMESSA' in txt_upper or 'MEZZI' in txt_upper):
        # Estrai la data target dal testo se presente (es. PROGRAMMA attività Venerdì 10 Luglio 2026)
        match_date = re.search(r'(\d{1,2})\s+(Luglio|Agosto|Giugno)\s+(2026)', txt, re.IGNORECASE)
        target_date = ts
        if match_date:
            day, month_str, year = match_date.groups()
            target_date = f"2026-07-{int(day):02d}"
            
        if target_date not in daily_data:
            daily_data[target_date] = {'programmato': [], 'consuntivo_tov': 0, 'consuntivo_mn_salpati': 0, 'consuntivo_mn_ricollocati': 0, 'consuntivo_dettagli': []}
        
        # Parsifica navi programmate
        lines = txt.split('\n')
        for line in lines:
            line_clean = line.strip()
            if line_clean.startswith('-') or line_clean.startswith('•'):
                daily_data[target_date]['programmato'].append(line_clean)

    # 2. Parse CONSUNTIVO attività
    if 'CONSUNTIVO' in txt_upper:
        match_date = re.search(r'(\d{1,2})\s+(Luglio|Agosto|Giugno)\s+(2026)', txt, re.IGNORECASE)
        target_date = ts
        if match_date:
            day, month_str, year = match_date.groups()
            target_date = f"2026-07-{int(day):02d}"
            
        if target_date not in daily_data:
            daily_data[target_date] = {'programmato': [], 'consuntivo_tov': 0, 'consuntivo_mn_salpati': 0, 'consuntivo_mn_ricollocati': 0, 'consuntivo_dettagli': []}

        # Estrai tonnellaggi consuntivi se presenti
        tov_match = re.search(r'TOV mensile versato ad oggi:\s*circa\s*([\d\'.]+)', txt, re.IGNORECASE)
        mn_salpati_match = re.search(r'MN mensile salpati ad oggi:\s*circa\s*([\d\'.]+)', txt, re.IGNORECASE)
        mn_ricollocati_match = re.search(r'MN mensile ricollocati ad oggi:\s*circa\s*([\d\'.]+)', txt, re.IGNORECASE)
        
        if tov_match:
            daily_data[target_date]['consuntivo_tov'] = tov_match.group(1).replace("'", "").replace(".", "")
        if mn_salpati_match:
            daily_data[target_date]['consuntivo_mn_salpati'] = mn_salpati_match.group(1).replace("'", "").replace(".", "")
        if mn_ricollocati_match:
            daily_data[target_date]['consuntivo_mn_ricollocati'] = mn_ricollocati_match.group(1).replace("'", "").replace(".", "")

        lines = txt.split('\n')
        for line in lines:
            line_clean = line.strip()
            if line_clean.startswith('-') or line_clean.startswith('•'):
                daily_data[target_date]['consuntivo_dettagli'].append(line_clean)

# Genera matrice comparativa
report_rows = []
for d in sorted(daily_data.keys()):
    item = daily_data[d]
    prog_count = len(item['programmato'])
    actual_count = len(item['consuntivo_dettagli'])
    
    # Calcolo KPI Scostamento Task
    task_deficit = prog_count - actual_count
    completion_rate = round((actual_count / prog_count * 100), 1) if prog_count > 0 else 0.0
    
    report_rows.append({
        'Data': d,
        'Task Programmata': prog_count,
        'Task Eseguite (Consuntivo)': actual_count,
        'Deficit Task (Unfulfilled)': task_deficit if task_deficit > 0 else 0,
        'Completion Rate (%)': completion_rate,
        'TOV Mensile Acquisito (t)': item['consuntivo_tov'],
        'MN Salpati Acquisiti (t)': item['consuntivo_mn_salpati'],
        'Dettaglio Programma': " | ".join(item['programmato']),
        'Dettaglio Consuntivo': " | ".join(item['consuntivo_dettagli'])
    })

df = pd.DataFrame(report_rows)
csv_path = r"scratch\comparative_analysis_july_2026.csv"
df.to_csv(csv_path, index=False, encoding='utf-8-sig')

print(f"[SUCCESS] Tabella comparativa generata e salvata in {csv_path}")
print(df[['Data', 'Task Programmata', 'Task Eseguite (Consuntivo)', 'Deficit Task (Unfulfilled)', 'Completion Rate (%)']].to_string())

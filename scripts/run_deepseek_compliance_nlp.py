import os
import sys
import dotenv
import json
import re
import time
import urllib.request
import pandas as pd
from datetime import datetime, timedelta
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')
dotenv.load_dotenv('.env.local')

url = os.environ.get('VITE_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
deepseek_key = os.environ.get('VITE_DEEPSEEK_API_KEY')

if not deepseek_key:
    print("❌ VITE_DEEPSEEK_API_KEY non trovata in .env.local")
    sys.exit(1)

sb = create_client(url, key)

print("[1/4] Estrazione messaggi dal gruppo WhatsApp Diga Team...")
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

# Raggruppamento per giorno
messages_by_day = {}
month_map = {'maggio': '05', 'giugno': '06', 'luglio': '07', 'agosto': '08'}

for m in all_msgs:
    txt = m.get('message_text', '')
    ts = m.get('timestamp', '')[:10]
    sender = m.get('sender', '')
    txt_upper = txt.upper()
    
    if 'PROGRAMMA' in txt_upper or 'CONSUNTIVO' in txt_upper:
        match_date = re.search(r'(\d{1,2})\s+(Maggio|Giugno|Luglio|Agosto)\s*(2026)?', txt, re.IGNORECASE)
        target_date = ts
        if match_date:
            day = int(match_date.group(1))
            m_str = match_date.group(2).lower()
            month_code = month_map.get(m_str, ts[5:7])
            target_date = f"2026-{month_code}-{day:02d}"
        
        if target_date not in messages_by_day:
            messages_by_day[target_date] = {'programma': [], 'consuntivo': []}
            
        if 'PROGRAMMA' in txt_upper and ('ATTIVITÀ' in txt_upper or 'COMMESSA' in txt_upper or 'MEZZI' in txt_upper):
            messages_by_day[target_date]['programma'].append(f"[{sender}]: {txt}")
        elif 'CONSUNTIVO' in txt_upper:
            messages_by_day[target_date]['consuntivo'].append(f"[{sender}]: {txt}")

sorted_dates = sorted(messages_by_day.keys())
print(f"[2/4] Trovate {len(sorted_dates)} giornate operative da analizzare con DeepSeek NLP...")

def call_deepseek_nlp(prompt_text, retries=3):
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {deepseek_key}'
    }
    
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {
                "role": "system",
                "content": """Sei un esperto Data Analyst navale specializzato in Information Extraction.
Il tuo compito è analizzare i messaggi WhatsApp di cantiere per una specifica giornata e restituire UNICAMENTE un oggetto JSON valido con la seguente struttura:

{
  "is_weather_standby": true/false, // true se l'intero cantiere è fermo per condimeteo avverse o se tutti i mezzi sono fermi meteo
  "planned_operational_tasks": [ // array dei soli task OPERATIVI programmati (esclusi licenza, bacino, ferma per manutenzione)
    {"vessel": "NOME_MEZZO", "description": "DESCRIZIONE_ATTIVITA"}
  ],
  "actual_operational_tasks": [ // array dei soli task OPERATIVI effettivamente realizzati/consuntivati
    {"vessel": "NOME_MEZZO", "description": "DESCRIZIONE_ATTIVITA"}
  ]
}

REGOLE RIGIDE:
1. Ignora note su licenze, riposi, o navi ferme per manutenzione programmata (non sono task operativi da compiere).
2. Considera task operativo solo azioni reali (carico, scarico, versamento, dumping, salpamento, ricollocamento, navigazione di carico).
3. Rispondi ESCLUSIVAMENTE con l'oggetto JSON validato. Nessun testo prima o dopo."""
            },
            {
                "role": "user",
                "content": prompt_text
            }
        ],
        "temperature": 0.0,
        "response_format": {"type": "json_object"}
    }
    
    req = urllib.request.Request("https://api.deepseek.com/chat/completions", data=json.dumps(payload).encode('utf-8'), headers=headers)
    
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                res_data = json.loads(resp.read().decode('utf-8'))
                content = res_data['choices'][0]['message']['content']
                return json.loads(content)
        except Exception as e:
            if attempt == retries - 1:
                print(f"  ⚠️ Errore DeepSeek API su giornata: {e}")
                return None
            time.sleep(2)

compliance_rows = []

print("[3/4] Elaborazione semantica in corso con DeepSeek LLM...")

for idx, d in enumerate(sorted_dates, 1):
    day_data = messages_by_day[d]
    
    # RIGIDA REGOLA: Considera SOLO ed UNICAMENTE le giornate in cui sono presenti ENTRAMBI i messaggi (Programma AND Consuntivo)
    if not day_data['programma'] or not day_data['consuntivo']:
        continue

    prog_txt = "\n\n".join(day_data['programma'])
    cons_txt = "\n\n".join(day_data['consuntivo'])
    
    prompt = f"""GIORNATA OPERATIVA: {d}

--- MESSAGGI PROGRAMMA DI LAVORO PER IL GIORNO {d} ---
{prog_txt}

--- MESSAGGI CONSUNTIVO ATTIVITÀ DEL GIORNO {d} ---
{cons_txt}
"""
    
    analysis = call_deepseek_nlp(prompt)
    
    if not analysis:
        # Fallback difensivo se l'API fallisce
        prog_n = len([l for l in prog_txt.split('\n') if l.strip().startswith('-')])
        cons_n = len([l for l in cons_txt.split('\n') if l.strip().startswith('-')])
        is_meteo = 'CONDIZIONI METEO AVVERSE' in cons_txt.upper()
    else:
        prog_n = len(analysis.get('planned_operational_tasks', []))
        cons_n = len(analysis.get('actual_operational_tasks', []))
        is_meteo = analysis.get('is_weather_standby', False)
        
    stby_status = "FERMO METEO" if is_meteo else "OPERATIVO"
    
    if is_meteo:
        # FERMO METEO: Se sono stati fatti task prima della sospensione, si calcola la reale aderenza. Se 0 consuntivati, 0% senza penalizzare task non iniziati.
        ter = round((cons_n / prog_n * 100), 1) if prog_n > 0 else (100.0 if cons_n > 0 else 0.0)
        deficit = max(0, prog_n - cons_n)
    elif prog_n > 0:
        ter = round((cons_n / prog_n * 100), 1)
        deficit = max(0, prog_n - cons_n)
    else:
        ter = 100.0 if cons_n > 0 else 0.0
        deficit = 0

    compliance_rows.append({
        'Data': d,
        'Stato Cantiere': stby_status,
        'Task Programmati (N)': prog_n,
        'Task Consuntivati (N)': cons_n,
        'Deficit Task (TDI)': deficit,
        'Aderenza Programma (TER %)': ter
    })
    
    print(f" [{idx}/{len(sorted_dates)}] {d} | {stby_status} | Prog: {prog_n} | Actual: {cons_n} | TER: {ter}%")

print("[4/4] Salvataggio dei risultati strutturati...")
df = pd.DataFrame(compliance_rows)
df_sorted = df.sort_values(by='Data', ascending=False)

csv_path = r"scratch\sintesi_aderenza_programmazione_2026.csv"
json_path = r"src\data\compliance_kpi_data.json"

df_sorted.to_csv(csv_path, index=False, encoding='utf-8-sig')

records = df_sorted[['Data', 'Stato Cantiere', 'Task Programmati (N)', 'Task Consuntivati (N)', 'Deficit Task (TDI)', 'Aderenza Programma (TER %)']].to_dict(orient='records')
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(records, f, indent=2, ensure_ascii=False)

print(f"\n============================================================")
print(f"[SUCCESS] ANALISI DEEPSEEK NLP ULTIMATA PER {len(df_sorted)} GIORNI!")
print(f"Dataset CSV: {csv_path}")
print(f"Dataset JSON: {json_path}")
print("============================================================")

import json
import pandas as pd

df = pd.read_csv(r'scratch\sintesi_aderenza_programmazione_2026.csv')

# Ordina per Data decrescente (dal 30 Luglio 2026 a scendere verso Maggio 2026)
df_sorted = df.sort_values(by='Data', ascending=False)

records = df_sorted[['Data', 'Stato Cantiere', 'Task Programmati (N)', 'Task Consuntivati (N)', 'Deficit Task (TDI)', 'Aderenza Programma (TER %)']].to_dict(orient='records')

print(f"[INFO] Primo record in alto: {records[0]['Data']}")
print(f"[INFO] Ultimo record in basso: {records[-1]['Data']}")

with open(r'src\data\compliance_kpi_data.json', 'w', encoding='utf-8') as f:
    json.dump(records, f, indent=2, ensure_ascii=False)

print("[SUCCESS] src/data/compliance_kpi_data.json aggiornato in ordine cronologico decrescente!")

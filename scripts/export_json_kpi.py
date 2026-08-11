import json
import pandas as pd

df = pd.read_csv(r'scratch\sintesi_aderenza_programmazione_2026.csv')
records = df[['Data', 'Stato Cantiere', 'Task Programmati (N)', 'Task Consuntivati (N)', 'Deficit Task (TDI)', 'Aderenza Programma (TER %)']].to_dict(orient='records')

with open(r'src\data\compliance_kpi_data.json', 'w', encoding='utf-8') as f:
    json.dump(records, f, indent=2, ensure_ascii=False)

print(f"[SUCCESS] Convertite {len(records)} righe di dati analitici in src/data/compliance_kpi_data.json!")

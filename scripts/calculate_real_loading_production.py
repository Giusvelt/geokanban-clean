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

vessels = sb.table('vessels').select('id, name, gross_tonnage, avg_cargo').execute().data
plans = sb.table('production_plans').select('*').eq('period_name', 'July 2026').execute().data

total_calc = 0
total_loadings = 0

print(f"{'NAVE':<20} | {'STAZZA / CARICO (t)':<20} | {'LOADING COUNT':<15} | {'PRODUZIONE CALCOLATA (t)'}")
print("-" * 80)

for p in plans:
    v = next((v for v in vessels if v['id'] == p['vessel_id']), None)
    if not v:
        continue
    cargo = v['gross_tonnage'] or v['avg_cargo'] or 4500
    loadings = p['loading_count'] or 0
    prod = cargo * loadings
    total_calc += prod
    total_loadings += loadings
    print(f"{v['name']:<20} | {cargo:<20} | {loadings:<15} | {prod:>12,} t")

print("-" * 80)
print(f"TOTALE LOADING REGISTRATI: {total_loadings}")
print(f"TOTALE PRODUZIONE REALE CALCOLATA: {total_calc:,} TONNELLATE")

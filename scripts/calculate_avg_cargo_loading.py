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

vessels = sb.table('vessels').select('id, name, avg_cargo').execute().data
plans = sb.table('production_plans').select('*').eq('period_name', 'July 2026').execute().data

total_calc = 0
total_loadings = 0

print(f"{'NAVE':<22} | {'AVG CARGO (t)':<15} | {'LOADING COUNT':<15} | {'PRODUZIONE (avg_cargo * loading)'}")
print("-" * 85)

for p in plans:
    v = next((v for v in vessels if v['id'] == p['vessel_id']), None)
    if not v:
        continue
    cargo = v.get('avg_cargo') or 0
    loadings = p.get('loading_count') or 0
    prod = cargo * loadings
    total_calc += prod
    total_loadings += loadings
    print(f"{v['name']:<22} | {cargo:<15} | {loadings:<15} | {prod:>15,} t")

print("-" * 85)
print(f"TOTALE LOADING COUNT: {total_loadings}")
print(f"TOTALE PRODUZIONE REALE (AVG CARGO * LOADING): {total_calc:,} TONNELLATE")

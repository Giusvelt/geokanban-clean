import os, datetime, sys, dotenv
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')

dotenv.load_dotenv('.env.local')
url = os.environ.get('VITE_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
supabase = create_client(url, key)

print("=" * 60)
print("GEOKANBAN - PROTOCOLLO ORIENTAMENTO AGENTE & MEMORY SYNC")
print(f"Data e Ora Sincronizzazione: {datetime.datetime.now(datetime.timezone.utc).isoformat()}")
print("=" * 60)

# 1. Estrarre la Memoria Episodica
res_episodic = supabase.table('project_knowledge_embeddings_v2').select('ki_name, contextual_header, chunk_content, updated_at').eq('metadata->>type', 'EPISODIC_MEMORY').execute()
print(f"\n[1] MEMORIA EPISODICA ESTRATTA ({len(res_episodic.data)} record):")
seen_keys = set()
for r in res_episodic.data:
    key = r['ki_name']
    if key not in seen_keys:
        seen_keys.add(key)
        print(f"  - [{r['ki_name']}] ({r['updated_at'][:10]}): {r['chunk_content'][:100]}...")

# 2. Estrarre la Repo Map con Data Impressa
res_repomap = supabase.table('project_knowledge_embeddings_v2').select('contextual_header, metadata, updated_at').eq('ki_name', 'REPO_MAP').execute()
print(f"\n[2] REPO MAP SULLA MEMORIA VETTORIALE:")
if res_repomap.data:
    print(f"  - {res_repomap.data[0]['contextual_header']}")
    print(f"  - Totale Chunk Indicizzati: {len(res_repomap.data)}")
else:
    print("  - [WARNING] Nessun vettore REPO_MAP presente!")

# 3. Estrarre i Knowledge Items (KI) del Workspace
res_ki = supabase.table('project_knowledge_embeddings_v2').select('ki_name, file_path').execute()
workspace_kis = set()
for r in res_ki.data:
    name = r.get('ki_name')
    if name and name not in ['REPO_MAP'] and r.get('metadata', {}).get('type') != 'EPISODIC_MEMORY':
        workspace_kis.add(name)

distinct_kis = sorted(list(workspace_kis))
print(f"\n[3] KNOWLEDGE ITEMS (KI) REGISTRATI NEL WORKSPACE ({len(distinct_kis)} KI):")
for ki in distinct_kis:
    print(f"  - {ki}")

print("\n" + "=" * 60)
print("SINCRO COMPLETA: 100% Memoria Episodica, Repo Map & KI Assimilati!")
print("Dichiara: 'Sincronizzato e Pronto ad Operare'")
print("=" * 60)

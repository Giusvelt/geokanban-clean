import os, datetime, dotenv
from supabase import create_client
from sentence_transformers import SentenceTransformer

dotenv.load_dotenv('.env.local')
url = os.environ.get('VITE_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
supabase = create_client(url, key)

print('[INFO] Inizializzazione modello embedding local (all-mpnet-base-v2)...')
model = SentenceTransformer('all-mpnet-base-v2')

# 1. Lettura repo_map.txt
repo_map_path = 'repo_map.txt'
if not os.path.exists(repo_map_path):
    print('[ERROR] repo_map.txt non trovato. Generalo prima con main.py')
    exit(1)

with open(repo_map_path, 'r', encoding='utf-8') as f:
    repo_map_text = f.read()

# Estrazione timestamp dall'intestazione
lines = repo_map_text.splitlines()
timestamp_line = lines[1] if len(lines) > 1 else str(datetime.datetime.now(datetime.timezone.utc))

# 2. Eliminazione vecchi vettori REPO_MAP
print('[INFO] Eliminazione vettori REPO_MAP obsoleti da Supabase...')
supabase.from_('project_knowledge_embeddings_v2').delete().eq('ki_name', 'REPO_MAP').execute()

# 3. Chunking della Repo Map (max ~1000 caratteri per chunk)
chunk_size = 1000
chunks = [repo_map_text[i:i+chunk_size] for i in range(0, len(repo_map_text), chunk_size)]

print(f'[INFO] Vettorializzazione di {len(chunks)} chunk della Repo Map...')

for idx, chunk in enumerate(chunks):
    vec = model.encode(chunk).tolist()
    data = {
        'ki_name': 'REPO_MAP',
        'file_path': 'repo_map.txt',
        'contextual_header': f'REPO MAP GEOKANBAN - CHUNK {idx+1}/{len(chunks)} - {timestamp_line}',
        'chunk_content': chunk,
        'embedding': vec,
        'metadata': {
            'type': 'REPO_MAP',
            'created_by': 'Antigravity IDE',
            'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'chunk_index': idx
        }
    }
    supabase.from_('project_knowledge_embeddings_v2').insert(data).execute()

print(f'[SUCCESS] Vettorializzazione REPO_MAP completata ({len(chunks)} chunk salvati in DB con data impressa)!')

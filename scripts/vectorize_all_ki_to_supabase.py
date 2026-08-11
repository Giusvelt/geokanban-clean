import os
import dotenv
import sys
import glob

sys.stdout.reconfigure(encoding='utf-8')
dotenv.load_dotenv('.env.local')

from supabase import create_client
from sentence_transformers import SentenceTransformer

url = os.environ.get('VITE_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
sb = create_client(url, key)

print("🚀 Caricamento modello embeddings sentence-transformers/all-mpnet-base-v2 (768D)...")
model = SentenceTransformer('sentence-transformers/all-mpnet-base-v2')

# Directory dei Knowledge Items del Workspace Antigravity IDE & del Progetto
ki_dirs = [
    r"C:\Users\giuse\.gemini\antigravity-ide\knowledge\*",
    r".agents\knowledge\*"
]

files_to_process = []
for pattern in ki_dirs:
    for path in glob.glob(pattern):
        if os.path.isdir(path):
            md_files = glob.glob(os.path.join(path, "**", "*.md"), recursive=True)
            files_to_process.extend(md_files)
        elif path.endswith('.md'):
            files_to_process.append(path)

print(f"📚 Trovati {len(files_to_process)} file di Knowledge Items da vettorializzare su Supabase...")

processed_count = 0
for fpath in files_to_process:
    try:
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()

        if not content.strip():
            continue

        ki_name = os.path.basename(os.path.dirname(fpath)) or os.path.basename(fpath).replace('.md', '')
        rel_path = os.path.relpath(fpath, os.getcwd()) if fpath.startswith(os.getcwd()) else fpath

        # Split content in chunk max 1000 car
        chunks = [content[i:i+1000] for i in range(0, len(content), 900)]
        
        # Elimina vecchi vettori per questo KI prima di inserire i nuovi
        sb.table('project_knowledge_embeddings_v2').delete().eq('ki_name', ki_name).execute()

        for idx, chunk in enumerate(chunks):
            embedding = model.encode(chunk).tolist()
            
            payload = {
                'ki_name': ki_name,
                'file_path': rel_path,
                'contextual_header': f"KI: {ki_name} — Chunk {idx+1}/{len(chunks)}",
                'chunk_content': chunk,
                'embedding': embedding,
                'metadata': {'type': 'knowledge_item', 'file': rel_path}
            }
            
            sb.table('project_knowledge_embeddings_v2').insert(payload).execute()
        
        print(f"  ✅ Vettorializzato KI: {ki_name} ({len(chunks)} chunk) da [{os.path.basename(fpath)}]")
        processed_count += 1

    except Exception as e:
        print(f"  ❌ Errore vettorializzazione {fpath}: {e}")

print(f"\n============================================================")
print(f"🎉 VETTORIALIZZAZIONE ULTIMATA! {processed_count} Knowledge Items salvati su Supabase!")
print(f"============================================================")

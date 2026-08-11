import os
import json
import time
import sys

# Forza l'output della console in UTF-8 su Windows
sys.stdout.reconfigure(encoding='utf-8')

from dotenv import load_dotenv
from supabase import create_client
from sentence_transformers import SentenceTransformer

load_dotenv('.env.local')

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Credenziali Supabase mancanti in .env.local")
    exit(1)

def run_local_fast_vectorizer():
    print("=============================================================")
    print("[LOCALE] VETTORIALIZZATORE PYTHON HYPER-SPEED (Zero API Key / Zero 429)")
    print("=============================================================\n")

    print("[INFO] Caricamento modello locale 'all-mpnet-base-v2' (768 dimensioni)...")
    model = SentenceTransformer('all-mpnet-base-v2')
    print("[OK] Modello locale caricato in RAM con successo!\n")

    batch_size = 100
    total_processed = 0
    start_date = '2024-01-01T00:00:00Z'
    end_date = '2024-12-31T23:59:59Z'
    allowed_groups = ['+ Survey x la  Diga', 'Diga Team', 'SIDER-FIOM', 'ZETA PGBW']

    start_time = time.time()

    while True:
        try:
            # Ricreiamo la connessione Supabase ad ogni iterazione per prevenire disconnessioni socket HTTP/2 prolungate
            supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

            response = supabase.table('whatsapp_messages') \
                .select('id, message_text, sender, timestamp, group_name') \
                .gte('timestamp', start_date) \
                .lte('timestamp', end_date) \
                .in_('group_name', allowed_groups) \
                .is_('embedding', 'null') \
                .order('timestamp', desc=False) \
                .limit(batch_size) \
                .execute()

            messages = response.data

            if not messages or len(messages) == 0:
                print("\n[FINITO] TUTTI I MESSAGGI SONO STATI VETTORIALIZZATI IN LOCALE!")
                break

            first_date = messages[0]['timestamp']
            last_date = messages[-1]['timestamp']
            print(f"[BATCH] Elaborazione {len(messages)} msg | Totale salvati: {total_processed} | Periodo: [{first_date}] -> [{last_date}]")

            for msg in messages:
                text_to_embed = f"[Data: {msg['timestamp']}] [Gruppo: {msg['group_name']}] {msg.get('sender') or 'Anonimo'}: {msg.get('message_text') or ''}"

                # Calcolo del vettore in LOCALE su CPU/GPU (Float array a 768 dimensioni)
                embedding = model.encode(text_to_embed, normalize_embeddings=True).tolist()

                # Retry scrittura su Supabase in caso di glitch di rete momentaneo
                for attempt in range(3):
                    try:
                        supabase.table('whatsapp_messages') \
                            .update({'embedding': json.dumps(embedding)}) \
                            .eq('id', msg['id']) \
                            .execute()
                        total_processed += 1
                        break
                    except Exception as db_err:
                        if attempt == 2:
                            print(f"[WARN] Impossibile aggiornare msg ID {msg['id']}: {db_err}")
                        time.sleep(1)

            elapsed_min = max((time.time() - start_time) / 60.0, 0.01)
            speed = int(total_processed / elapsed_min)
            print(f"[STATO] {total_processed} messaggi salvati | Velocità media: {speed} msg/minuto")

        except Exception as batch_err:
            print(f"[RETE WARN] Glitch o disconnessione socket Supabase: {batch_err}. Attesa di 3s e ripresa...")
            time.sleep(3)

if __name__ == '__main__':
    run_local_fast_vectorizer()

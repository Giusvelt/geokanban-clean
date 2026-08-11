import os
import sys
import time
import threading
import dotenv
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')

dotenv.load_dotenv(os.path.join(os.path.dirname(__file__), '.env.local'))
dotenv.load_dotenv('/app/.env.local')

app = FastAPI(title="GeoKanban VPS Embedding Microservice", version="1.0")

print("🚀 Caricamento modello SentenceTransformer 'all-mpnet-base-v2' in RAM...")
model = SentenceTransformer('sentence-transformers/all-mpnet-base-v2')
print("✅ Modello caricato con successo ed in attesa di richieste!")

API_KEY = os.getenv("VPS_API_KEY", "geokanban-secret-key-2026")
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

sb_client = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        sb_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✅ Connessione Supabase per vettorializzazione automatica H24 attiva!")
    except Exception as e:
        print("⚠️ Supabase init warning:", e)

def auto_vectorize_worker():
    """Background worker che ogni 15 minuti vettorializza i messaggi WhatsApp pendenti su Supabase"""
    print("🔄 [AUTO-VECTORIZER H24] Thread in background avviato ed operativo...")
    while True:
        try:
            if sb_client:
                res = sb_client.table('whatsapp_messages').select('id, group_name, sender, message_text').is_('embedding', 'null').limit(100).execute()
                pending = res.data or []
                if pending:
                    print(f"🔄 [AUTO-VECTORIZER H24] Trovati {len(pending)} nuovi messaggi WhatsApp da vettorializzare...")
                    for m in pending:
                        txt = f"[{m.get('group_name')}] {m.get('sender')}: {m.get('message_text')}"
                        vec = model.encode(txt, normalize_embeddings=True).tolist()
                        sb_client.table('whatsapp_messages').update({'embedding': vec}).eq('id', m['id']).execute()
                    print(f"✅ [AUTO-VECTORIZER H24] Vettorializzati {len(pending)} messaggi in background su Supabase!")
        except Exception as err:
            print("⚠️ [AUTO-VECTORIZER ERROR]:", err)
        
        # Attendi 15 minuti (900 secondi) prima del prossimo ciclo automatizzato
        time.sleep(900)

# Avvia il worker in background in un thread daemon
thread = threading.Thread(target=auto_vectorize_worker, daemon=True)
thread.start()

class EmbedRequest(BaseModel):
    text: str

class EmbedResponse(BaseModel):
    embedding: list[float]
    dimensions: int = 768

def verify_api_key(x_api_key: str = Header(None)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="API Key non valida o mancante")
    return x_api_key

@app.get("/health")
def health_check():
    return {
        "status": "ok", 
        "model": "all-mpnet-base-v2", 
        "dimensions": 768,
        "auto_vectorizer": "active_h24"
    }

@app.get("/qr", response_class=HTMLResponse)
def get_qr_code():
    qr_path = os.path.join('/opt/geokanban_services', 'scratch', 'qr_code.html')
    if os.path.exists(qr_path):
        with open(qr_path, 'r', encoding='utf-8') as f:
            return f.read()
    return "<h3>QR Code non ancora generato. Attendi pochi secondi e ricarica.</h3>"

@app.post("/embed", response_model=EmbedResponse)
def generate_embedding(req: EmbedRequest, api_key: str = Depends(verify_api_key)):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Testo non valido")
    
    vec = model.encode(req.text, normalize_embeddings=True).tolist()
    return EmbedResponse(embedding=vec, dimensions=len(vec))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

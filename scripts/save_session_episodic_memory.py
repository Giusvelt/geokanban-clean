import os, dotenv
from supabase import create_client
from sentence_transformers import SentenceTransformer

dotenv.load_dotenv('.env.local')
url = os.environ.get('VITE_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
if not url or not key:
    print('❌ Credenziali Supabase mancanti in .env.local')
    exit(1)

supabase = create_client(url, key)

print('[INFO] Caricamento modello all-mpnet-base-v2 per vettorializzazione memoria episodica...')
model = SentenceTransformer('all-mpnet-base-v2')

# Memoria Episodica della Sessione (28-29 Luglio 2026)
episodic_items = [
    {
        'ki_name': 'SESSION_LOGBOOK_PURGE_AND_REAL_DATA',
        'file_path': '.agents/episodic_memory/session_purge_real_data.md',
        'contextual_header': 'MEMORIA EPISODICA: BONIFICA MOCK & POPOLAMENTO LOGBOOK REALI',
        'chunk_content': 'SINTESI SESSIONE: Eliminati tutti i 565 logbook mock dal DB Supabase. L Agente GeoKanban AI Crew Passpartout ha popolato ed allineato 628 attività concluse con note operative reali e tonnellaggi estratte dai messaggi WhatsApp.'
    },
    {
        'ki_name': 'SESSION_PASSPARTOUT_48H_RULE',
        'file_path': '.agents/episodic_memory/session_passpartout_48h.md',
        'contextual_header': 'MEMORIA EPISODICA: REGOLA 48H PASSPARTOUT & CONTESTO (-24H / +48H)',
        'chunk_content': 'REGOLA OPERATIVA: L Agente Passpartout sottomette soltanto le attività concluse da almeno 48 ore. Raccoglie i messaggi WhatsApp scambiati tra 24h prima dell inizio e 48h dopo la fine dell attività. Se non vi sono eventi reali, narrative_text resta null senza frasi ridondanti.'
    },
    {
        'ki_name': 'SESSION_WHITELIST_HARDENING',
        'file_path': '.agents/episodic_memory/session_whitelist_hardening.md',
        'contextual_header': 'MEMORIA EPISODICA: BLINDATURA WHITELIST & I 49.526 MESSAGGI',
        'chunk_content': 'BLINDATURA WHITELIST: Epurati 12 messaggi fuori whitelist. Il Bridge WhatsApp accetta ed inserisce SOLTANTO messaggi dai gruppi di cantiere ZETA PGBW (8.364), SIDER-FIOM (17.817), + Survey x la Diga (10.207) e Diga Team (13.138) per un totale di 49.526 record salvati e vettorializzati.'
    },
    {
        'ki_name': 'SESSION_COPILOT_PRIVACY_AND_RETRY',
        'file_path': '.agents/episodic_memory/session_copilot_privacy_retry.md',
        'contextual_header': 'MEMORIA EPISODICA: COPILOT PRIVACY & RETRY BACKOFF 429',
        'chunk_content': 'COPILOT UPGRADE: Rimosse domande preimpostate ed inserita la Guida Operativa. Aggiunta la protezione con retry e backoff per quota HTTP 429 sia sulla generazione di embedding che sulla chiamata LLM.'
    },
    {
        'ki_name': 'PROMEMORIA_PRESERVAZIONE_CHAT_COPILOT',
        'file_path': '.agents/episodic_memory/promemoria_chat_copilot.md',
        'contextual_header': 'PROMEMORIA FUTURE TASK: PERSISTENZA CHAT COPILOT TRA CAMBIO TAB',
        'chunk_content': 'TASK FUTURO COPILOT: Studiare ed implementare la fattibilita tecnica per la persistenza della cronologia nella tab Copilot AI tra cambio tab e ricaricamento (Zustand/LocalStorage o tabella copilot_chat_history).'
    },
    {
        'ki_name': 'PROMEMORIA_RESTYLING_TAB_LATERALI_ICONE',
        'file_path': '.agents/episodic_memory/promemoria_ui_sidebar_tabs.md',
        'contextual_header': 'PROMEMORIA FUTURE TASK: RESTYLING NAVIGAZIONE TAB LATERALI AD ICONE',
        'chunk_content': 'TASK FUTURO UI/UX: Spostare i tab di navigazione dell applicazione lateralmente (sidebar) mostrando soltanto le icone senza testo statico, ma facendo comparire il nome del tab in overlay/tooltip al passaggio (hover/touch).'
    }
]

for p in episodic_items:
    vec = model.encode(p['chunk_content']).tolist()
    data = {
        'ki_name': p['ki_name'],
        'file_path': p['file_path'],
        'contextual_header': p['contextual_header'],
        'chunk_content': p['chunk_content'],
        'embedding': vec,
        'metadata': {'type': 'EPISODIC_MEMORY', 'session': '2026-07-28_29', 'created_by': 'Antigravity IDE'}
    }
    supabase.from_('project_knowledge_embeddings_v2').insert(data).execute()
    print('Registrato in Memoria Episodica:', p['ki_name'])

print('PROMEMORIA E SINTESI SESSIONE REGISTRATI IN MEMORIA EPISODICA VETTORIALE 768D!')

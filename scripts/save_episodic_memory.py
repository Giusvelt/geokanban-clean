import os, dotenv
from supabase import create_client
from sentence_transformers import SentenceTransformer

dotenv.load_dotenv('.env.local')
url = os.environ.get('VITE_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
supabase = create_client(url, key)

print('[INFO] Caricamento modello all-mpnet-base-v2...')
model = SentenceTransformer('all-mpnet-base-v2')

promemoria_list = [
    {
        'ki_name': 'PROMEMORIA_PASSWORD_UTENTI_PERMESSI',
        'file_path': '.agents/episodic_memory/promemoria_passwords.md',
        'contextual_header': 'MEMORIA EPISODICA: PROMEMORIA PASSWORD UTENTI & CUSTOM OVERRIDES',
        'chunk_content': 'PROMEMORIA PER GIUSEPPE (DA RICORDARE TRA DUE GIORNI): Verificare e gestire le password degli utenti ed i permessi custom_overrides (incluso v3 see_copilot) per tutti gli utenti nella scheda UserManagementTab.'
    },
    {
        'ki_name': 'PROMEMORIA_CREW_PASSPARTOUT_EXCEL',
        'file_path': '.agents/episodic_memory/promemoria_crew_passpartout.md',
        'contextual_header': 'MEMORIA EPISODICA: AGENTE CREW PASSPARTOUT & COMPILAZIONE EXCEL CERTIFICATO',
        'chunk_content': 'PROMEMORIA ARCHITETTURA: L Agente Crew Passpartout agisce come GeoKanban AI Crew estraendo dai messaggi WhatsApp i tonnellaggi reali (actual_cargo_tonnes), pescaggi In/Out, orari rimorchiatori, piloti, ormeggiatori e note operative per generare il file Excel certificato GeoKanban.'
    },
    {
        'ki_name': 'AVANZAMENTO_GIORNALIERO_28_LUGLIO_2026',
        'file_path': '.agents/episodic_memory/avanzamento_28_luglio.md',
        'contextual_header': 'MEMORIA EPISODICA: SINTESI AVANZAMENTO GIORNALIERO 28 LUGLIO 2026',
        'chunk_content': 'SINTESI AVANZAMENTO: Vettorializzazione 100% completata per tutti i 49.519 messaggi WhatsApp (2024-2026). Inserita la tripla barriera di privacy nel Copilot. Creato il flag see_copilot nei permessi tenant. Creato il manuale universale RAG e la guida portabilita multi-PC.'
    },
    {
        'ki_name': 'PROMEMORIA_PRESERVAZIONE_CHAT_COPILOT',
        'file_path': '.agents/episodic_memory/promemoria_chat_copilot.md',
        'contextual_header': 'MEMORIA EPISODICA: PERSISTENZA CHAT COPILOT TRA CAMBIO TAB',
        'chunk_content': 'TASK PRINCIPALE DOMANI PER GIUSEPPE: Studiare ed implementare la fattibilita tecnica per la persistenza della cronologia nella tab Copilot AI. Se l utente esce dalla scheda Copilot e poi vi rientra (o ricarica la pagina), deve ritrovare esattamente la stessa conversazione precedente. Valutare salvataggio su localStorage / Zustand store oppure su tabella Supabase `copilot_chat_history` per utente.'
    },
    {
        'ki_name': 'PROMEMORIA_RESTYLING_TAB_LATERALI_ICONE',
        'file_path': '.agents/episodic_memory/promemoria_ui_sidebar_tabs.md',
        'contextual_header': 'MEMORIA EPISODICA: RESTYLING NAVIGAZIONE TAB LATERALI AD ICONE',
        'chunk_content': 'PROMEMORIA UI/UX PER GIUSEPPE: Spostare i tab di navigazione dell applicazione lateralmente (sidebar) mostrando soltanto le icone senza testo statico, ma facendo comparire il nome/etichetta del tab in overlay/tooltip quando l utente passa sopra con il cursore o sul cellulare (hover/touch).'
    }
]

for p in promemoria_list:
    vec = model.encode(p['chunk_content']).tolist()
    data = {
        'ki_name': p['ki_name'],
        'file_path': p['file_path'],
        'contextual_header': p['contextual_header'],
        'chunk_content': p['chunk_content'],
        'embedding': vec,
        'metadata': {'type': 'EPISODIC_MEMORY', 'created_by': 'Antigravity IDE'}
    }
    supabase.from_('project_knowledge_embeddings_v2').insert(data).execute()
    print('Registrato in Memoria Episodica:', p['ki_name'])

print('PROMEMORIA E SINTESI REGISTRATI IN MEMORIA EPISODICA CON VETTORI LOCAL 768D!')

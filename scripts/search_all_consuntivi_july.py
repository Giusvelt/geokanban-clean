import os
import dotenv
import sys
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')
dotenv.load_dotenv('.env.local')

sb = create_client(os.environ.get('VITE_SUPABASE_URL'), os.environ.get('SUPABASE_SERVICE_ROLE_KEY'))

# Cerca tutti i messaggi con CONSUNTIVO nel testo in tutto il mese di Luglio
res_consuntivi = sb.table('whatsapp_messages') \
    .select('timestamp, group_name, sender, message_text') \
    .ilike('message_text', '%CONSUNTIVO%') \
    .gte('timestamp', '2026-07-01T00:00:00Z') \
    .lte('timestamp', '2026-07-29T23:59:59Z') \
    .order('timestamp', desc=False) \
    .execute()

print(f"=== TOTAL MESSAGGI 'CONSUNTIVO' TROVATI A LUGLIO: {len(res_consuntivi.data)} ===")
for m in res_consuntivi.data:
    date_str = m['timestamp'][:10]
    first_line = m['message_text'].split('\n')[0]
    print(f"📅 {date_str} | Gruppo: {m.get('group_name')} | Intestazione: {first_line}")

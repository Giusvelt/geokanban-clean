import os, sys, re, glob, datetime, dotenv
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')

dotenv.load_dotenv('.env.local')
url = os.environ.get('VITE_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not url or not key:
    print("❌ Credenziali Supabase mancanti in .env.local")
    sys.exit(1)

supabase = create_client(url, key)

# Whitelist dei 4 gruppi monitorati
ALLOWED_GROUPS = ['+ Survey x la  Diga', 'Diga Team', 'SIDER-FIOM', 'ZETA PGBW']

def parse_whatsapp_export(file_path, group_name):
    """
    Legge un file di export TXT di WhatsApp e restituisce una lista di messaggi strutturati.
    Gestisce formati data standard iOS e Android:
    - [DD/MM/YY, HH:MM:SS] Sender: Message
    - DD/MM/YY, HH:MM - Sender: Message
    - DD/MM/YYYY, HH:MM - Sender: Message
    """
    if not os.path.exists(file_path):
        print(f"❌ File non trovato: {file_path}")
        return []

    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()

    messages = []
    current_msg = None

    # Pattern Regex per riconoscere le intestazioni di messaggio WhatsApp
    # Pattern 1: [28/07/26, 14:30:15] Nome: Testo
    regex_ios = re.compile(r'^\[(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\]\s+([^:]+):\s+(.*)$')
    # Pattern 2: 28/07/26, 14:30 - Nome: Testo
    regex_android = re.compile(r'^(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\s+-\s+([^:]+):\s+(.*)$')

    for line in lines:
        line_clean = line.strip('\ufeff\r\n')
        if not line_clean:
            continue

        match_ios = regex_ios.match(line_clean)
        match_android = regex_android.match(line_clean)

        match = match_ios or match_android

        if match:
            if current_msg:
                messages.append(current_msg)

            raw_date, raw_time, sender, text = match.groups()

            # Sanitizzazione mittente ed esclusione avvisi di sistema
            sender = sender.strip()
            if "crittografat" in text.lower() or "cambiato il numero" in text.lower() or "aggiunto" in text.lower():
                current_msg = None
                continue

            # Parsing data ed ora in ISO 8601
            try:
                parts = re.split(r'[\/\.\-]', raw_date)
                day, month = int(parts[0]), int(parts[1])
                year = int(parts[2])
                if year < 100:
                    year += 2000

                time_parts = raw_time.split(':')
                hour, minute = int(time_parts[0]), int(time_parts[1])
                second = int(time_parts[2]) if len(time_parts) > 2 else 0

                dt = datetime.datetime(year, month, day, hour, minute, second, tzinfo=datetime.timezone.utc)
                iso_ts = dt.isoformat()
            except Exception:
                iso_ts = datetime.datetime.now(datetime.timezone.utc).isoformat()

            current_msg = {
                'group_name': group_name,
                'sender': sender,
                'message_text': text.strip(),
                'timestamp': iso_ts,
                'is_processed': False
            }
        else:
            # Riga a capo (messaggio multi-linea)
            if current_msg:
                current_msg['message_text'] += f"\n{line_clean}"

    if current_msg:
        messages.append(current_msg)

    return messages

def ingest_directory(folder_path="whatsapp_exports"):
    """
    Cerca tutti i file .txt nella cartella specificata e inserisce i messaggi nel DB Supabase.
    """
    print("=============================================================")
    print("📥 INGESTIONE MANUALE EXPORT CHAT WHATSAPP")
    print("=============================================================\n")

    if not os.path.exists(folder_path):
        os.makedirs(folder_path, exist_ok=True)
        print(f"📁 Creata cartella '{folder_path}'. Inserisci qui i file .txt di export chat e riavvia.")
        return

    txt_files = glob.glob(os.path.join(folder_path, "*.txt"))
    if not txt_files:
        print(f"⚠️ Nessun file .txt trovato nella cartella '{folder_path}'.")
        return

    print(f"📋 Trovati {len(txt_files)} file di export da elaborare...\n")

    total_inserted = 0
    total_skipped = 0

    for file_path in txt_files:
        filename = os.path.basename(file_path)
        # Riconoscimento automatico del gruppo dal nome del file
        detected_group = "Diga Team"
        for g in ALLOWED_GROUPS:
            if g.lower().replace(' ', '') in filename.lower().replace(' ', ''):
                detected_group = g
                break

        print(f"📄 Elaborazione '{filename}' -> Gruppo Assegnato: [{detected_group}]")
        parsed_msgs = parse_whatsapp_export(file_path, detected_group)
        print(f"  ↳ Estratti {len(parsed_msgs)} messaggi dal file.")

        for msg in parsed_msgs:
            # Controllo anti-duplicati su Supabase (stesso timestamp, mittente e gruppo)
            existing = supabase.table('whatsapp_messages') \
                .select('id') \
                .eq('group_name', msg['group_name']) \
                .eq('timestamp', msg['timestamp']) \
                .eq('sender', msg['sender']) \
                .execute()

            if existing.data and len(existing.data) > 0:
                total_skipped += 1
                continue

            # Inserimento su Supabase
            ins_res = supabase.table('whatsapp_messages').insert(msg).execute()
            if ins_res.data:
                total_inserted += 1

    print("\n" + "=" * 60)
    print(f"🎉 INGESTIONE COMPLETATA: {total_inserted} Nuovi Messaggi Inseriti | {total_skipped} Duplicati Saltati.")
    print("=============================================================\n")

if __name__ == '__main__':
    folder = sys.argv[1] if len(sys.argv) > 1 else "whatsapp_exports"
    ingest_directory(folder)

import os
import sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8')

VPS_IP = "169.58.101.199"
VPS_USER = "root"
VPS_PASS = "Ctb021022"

def finish_setup():
    print(f"🔌 Connessione SSH a {VPS_USER}@{VPS_IP}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASS, timeout=15)
        print("✅ Connessione SSH OK!")

        commands = [
            # Installazione librerie Python da PyPI regolare
            "/opt/geokanban_services/venv/bin/pip install --upgrade pip",
            "/opt/geokanban_services/venv/bin/pip install fastapi uvicorn sentence-transformers",
            
            # Riavvio servizio embedding su PM2
            "pm2 restart geokanban-embedding-service || pm2 start /opt/geokanban_services/venv/bin/python --name 'geokanban-embedding-service' -- /opt/geokanban_services/vps_embedding_service.py",
            
            # Setup cartella e dipendenze per WhatsApp Live Bridge
            "cd /opt/geokanban_services && npm init -y",
            "cd /opt/geokanban_services && npm install @whiskeysockets/baileys @supabase/supabase-js dotenv qrcode-terminal"
        ]

        for cmd in commands:
            print(f"\n⚙️ Esecuzione remota: {cmd[:65]}...")
            stdin, stdout, stderr = ssh.exec_command(cmd)
            status = stdout.channel.recv_exit_status()
            out_txt = stdout.read().decode('utf-8')
            err_txt = stderr.read().decode('utf-8')
            if status == 0:
                print(f"  ✅ Successo!")
            else:
                print(f"  ⚠️ Status [{status}]: {err_txt[:200]}")

        # Upload files di progetto (whatsapp_live_bridge.mjs e .env.local)
        sftp = ssh.open_sftp()
        local_bridge = os.path.join("scripts", "whatsapp_live_bridge.mjs")
        remote_bridge = "/opt/geokanban_services/whatsapp_live_bridge.mjs"
        sftp.put(local_bridge, remote_bridge)
        print(f"📤 Upload completato: {remote_bridge}")

        local_env = ".env.local"
        remote_env = "/opt/geokanban_services/.env.local"
        sftp.put(local_env, remote_env)
        print(f"📤 Upload completato: {remote_env}")
        sftp.close()

        # Avvio del WhatsApp Live Bridge tramite PM2
        print("\n🚀 Avvio del WhatsApp Live Bridge su PM2...")
        stdin, stdout, stderr = ssh.exec_command("cd /opt/geokanban_services && pm2 start whatsapp_live_bridge.mjs --name 'whatsapp-live-bridge' && pm2 save")
        stdout.channel.recv_exit_status()
        print("✅ Processo whatsapp-live-bridge avviato su PM2!")

        # Controllo status PM2
        stdin, stdout, stderr = ssh.exec_command("pm2 status")
        print(f"\n📋 STATO PROCESSI PM2 SUL VPS:\n{stdout.read().decode('utf-8')}")

    except Exception as e:
        print(f"❌ Errore durante il completamento del setup: {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    finish_setup()

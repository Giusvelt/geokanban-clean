import os
import sys
import time

sys.stdout.reconfigure(encoding='utf-8')

import paramiko

VPS_IP = "169.58.101.199"
VPS_USER = "root"
VPS_PASS = "Ctb021022"

def run_remote_commands():
    print(f"🔌 Connessione SSH a {VPS_USER}@{VPS_IP}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASS, timeout=15)
        print("✅ Connessione SSH stabilita con successo!")
        
        commands = [
            # 1. Update minimale del sistema
            "apt-get update -y && apt-get install -y curl python3-pip python3-venv git",
            
            # 2. Installazione Node.js 20 & PM2
            "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
            "apt-get install -y nodejs",
            "npm install -g pm2",
            
            # 3. Creazione directory di lavoro isolata e leggera
            "mkdir -p /opt/geokanban_services",
            
            # 4. Creazione virtualenv python per non inquinare il sistema
            "python3 -m venv /opt/geokanban_services/venv",
            "/opt/geokanban_services/venv/bin/pip install --no-cache-dir fastapi uvicorn sentence-transformers torch --index-url https://download.pytorch.org/whl/cpu"
        ]

        for cmd in commands:
            print(f"\n⚙️ Esecuzione remota: {cmd[:60]}...")
            stdin, stdout, stderr = ssh.exec_command(cmd)
            exit_status = stdout.channel.recv_exit_status()
            
            if exit_status == 0:
                print(f"  ✅ OK ({cmd[:30]})")
            else:
                err_msg = stderr.read().decode('utf-8')
                print(f"  ⚠️ Warning/Errore [{exit_status}]: {err_msg[:150]}")

        # 5. Upload del microservizio vps_embedding_service.py
        sftp = ssh.open_sftp()
        local_embed_script = os.path.join("scripts", "vps_embedding_service.py")
        remote_embed_script = "/opt/geokanban_services/vps_embedding_service.py"
        sftp.put(local_embed_script, remote_embed_script)
        print(f"\n📤 Caricato script: {remote_embed_script}")
        sftp.close()

        # 6. Avvio servizio tramite PM2
        pm2_cmd = "pm2 start /opt/geokanban_services/venv/bin/python --name 'geokanban-embedding-service' -- /opt/geokanban_services/vps_embedding_service.py && pm2 save"
        stdin, stdout, stderr = ssh.exec_command(pm2_cmd)
        stdout.channel.recv_exit_status()
        print("🚀 Servizio Embedding avviato su PM2!")

        # 7. Verifica dello spazio disco rimanente
        stdin, stdout, stderr = ssh.exec_command("df -h /")
        df_output = stdout.read().decode('utf-8')
        print(f"\n📊 SPAZIO DISCO RIMANENTE SUL VPS:\n{df_output}")

    except Exception as e:
        print(f"❌ Errore durante il deploy remoto: {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    run_remote_commands()

import paramiko
import os
import sys
import time

sys.stdout.reconfigure(encoding='utf-8')

VPS_IP = "169.58.101.199"
VPS_USER = "root"
VPS_PASS = os.getenv("VPS_PASSWORD", "Ctb021022")

def run_ssh_command(ssh, cmd):
    print(f"🔧 [VPS COMMAND]: {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    exit_status = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8")
    err = stderr.read().decode("utf-8")
    if out:
        print(f"   [STDOUT]:\n{out.strip()}")
    if err and exit_status != 0:
        print(f"   [STDERR]:\n{err.strip()}")
    return exit_status, out, err

def deploy_docker():
    print(f"\n=============================================================")
    print(f"🚀 GEOKANBAN DOCKER DEPLOYMENT SU VPS CONTABO ({VPS_IP})")
    print(f"=============================================================\n")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    print(f"🔑 Connessione SSH a {VPS_USER}@{VPS_IP}...")
    ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASS, timeout=15)
    print("✅ Connessione SSH riuscita!")

    # 1. Installa Docker e Docker Compose se mancanti
    print("\n📦 Verifica ed Installazione Docker Engine + Docker Compose...")
    cmd_install = """
    if ! command -v docker &> /dev/null; then
        apt-get update && apt-get install -y docker.io docker-compose-v2
        systemctl enable --now docker
    fi
    """
    run_ssh_command(ssh, cmd_install)

    # 2. Ferma i processi PM2 nativi per liberare le porte
    print("\n🛑 Arresto temporaneo processi PM2 nativi...")
    run_ssh_command(ssh, "pm2 stop all && pm2 save")

    # 3. Prepara la cartella /opt/geokanban_docker
    print("\n📁 Creazione cartella /opt/geokanban_docker...")
    run_ssh_command(ssh, "mkdir -p /opt/geokanban_docker /opt/geokanban_docker/scratch")

    # 4. Sposta la sessione Baileys esistente per preservare l'accoppiamento WhatsApp!
    print("\n🔄 Preservazione sessione WhatsApp (auth_info_baileys)...")
    run_ssh_command(ssh, "if [ -d '/opt/geokanban_services/auth_info_baileys' ]; then cp -r /opt/geokanban_services/auth_info_baileys /opt/geokanban_docker/; fi")

    # 5. Trasferimento file Docker tramite SFTP
    sftp = ssh.open_sftp()
    
    files_to_transfer = [
        ("docker/Dockerfile.embedding", "/opt/geokanban_docker/Dockerfile.embedding"),
        ("docker/Dockerfile.bridge", "/opt/geokanban_docker/Dockerfile.bridge"),
        ("docker/requirements.txt", "/opt/geokanban_docker/requirements.txt"),
        ("docker/bridge_package.json", "/opt/geokanban_docker/bridge_package.json"),
        ("docker/docker-compose.yml", "/opt/geokanban_docker/docker-compose.yml"),
        ("scripts/vps_embedding_service.py", "/opt/geokanban_docker/vps_embedding_service.py"),
        ("scripts/whatsapp_live_bridge.mjs", "/opt/geokanban_docker/whatsapp_live_bridge.mjs"),
        ("package.json", "/opt/geokanban_docker/package.json"),
        (".env.local", "/opt/geokanban_docker/.env.local"),
    ]

    for local_p, remote_p in files_to_transfer:
        if os.path.exists(local_p):
            print(f"  📤 Trasferimento {local_p} -> {remote_p}")
            sftp.put(local_p, remote_p)

    sftp.close()

    # 6. Avvio dei container Docker Compose
    print("\n🐋 Avvio dei Container Docker Compose (`docker compose up -d --build`)...")
    run_ssh_command(ssh, "cd /opt/geokanban_docker && docker compose up -d --build")

    # 7. Verifica stato dei container
    time.sleep(5)
    print("\n🔍 Verifica Stato Container Docker:")
    run_ssh_command(ssh, "docker ps")

    # 8. Test Endpoint /health del Microservizio Embedding in Docker
    print("\n🧪 Test Endpoint HTTP /health su porta 8000...")
    _, out_h, _ = run_ssh_command(ssh, "curl -s http://localhost:8000/health")
    
    if "all-mpnet-base-v2" in out_h:
        print("\n=============================================================")
        print("🎉 GEOKANBAN DOCKER MIGRATE COMPLETATO CON ESITO POSITIVO!")
        print("   GeoKanban è ora isolato al 100% nei container Docker!")
        print("=============================================================\n")
    else:
        print("⚠️ Attenzione: Il servizio potrebbe richiedere ancora qualche secondo per avviarsi.")

    ssh.close()

if __name__ == "__main__":
    deploy_docker()

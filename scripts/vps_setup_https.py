import paramiko
import os
import sys
import time

sys.stdout.reconfigure(encoding='utf-8')

VPS_IP = "169.58.101.199"
VPS_USER = "root"
VPS_PASS = os.getenv("VPS_PASSWORD", "Ctb021022")

DOMAIN = "169-58-101-199.sslip.io"

def setup_https_caddy():
    print(f"\n=============================================================")
    print(f"🔒 CONFIGURAZIONE HTTPS AUTOMATICO SSL PER VERCEL (Caddy + sslip.io)")
    print(f"=============================================================\n")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    print(f"🔑 Connessione SSH a {VPS_USER}@{VPS_IP}...")
    ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASS, timeout=15)
    print("✅ Connessione SSH riuscita!")

    # 1. Installa Caddy Web Server (con gestione automatica SSL HTTPS)
    install_caddy_cmd = """
    if ! command -v caddy &> /dev/null; then
        apt-get update && apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg --yes
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
        apt-get update && apt-get install -y caddy
    fi
    """
    print("\n📦 Verifica ed Installazione Caddy Reverse Proxy con SSL...")
    stdin, stdout, stderr = ssh.exec_command(install_caddy_cmd)
    stdout.channel.recv_exit_status()

    # 2. Configura Caddyfile per invertire il proxy HTTPS -> localhost:8000
    caddyfile_content = f"""
{DOMAIN} {{
    reverse_proxy localhost:8000
}}
"""
    print(f"\n⚙️ Scrittura Caddyfile per il dominio HTTPS https://{DOMAIN}...")
    stdin, stdout, stderr = ssh.exec_command(f"cat << 'EOF' > /etc/caddy/Caddyfile\n{caddyfile_content}\nEOF")
    stdout.channel.recv_exit_status()

    # 3. Riavvia Caddy
    print("\n🔄 Riavvio Caddy per l'emissione del certificato SSL HTTPS...")
    stdin, stdout, stderr = ssh.exec_command("systemctl restart caddy")
    stdout.channel.recv_exit_status()

    time.sleep(5)

    # 4. Test HTTPS endpoint
    print(f"\n🧪 Test Endpoint HTTPS pubblico su https://{DOMAIN}/health...")
    stdin, stdout, stderr = ssh.exec_command(f"curl -s https://{DOMAIN}/health")
    out = stdout.read().decode('utf-8')
    print(f"   [RISPOSTA HTTPS]: {out}")

    ssh.close()

if __name__ == "__main__":
    setup_https_caddy()

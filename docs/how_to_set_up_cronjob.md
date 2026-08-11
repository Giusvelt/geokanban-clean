# Guida Operativa: Schedulazione del Cronjob di Raffinamento Retroattivo

Questa guida illustra come schedulare l'esecuzione automatica dello script `scratch/retroactive_precision_alignment.mjs` ogni notte dopo la mezzanotte per mantenere il database pulito, economico e accurato al minuto.

---

## Opzione 1: GitHub Actions (Consigliata & Gratuita 🌟)

È il metodo più semplice, robusto e gratuito. Non richiede server aggiuntivi e invia notifiche in caso di errore.

### Istruzioni:
1. Nella radice del progetto, crea una cartella `.github/workflows/` (se non esiste).
2. Crea un file chiamato `retroactive_alignment.yml` con il seguente contenuto:

```yaml
name: GeoKanban Retroactive Precision Alignment

on:
  schedule:
    # Esegue ogni notte alle 01:30 UTC (02:30 in Italia)
    - cron: '30 1 * * *'
  workflow_dispatch: # Permette l'esecuzione manuale da GitHub

jobs:
  align:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci --omit=dev

      - name: Run Precision Alignment
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          VITE_DATADOCKED_API_KEY: ${{ secrets.VITE_DATADOCKED_API_KEY }}
        run: node scratch/retroactive_precision_alignment.mjs
```

3. Carica il file su GitHub.
4. Vai su **Settings ➔ Secrets and variables ➔ Actions** del tuo repository GitHub ed aggiungi le 3 variabili d'ambiente come **Repository Secrets**:
   * `VITE_SUPABASE_URL`
   * `SUPABASE_SERVICE_ROLE_KEY`
   * `VITE_DATADOCKED_API_KEY`

---

## Opzione 2: Supabase pg_cron + Edge Function (Nativa Cloud 🗄️)

Se preferisci mantenere tutto all'interno dell'infrastruttura Supabase, puoi creare una Edge Function ed attivarla tramite l'estensione `pg_cron`.

### Step 1: Crea una Edge Function
Crea una Edge Function chiamata `retroactive-alignment` che riproduce la logica dello script JS o richiama un endpoint sicuro.

### Step 2: Schedula pg_cron in Supabase
Apri il **SQL Editor** del pannello Supabase ed esegui la query per attivare la schedulazione ogni notte:

```sql
-- Abilita l'estensione se non già presente
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedula la chiamata alla Edge Function alle 01:30 ogni notte
SELECT cron.schedule(
    'retroactive-precision-alignment',
    '30 1 * * *',
    $$
    SELECT net.http_post(
        url:='https://voeuvmjbaqvvwfnivkvz.supabase.co/functions/v1/retroactive-alignment',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer IL_TUO_SERVICE_ROLE_KEY"}'::jsonb
    ) as request_id;
    $$
);
```

---

## Opzione 3: Trigger Esterno (es. cron-job.org o Vercel Cron)

Se utilizzi già un servizio esterno (come `cron-job.org`) per chiamare periodicamente le tue Edge Function di live tracking:
1. Crea un endpoint sicuro all'interno della tua applicazione Vercel (es. `/api/cron/retroactive-alignment`).
2. Proteggi l'endpoint verificando un header di autorizzazione (es. `Authorization: Bearer ${CRON_SECRET}`).
3. Configura `cron-job.org` per effettuare una richiesta `POST` a questo URL una volta al giorno alle ore **02:00** (ora locale).

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("❌ VITE_GEMINI_API_KEY non trovata.");
  process.exit(1);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Funzione con AUTO-RETRY su Errore 429 (Rate Limit) ed Exponential Backoff
async function generateRealEmbeddingWithRetry(text, retries = 5, delay = 2000) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { parts: [{ text: text }] },
          outputDimensionality: 768
        })
      });

      if (res.status === 429) {
        console.warn(`⚠️ Rate limit Google (429). Tentativo ${attempt}/${retries}. Attesa di ${delay/1000}s...`);
        await sleep(delay);
        delay *= 2; // Raddoppia l'attesa (Exponential Backoff)
        continue;
      }

      if (!res.ok) {
        console.error(`Errore API Gemini (${res.status}): ${res.statusText}`);
        return null;
      }

      const data = await res.json();
      return data?.embedding?.values || null;
    } catch (err) {
      console.error(`Errore di rete Gemini (Tentativo ${attempt}):`, err.message);
      await sleep(delay);
    }
  }
  return null;
}

async function vectorizeHistoricalMessages() {
  console.log("\n=============================================================");
  console.log("🚀 VETTORIALIZZAZIONE ROBUSTA (ANTI-429 RE-TRY / DAL 01/01/2026)");
  console.log("=============================================================\n");

  const batchSize = 50;
  let processedTotal = 0;
  
  const startDate = '2026-01-01T00:00:00Z';
  const endDate = '2026-07-27T23:59:59Z';
  const allowedGroups = ['+ Survey x la  Diga', 'Diga Team', 'SIDER-FIOM', 'ZETA PGBW'];

  while (true) {
    const { data: messages, error } = await supabase
      .from('whatsapp_messages')
      .select('id, message_text, sender, timestamp, group_name')
      .gte('timestamp', startDate)
      .lte('timestamp', endDate)
      .in('group_name', allowedGroups)
      .is('embedding', null)
      .order('timestamp', { ascending: true })
      .limit(batchSize);

    if (error) {
      console.error("Errore query Supabase:", error);
      await sleep(5000);
      continue;
    }

    if (!messages || messages.length === 0) {
      console.log(`\n🎉 NESSUN ALTRO MESSAGGIO DA VETTORIALIZZARE NEL PERIODO INDICATO!`);
      break;
    }

    const firstDate = messages[0]?.timestamp ? new Date(messages[0].timestamp).toLocaleString('it-IT') : 'N/D';
    const lastDate = messages[messages.length - 1]?.timestamp ? new Date(messages[messages.length - 1].timestamp).toLocaleString('it-IT') : 'N/D';

    console.log(`📦 Batch ${messages.length} msg | Totale vettorializzati: ${processedTotal} | Fronte temporale: [${firstDate}] -> [${lastDate}]`);

    for (const msg of messages) {
      const textToEmbed = `[Data: ${msg.timestamp}] [Gruppo: ${msg.group_name}] ${msg.sender || 'Anonimo'}: ${msg.message_text || ''}`;
      
      const embedding = await generateRealEmbeddingWithRetry(textToEmbed);
      
      if (embedding) {
        const { error: updErr } = await supabase
          .from('whatsapp_messages')
          .update({ embedding: JSON.stringify(embedding) })
          .eq('id', msg.id);
          
        if (updErr) {
          console.error(`Errore salvataggio ID ${msg.id}:`, updErr.message);
        } else {
          processedTotal++;
        }
      }
      
      // Pausa di 600ms per mantenere il ritmo sotto la quota gratuita di Google
      await sleep(600); 
    }
  }

  console.log(`\n✅ SCRIPT TERMINATO. Elaborazione completata.`);
  process.exit(0);
}

vectorizeHistoricalMessages();

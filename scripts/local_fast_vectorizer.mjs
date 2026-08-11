import { pipeline } from '@xenova/transformers';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runLocalVectorizer() {
  console.log("=============================================================");
  console.log("⚡ VETTORIALIZZATORE LOCALE HYPER-SPEED (ONNX / Transformers.js)");
  console.log("=============================================================\n");

  console.log("📦 Caricamento modello locale 'Xenova/all-mpnet-base-v2' (768 dimensioni)...");
  // Modello ONNX che genera vettori a 768 dimensioni a massima velocità su CPU locale
  const extractor = await pipeline('feature-extraction', 'Xenova/all-mpnet-base-v2');
  console.log("✅ Modello locale caricato con successo in memoria!\n");

  const batchSize = 100;
  let totalProcessed = 0;
  const startDate = '2026-01-01T00:00:00Z';
  const endDate = '2026-07-27T23:59:59Z';
  const allowedGroups = ['+ Survey x la  Diga', 'Diga Team', 'SIDER-FIOM', 'ZETA PGBW'];

  const startTime = Date.now();

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
      console.error("Errore query Supabase:", error.message);
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    if (!messages || messages.length === 0) {
      console.log("\n🎉 TUTTI I MESSAGGI SONO STATI VETTORIALIZZATI IN LOCALE!");
      break;
    }

    const firstDate = messages[0]?.timestamp ? new Date(messages[0].timestamp).toLocaleString('it-IT') : 'N/D';
    const lastDate = messages[messages.length - 1]?.timestamp ? new Date(messages[messages.length - 1].timestamp).toLocaleString('it-IT') : 'N/D';

    console.log(`⚡ Elaborazione batch di ${messages.length} msg | Totale: ${totalProcessed} | Periodo: [${firstDate}] -> [${lastDate}]`);

    for (const msg of messages) {
      const textToEmbed = `[Data: ${msg.timestamp}] [Gruppo: ${msg.group_name}] ${msg.sender || 'Anonimo'}: ${msg.message_text || ''}`;

      // Generazione VETTORIALE LOCALE senza passare da Internet o API Key (Zero 429)
      const output = await extractor(textToEmbed, { pooling: 'mean', normalize: true });
      const embeddingArray = Array.from(output.data);

      const { error: updErr } = await supabase
        .from('whatsapp_messages')
        .update({ embedding: JSON.stringify(embeddingArray) })
        .eq('id', msg.id);

      if (!updErr) {
        totalProcessed++;
      }
    }

    const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);
    const speedPerMin = Math.round(totalProcessed / (elapsedMin || 1));
    console.log(`📈 Stato: ${totalProcessed} messaggi salvati | Velocità: ${speedPerMin} msg/minuto`);
  }

  console.log("\n✅ ESECUZIONE LOCALE COMPLETATA CON SUCCESSO.");
  process.exit(0);
}

runLocalVectorizer();

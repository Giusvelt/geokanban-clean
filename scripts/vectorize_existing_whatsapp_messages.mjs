import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function generateEmbedding(text) {
  const dims = 768;
  const vec = new Array(dims).fill(0);
  const words = (text || '').toLowerCase().match(/\w+/g) || [];
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = (hash * 31 + word.charCodeAt(j)) % dims;
    }
    vec[hash] += 1.0;
  }

  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0)) || 1.0;
  return vec.map(v => parseFloat((v / norm).toFixed(6)));
}

async function vectorizeWhatsAppMessages() {
  console.log("\n=============================================================");
  console.log("💬 VETTORIALIZZAZIONE MESSAGGI WHATSAPP DI CANTIERE REAL-TIME");
  console.log("=============================================================\n");

  const { data: messages, error } = await supabase
    .from('whatsapp_messages')
    .select('id, message_text, sender, group_name')
    .is('embedding', null)
    .limit(500);

  if (error) {
    console.error("Errore recupero messaggi:", error);
    return;
  }

  console.log(`🔎 Trovati ${messages?.length || 0} messaggi WhatsApp da vettorializzare...`);

  let count = 0;
  for (const msg of (messages || [])) {
    if (msg.message_text) {
      const textToEmbed = `${msg.sender || 'Anonimo'}: ${msg.message_text}`;
      const vec = generateEmbedding(textToEmbed);

      await supabase
        .from('whatsapp_messages')
        .update({ embedding: vec })
        .eq('id', msg.id);

      count++;
    }
  }

  console.log(`\n🎉 COMPLETATO! ${count} messaggi WhatsApp ora vettorializzati e ricercabili su Supabase!`);
}

vectorizeWhatsAppMessages();

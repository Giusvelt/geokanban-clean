import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Generazione embedding vettoriale deterministico (768 dimensioni per pgvector)
async function generateEmbedding(text) {
  const dims = 768;
  const vec = new Array(dims).fill(0);
  const words = text.toLowerCase().match(/\w+/g) || [];
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = (hash * 31 + word.charCodeAt(j)) % dims;
    }
    vec[hash] += 1.0;
  }

  // Normalizzazione L2 del vettore
  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0)) || 1.0;
  return vec.map(v => parseFloat((v / norm).toFixed(6)));
}

async function vectorizeHistoricalConversations() {
  console.log("\n=============================================================");
  console.log("🧠 INDICIZZAZIONE VETTORIALE CONVERSAZIONI & HANDOVER STORICI");
  console.log("=============================================================\n");

  const orientationDir = path.join(process.cwd(), 'AGENT_ORIENTATION');
  const knowledgeDir = path.join(process.cwd(), '.agents', 'knowledge');

  let totalChunks = 0;

  // 1. Processa AGENT_ORIENTATION
  if (fs.existsSync(orientationDir)) {
    const files = fs.readdirSync(orientationDir);
    for (const file of files) {
      const fullPath = path.join(orientationDir, file);
      if (fs.statSync(fullPath).isFile() && file.endsWith('.md')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const sections = content.split('\n## ').filter(s => s.trim().length > 30);

        for (const sec of sections) {
          const chunkText = '## ' + sec;
          const vec = await generateEmbedding(chunkText);

          if (vec) {
            await supabase.from("conversation_logs_embeddings").insert({
              conversation_id: 'GEOKANBAN_HANDOVER_HISTORY',
              speaker: 'SYSTEM',
              topic_summary: file,
              chunk_content: chunkText,
              embedding: vec
            });
            totalChunks++;
          }
        }
        console.log(`✅ [Handover History Vectorized] ${file}`);
      }
    }
  }

  // 2. Processa KI locali (.agents/knowledge)
  if (fs.existsSync(knowledgeDir)) {
    const items = fs.readdirSync(knowledgeDir);
    for (const item of items) {
      const fullPath = path.join(knowledgeDir, item);
      if (fs.statSync(fullPath).isFile() && item.endsWith('.md')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const sections = content.split('\n## ').filter(s => s.trim().length > 30);

        for (const sec of sections) {
          const chunkText = '## ' + sec;
          const vec = await generateEmbedding(chunkText);

          if (vec) {
            await supabase.from("project_knowledge_embeddings").insert({
              ki_name: item.replace('.md', ''),
              file_path: `.agents/knowledge/${item}`,
              chunk_content: chunkText,
              embedding: vec
            });
            totalChunks++;
          }
        }
        console.log(`✅ [KI Local Vectorized] ${item}`);
      }
    }
  }

  console.log(`\n🎉 INDICIZZAZIONE COMPLETATA! ${totalChunks} vettori memorizzati su Supabase!`);
}

vectorizeHistoricalConversations();

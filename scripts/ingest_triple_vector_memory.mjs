import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Funzione per generare embedding vettoriale tramite Gemini API
async function generateEmbedding(text) {
  const geminiApiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!geminiApiKey) return null;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text: text.substring(0, 2048) }] }
      })
    });
    const data = await res.json();
    return data.embedding?.values || null;
  } catch (e) {
    return null;
  }
}

async function ingestTripleVectorMemory() {
  console.log("\n=============================================================");
  console.log("🚀 POPOLAMENTO VETTORIALE TRUPLO (KI, CONVERSAZIONI, CODICE)");
  console.log("=============================================================\n");

  // 1. INGESTION KI (Pilastro 1)
  const kiDir = path.join(process.cwd(), '.agents', 'knowledge');
  if (fs.existsSync(kiDir)) {
    const files = fs.readdirSync(kiDir);
    for (const file of files) {
      const fullPath = path.join(kiDir, file);
      if (fs.statSync(fullPath).isFile() && file.endsWith('.md')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const chunks = content.split('\n## ').filter(c => c.trim().length > 20);

        for (const chunk of chunks) {
          const chunkText = '## ' + chunk;
          const vec = await generateEmbedding(chunkText);
          await supabase.from("project_knowledge_embeddings").insert({
            ki_name: file.replace('.md', ''),
            file_path: `.agents/knowledge/${file}`,
            chunk_content: chunkText,
            embedding: vec
          });
        }
        console.log(`✅ [KI Vectorized] ${file}`);
      }
    }
  }

  // 2. INGESTION CONVERSAZIONI / ORIENTAMENTO (Pilastro 2)
  const orientationDir = path.join(process.cwd(), 'AGENT_ORIENTATION');
  if (fs.existsSync(orientationDir)) {
    const files = fs.readdirSync(orientationDir);
    for (const file of files) {
      const fullPath = path.join(orientationDir, file);
      if (fs.statSync(fullPath).isFile() && file.endsWith('.md')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const chunks = content.split('\n## ').filter(c => c.trim().length > 20);

        for (const chunk of chunks) {
          const chunkText = '## ' + chunk;
          const vec = await generateEmbedding(chunkText);
          await supabase.from("conversation_logs_embeddings").insert({
            conversation_id: 'HANDOVER_SYNTHESIS',
            speaker: 'SYSTEM',
            topic_summary: file,
            chunk_content: chunkText,
            embedding: vec
          });
        }
        console.log(`✅ [Conversation Vectorized] ${file}`);
      }
    }
  }

  // 3. INGESTION CODICE SORGENTE CHIAVE (Pilastro 3)
  const codeFiles = [
    'src/components/VesselActivityTab.jsx',
    'src/components/LogbookWriterTab.jsx',
    'src/components/LogbookEntryModal.jsx',
    'src/store/useActivityStore.js',
    'supabase/functions/geokanban-tracker/index.ts',
    'supabase/functions/geokanban-ai-logbook/index.ts'
  ];

  for (const relPath of codeFiles) {
    const fullPath = path.join(process.cwd(), relPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i += 40) {
        const chunkText = lines.slice(i, i + 40).join('\n');
        if (chunkText.trim().length > 30) {
          const vec = await generateEmbedding(chunkText);
          await supabase.from("codebase_ast_embeddings").insert({
            file_path: relPath,
            symbol_name: path.basename(relPath),
            symbol_type: relPath.includes('supabase') ? 'edge_function' : 'frontend_component',
            chunk_content: chunkText,
            embedding: vec
          });
        }
      }
      console.log(`✅ [Codebase Vectorized] ${relPath}`);
    }
  }

  console.log("\n=============================================================");
  console.log("🎉 MEMORIA VETTORIALE TRIPLA ATTIVATA CON SUCCESSO SU SUPABASE!");
  console.log("=============================================================\n");
}

ingestTripleVectorMemory();

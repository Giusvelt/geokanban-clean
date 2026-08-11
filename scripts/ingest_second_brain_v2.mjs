// ══════════════════════════════════════════════════════════════════════════════
// GeoKanban Second Brain v2 — Ingest Pipeline con Embedding Neurali Gemini
// Date: 2026-07-26
// 
// Differenze rispetto a vectorize_all_historical_conversations.mjs:
//   1. Usa Gemini text-embedding-004 (semantico reale) invece di hash deterministico
//   2. Aggiunge un contextual_header a ogni chunk (enrichment senza LLM extra)
//   3. Scrive nelle tabelle _v2 (non distruttivo — le vecchie rimangono intatte)
// ══════════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ VITE_GEMINI_API_KEY mancante in .env.local');
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. EMBEDDING NEURALE REALE via Gemini text-embedding-004
//    768 dimensioni — compatibile con lo schema pgvector esistente
// ──────────────────────────────────────────────────────────────────────────────
async function generateEmbedding(text, retries = 3) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { parts: [{ text: text.substring(0, 8000) }] },
          outputDimensionality: 768
        })
      });

      if (response.status === 429) {
        console.log(`    ⏳ Rate limit 429 raggiunto. Pausa di 10s prima del riprovare (tentativo ${attempt + 1}/${retries})...`);
        await sleep(10000);
        continue;
      }

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Gemini API error: ${response.status} — ${err}`);
      }

      const data = await response.json();
      const values = data?.embedding?.values;

      if (!values || values.length !== 768) {
        throw new Error(`Dimensioni embedding inattese: ${values?.length}`);
      }

      return values;
    } catch (err) {
      if (attempt === retries) {
        console.error(`  ⚠️  Embedding fallito definitivamente: ${err.message}`);
        return null;
      }
      await sleep(2000);
    }
  }
  return null;
}


// ──────────────────────────────────────────────────────────────────────────────
// 2. CONTEXTUAL ENRICHMENT — Header costruito dai metadati del file
//    Nessuna chiamata LLM aggiuntiva. Costo: zero.
// ──────────────────────────────────────────────────────────────────────────────
function buildContextualHeader(fileName, sourceType, sectionTitle) {
  const today = new Date().toISOString().split('T')[0];
  return `[File: ${fileName} | Tipo: ${sourceType} | Sezione: "${sectionTitle}" | Data: ${today}]`;
}

// ──────────────────────────────────────────────────────────────────────────────
// 3. CHUNKING PER HEADING MARKDOWN
//    Mantiene il contesto semantico completo di ogni sezione.
// ──────────────────────────────────────────────────────────────────────────────
function chunkByHeadings(content) {
  const raw = content.split(/\n(?=##? )/).filter(s => s.trim().length > 50);
  return raw.map(s => s.trim());
}

function extractSectionTitle(chunk) {
  const firstLine = chunk.split('\n')[0];
  return firstLine.replace(/^#+\s*/, '').trim() || 'Sezione';
}

// ──────────────────────────────────────────────────────────────────────────────
// 4. RATE LIMITING — Rispetta i limiti dell'API Gemini (1500 req/min)
// ──────────────────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ──────────────────────────────────────────────────────────────────────────────
// 5. PIPELINE PRINCIPALE
// ──────────────────────────────────────────────────────────────────────────────
async function ingestSecondBrainV2() {
  console.log('\n=================================================================');
  console.log('🧠 SECOND BRAIN v2 — INGEST CON EMBEDDING GEMINI NEURALI REALI');
  console.log('=================================================================\n');
  console.log('⚡ Embedding: Gemini text-embedding-004 (semantico, 768 dim)');
  console.log('📝 Tabelle target: project_knowledge_embeddings_v2');
  console.log('                   conversation_logs_embeddings_v2');
  console.log('✅ Non distruttivo: tabelle originali (hash) rimangono intatte\n');

  const orientationDir = path.join(process.cwd(), 'AGENT_ORIENTATION');
  const knowledgeDir = path.join(process.cwd(), '.agents', 'knowledge');
  let totalChunks = 0;
  let failedChunks = 0;

  // ── AGENT_ORIENTATION → conversation_logs_embeddings_v2 ──────────────────
  console.log('📂 Processando AGENT_ORIENTATION/...');
  if (fs.existsSync(orientationDir)) {
    const files = fs.readdirSync(orientationDir)
      .filter(f => f.endsWith('.md'));

    for (const file of files) {
      const fullPath = path.join(orientationDir, file);
      const content = fs.readFileSync(fullPath, 'utf8');
      const chunks = chunkByHeadings(content);
      let fileChunks = 0;

      for (const chunk of chunks) {
        const sectionTitle = extractSectionTitle(chunk);
        const header = buildContextualHeader(file, 'HANDOVER_HISTORY', sectionTitle);
        const fullText = `${header}\n${chunk}`;

        const embedding = await generateEmbedding(fullText);
        await sleep(700); // 700ms pacing = ~85 req/min (sotto la quota di 100 RPM)


        if (embedding) {
          const { error } = await supabase
            .from('conversation_logs_embeddings_v2')
            .insert({
              conversation_id: 'GEOKANBAN_HANDOVER_HISTORY',
              speaker: 'SYSTEM',
              topic_summary: sectionTitle,
              contextual_header: header,
              chunk_content: chunk,
              embedding
            });

          if (error) {
            console.error(`    ❌ DB error: ${error.message}`);
            failedChunks++;
          } else {
            fileChunks++;
            totalChunks++;
          }
        } else {
          failedChunks++;
        }
      }

      console.log(`  ✅ ${file} — ${fileChunks} chunk vettorializzati`);
    }
  }

  // ── .agents/knowledge/ → project_knowledge_embeddings_v2 ─────────────────
  console.log('\n📂 Processando .agents/knowledge/...');
  if (fs.existsSync(knowledgeDir)) {
    const items = fs.readdirSync(knowledgeDir)
      .filter(f => f.endsWith('.md'));

    for (const item of items) {
      const fullPath = path.join(knowledgeDir, item);
      const content = fs.readFileSync(fullPath, 'utf8');
      const chunks = chunkByHeadings(content);
      let fileChunks = 0;

      for (const chunk of chunks) {
        const sectionTitle = extractSectionTitle(chunk);
        const header = buildContextualHeader(item, 'KI_LOCAL', sectionTitle);
        const fullText = `${header}\n${chunk}`;

        const embedding = await generateEmbedding(fullText);
        await sleep(50);

        if (embedding) {
          const { error } = await supabase
            .from('project_knowledge_embeddings_v2')
            .insert({
              ki_name: item.replace('.md', ''),
              file_path: `.agents/knowledge/${item}`,
              contextual_header: header,
              chunk_content: chunk,
              embedding
            });

          if (error) {
            console.error(`    ❌ DB error: ${error.message}`);
            failedChunks++;
          } else {
            fileChunks++;
            totalChunks++;
          }
        } else {
          failedChunks++;
        }
      }

      console.log(`  ✅ ${item} — ${fileChunks} chunk vettorializzati`);
    }
  }

  // ── REPORT FINALE ─────────────────────────────────────────────────────────
  console.log('\n=================================================================');
  console.log(`🎉 INGEST COMPLETATO!`);
  console.log(`   ✅ Chunk scritti con successo : ${totalChunks}`);
  if (failedChunks > 0) {
    console.log(`   ⚠️  Chunk falliti             : ${failedChunks}`);
  }
  console.log('\n📋 PROSSIMI PASSI:');
  console.log('   1. Testa la qualità: esegui una query semantica su Supabase');
  console.log('      SELECT * FROM search_second_brain_v2(\'<embedding>\', \'ALL\', 0.45, 5)');
  console.log('   2. Se soddisfatto, aggiorna la RPC principale su search_second_brain_v2');
  console.log('   3. Le tabelle originali (_senza_ _v2) restano intatte finché non confermi');
  console.log('=================================================================\n');
}

ingestSecondBrainV2().catch(err => {
  console.error('❌ Errore fatale:', err);
  process.exit(1);
});

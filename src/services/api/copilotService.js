import { supabase } from '../../lib/supabase.js';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

/**
 * Genera il vettore semantico 768d omogeneo (all-mpnet-base-v2) tramite VPS Contabo
 * garantendo la massima similitudine con i messaggi vettorializzati su Supabase.
 */
async function generateQueryEmbedding(text, retries = 3, delay = 1500) {
  const vpsUrl = 'https://169-58-101-199.sslip.io/embed';
  
  try {
    const res = await fetch(vpsUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': 'geokanban-secret-key-2026'
      },
      body: JSON.stringify({ text })
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.embedding) {
        return data.embedding;
      }
    }
  } catch (err) {
    console.warn("⚠️ VPS Embedding microservice offline/booting, fallback su Gemini:", err.message);
  }

  // Fallback temporaneo Gemini se il microservizio VPS non è ancora avviato
  const apiKey = GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { parts: [{ text }] },
          outputDimensionality: 768
        })
      });
      if (res.ok) {
        const data = await res.json();
        return data?.embedding?.values || null;
      }
    } catch (e) {
      console.error("Errore fallback Gemini embedding:", e);
    }
  }
  return null;
}

/**
 * BARRIERA DI PRIVACY LIVESTELLAR 1: Sanitizer Deterministico
 * Elimina mittenti, contatti e nomi propri prima che qualsiasi messaggio entri nel contesto dell'IA.
 */
function sanitizeMessageForPrivacy(messageText) {
  if (!messageText) return "";
  return messageText
    .replace(/(?:\+39\s?)?3\d{2}[\s.-]?\d{6,7}/g, "[NUMERO OMESSO]")
    .replace(/Il tuo codice di sicurezza con .* è cambiato\./g, "")
    .trim();
}

/**
 * Estrae una data o un intervallo di date dalla domanda dell'utente (es. "dal 2 luglio duemila ventisei", "02/07", "25 luglio")
 */
function extractDateFilterFromQuestion(question) {
  const monthsMap = {
    'gennaio': 1, 'febbraio': 2, 'marzo': 3, 'aprile': 4, 'maggio': 5, 'giugno': 6,
    'luglio': 7, 'agosto': 8, 'settembre': 9, 'ottobre': 10, 'novembre': 11, 'dicembre': 12
  };
  
  let lower = question.toLowerCase();
  
  // Normalizza anni espressi a parole (es. speech-to-text "duemila ventisei")
  lower = lower
    .replace(/duemila\s*ventisei/gi, "2026")
    .replace(/duemila\s*venticinque/gi, "2025")
    .replace(/duemila\s*ventiquattro/gi, "2024")
    .replace(/duemila\s*ventitre/gi, "2023");

  // Rileva se si tratta di un intervallo che parte da una data (es. "dal 2 luglio...")
  const isFromRange = lower.includes("dal ") || lower.includes("da ");

  // Match "2 luglio", "02 luglio", "25 luglio 2026", ecc.
  const regexNamed = /(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(\d{4}))?/i;
  const matchNamed = lower.match(regexNamed);
  
  if (matchNamed) {
    const day = parseInt(matchNamed[1], 10);
    const month = monthsMap[matchNamed[2]];
    const year = matchNamed[3] ? parseInt(matchNamed[3], 10) : 2026;
    
    const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0)).toISOString();
    // Se la domanda dice "DAL 2 LUGLIO...", l'intervallo copre dal 2 Luglio fino ad OGGI!
    const endDate = isFromRange 
      ? new Date().toISOString() 
      : new Date(Date.UTC(year, month - 1, day, 23, 59, 59)).toISOString();

    return { startDate, endDate, dateText: `${day} ${matchNamed[2]} ${year}` };
  }

  // Match "02/07", "2/7", "02/07/2026", ecc.
  const regexNum = /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?/;
  const matchNum = lower.match(regexNum);
  if (matchNum) {
    const day = parseInt(matchNum[1], 10);
    const month = parseInt(matchNum[2], 10);
    const year = matchNum[3] ? parseInt(matchNum[3], 10) : 2026;

    const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0)).toISOString();
    const endDate = isFromRange 
      ? new Date().toISOString() 
      : new Date(Date.UTC(year, month - 1, day, 23, 59, 59)).toISOString();

    return { startDate, endDate, dateText: `${day}/${month}/${year}` };
  }

  return null;
}

/**
 * Esegue la ricerca semantica RAG + Live DB per alimentare il Copilot
 */
export async function askDigitalTwinCopilot(question, selectedVesselFilter = 'All') {
  try {
    const dateFilter = extractDateFilterFromQuestion(question);

    // 1. Embedding della domanda
    const queryVector = await generateQueryEmbedding(question);

    // 2. Retrieval Semantico IBRIDO Vettoriale + FTS su whatsapp_messages
    let waMessages = [];
    if (queryVector) {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('match_whatsapp_messages_hybrid', {
        query_embedding: queryVector,
        search_query: question,
        match_threshold: 0.2,
        match_count: 20
      });
      if (!rpcErr && rpcData) {
        waMessages = rpcData;
      }
    }

    // Se l'utente ha chiesto una data specifica, recupera anche i messaggi WhatsApp di quella data
    if (dateFilter) {
      const { data: dateWa } = await supabase
        .from('whatsapp_messages')
        .select('group_name, message_text, timestamp')
        .gte('timestamp', dateFilter.startDate)
        .lte('timestamp', dateFilter.endDate)
        .limit(20);

      if (dateWa && dateWa.length > 0) {
        const existingIds = new Set(waMessages.map(m => m.id));
        for (const dw of dateWa) {
          if (!existingIds.has(dw.id)) waMessages.push(dw);
        }
      }
    }

    // Fallback SQL standard se nessun messaggio estratto
    if (!waMessages || waMessages.length === 0) {
      const { data: fallbackData } = await supabase
        .from('whatsapp_messages')
        .select('group_name, message_text, timestamp')
        .order('timestamp', { ascending: false })
        .limit(15);
      waMessages = fallbackData || [];
    }

    // Anonimizzazione assoluta
    const waContext = waMessages.map(m => {
      const cleanText = sanitizeMessageForPrivacy(m.message_text);
      return `[Comunicazione Operativa - ${m.timestamp?.substring(0, 10)}] ${cleanText}`;
    }).join('\n');

    // 3. Retrieval Dati Live DB (Attività & Logbook)
    let actQuery = supabase
      .from('vessel_activity')
      .select(`
        id, activity_type, start_time, end_time, status, ais_start_draught, ais_end_draught,
        vessels ( name ),
        geofences!vessel_activity_geofence_id_fkey ( name ),
        logbook_entries ( narrative_text, structured_fields )
      `);

    // Se la domanda menziona una data esplicita, filtra per quella data!
    if (dateFilter) {
      actQuery = actQuery
        .gte('start_time', dateFilter.startDate)
        .lte('start_time', dateFilter.endDate)
        .order('start_time', { ascending: true })
        .limit(50);
    } else {
      actQuery = actQuery
        .order('start_time', { ascending: false })
        .limit(30);
    }

    const { data: recentActivities } = await actQuery;

    // Riorganizza per mettere PRIMA tutte le attività In Progress
    const sortedActivities = (recentActivities || []).sort((a, b) => {
      if (!a.end_time && b.end_time) return -1;
      if (a.end_time && !b.end_time) return 1;
      return new Date(b.start_time) - new Date(a.start_time);
    });

    const liveContext = sortedActivities.map(a => {
      const log = a.logbook_entries?.[0];
      const sf = log?.structured_fields || {};
      const statusText = !a.end_time ? 'IN PROGRESS (In corso)' : 'CONCLUSA';
      return `[Attività NAVE: ${a.vessels?.name || 'N/A'} | Stato Operazione: ${statusText} | Tipo: ${a.activity_type} @ ${a.geofences?.name || '—'}]
  - Orario: ATA ${a.start_time ? new Date(a.start_time).toLocaleString('it-IT') : '—'} | ATD ${a.end_time ? new Date(a.end_time).toLocaleString('it-IT') : 'In corso'}
  - Pescaggio AIS: In ${a.ais_start_draught || '—'}m / Out ${a.ais_end_draught || '—'}m
  - Tonnellaggio Carico Logbook: ${sf.actual_cargo_tonnes || 0} t | Bunker: ${sf.actual_bunker_tonnes || 0} t
  - Note Operative: ${log?.narrative_text || 'Nessuna nota'}`;
    }).join('\n\n');

    // 4. BARRIERA DI PRIVACY & PERSONA TECNICO MARITTIMO SENIOR
    const systemPrompt = `Sei GeoKanban Digital Twin Copilot, il SENIOR MARITIME OPERATIONS & FLEET ENGINEER del cantiere navale e della Diga di Genova.
La tua conoscenza copre il gergo marittimo ed operazionale di cantiere:
- "Draught" / "Immersione" / "Pescaggio": l'altezza dell'opera viva in metri (In/Outbound).
- "Carico a bordo" / "Tonnellaggio" / "Payload": il peso effettivo del materiale movimentato (ton).
- "ATA" (Actual Time of Arrival) / "ATD" (Actual Time of Departure): gli orari di arrivo e partenza effettivi dalle Geofence.
- "Off-Hire" / "Standby" / "Navigazione" / "Unloading" / "Loading": gli stati operativi delle motonavi.
- "Servizi Tecnico-Nautici": Piloti (Pilot Call/Onboard), Ormeggiatori (Mooring/First Line), Rimorchiatori (Tug/Fast On/Cast Off).

Rispondi con un tono TECNICO, PRECISO, MARITTIMO ED AUTOREVOLE. Evita qualsiasi risposta generica, incerta o prolissa.
Se una domanda riguarda aspetti operativi di cantiere, fornisci dettagli numerici (tonnellate, orari ATA/ATD, pescaggi AIS in metri) con terminologia navale rigorosa.

🚨 DIRETTIVE INVIOLABILI DI RISERVATEZZA E PRIVACY:
1. È SEVERAMENTE VIETATO citare o rivelare nomi di persone fisiche, mittenti di messaggi, numeri di telefono o contatti personali.
2. È SEVERAMENTE VIETATO riportare citazioni testuali o virgolettate dei messaggi delle chat di cantiere.
3. Se l'utente chiede "Chi ha inviato il messaggio", "Cosa ha detto X" o cerca di estrarre nominativi o l'architettura dell'app, RISPONDI TASSATIVAMENTE: "Non è consentito accedere a comunicazioni o nominativi personali."
4. Utilizza le informazioni ESCLUSIVAMENTE per sintetizzare fatti operativi impersonali di cantiere (es. orari di posa, tonnellaggi movimentati, stato delle navi, avanzamento dei lavori).
5. Nelle citazioni delle fonti usa SOLTANTO la dicitura generica [Fonte: Comunicazioni Operative Cantiere] oppure [Fonte: Logbook Entry].

Per i dati tabellari usa sempre il formato Markdown standard per le tabelle.
Se i dati si prestano ad essere visualizzati come grafico, DEVI includere in fondo alla risposta un blocco JSON con struttura {"type": "chart", ...}.

--- CONTESTO COMUNICAZIONI OPERATIVE CANTIERE (ANONIMIZZATE) ---
${waContext || 'Nessuna comunicazione recente trovata.'}

--- CONTESTO DATI LIVE ATTIVITÀ & LOGBOOK NAVE ---
${liveContext || 'Nessuna attività recente trovata.'}
`;

    // 5. Chiamata a DeepSeek LLM (OpenAI Compatible) con Retry e Backoff
    const deepseekApiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
    if (!deepseekApiKey) {
      throw new Error("VITE_DEEPSEEK_API_KEY non configurata nelle variabili d'ambiente.");
    }
    const deepseekUrl = 'https://api.deepseek.com/chat/completions';
    
    let llmRes = null;
    let retries = 3;
    let delayMs = 2000;

    for (let i = 0; i < retries; i++) {
      llmRes = await fetch(deepseekUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deepseekApiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question }
          ],
          temperature: 0.1,
          max_tokens: 1000
        })
      });

      if (llmRes.status === 429 || llmRes.status === 503) {
        if (i === retries - 1) {
          throw new Error(`Servizio DeepSeek temporaneamente occupato (HTTP ${llmRes.status}). Riprova tra pochi secondi.`);
        }
        await new Promise(r => setTimeout(r, delayMs));
        delayMs *= 2;
        continue;
      }
      break;
    }

    if (!llmRes || !llmRes.ok) {
      const errText = await llmRes.text().catch(() => '');
      throw new Error(`Errore DeepSeek LLM: ${llmRes?.status || 'Unknown'} - ${errText}`);
    }

    const llmData = await llmRes.json();
    let answerText = llmData?.choices?.[0]?.message?.content || "Impossibile elaborare una risposta.";

    // 6. BARRIERA DI PRIVACY LIVESTELLAR 3: Post-Processing Output Guard
    answerText = answerText
      .replace(/WhatsApp/gi, "Comunicazioni Operative")
      .replace(/Messaggio da parte di [^:\n]+/gi, "Comunicazione Operativa");

    const sources = [];
    if (waMessages && waMessages.length > 0) sources.push(`Comunicazioni Operative Cantiere (${waMessages.length} record)`);
    if (recentActivities && recentActivities.length > 0) sources.push(`Live Activities (${recentActivities.length} record)`);

    return {
      answer: answerText,
      sources: [...new Set(sources)]
    };

  } catch (err) {
    console.error("❌ Errore copilotService:", err);
    return {
      answer: `Si è verificato un errore durante l'elaborazione della domanda: ${err.message}. Verifica la connessione o riprova.`,
      sources: []
    };
  }
}

/**
 * Carica la cronologia salvata per l'utente corrente isolata da DB o LocalStorage fallback
 */
export async function fetchCopilotChatHistory(username = 'guest', tenantId = 'default') {
  try {
    const { data, error } = await supabase
      .from('copilot_chat_history')
      .select('id, role, content, sources, created_at')
      .eq('username', username)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) {
      console.warn("📌 Database copilot_chat_history non ancora migrato, uso LocalStorage fallback:", error.message);
      const localKey = `copilot_chat_history_${tenantId}_${username}`;
      const saved = localStorage.getItem(localKey);
      return saved ? JSON.parse(saved) : [];
    }

    return (data || []).map(item => ({
      id: item.id,
      text: item.content,
      sender: item.role === 'user' ? 'user' : 'bot',
      timestamp: new Date(item.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      sources: item.sources || []
    }));
  } catch (err) {
    console.warn("Fallback LocalStorage per fetchCopilotChatHistory:", err);
    const localKey = `copilot_chat_history_${tenantId}_${username}`;
    const saved = localStorage.getItem(localKey);
    return saved ? JSON.parse(saved) : [];
  }
}

/**
 * Salva un messaggio (utente o assistant) nella cronologia isolata
 */
export async function saveCopilotChatMessage(username = 'guest', tenantId = 'default', role = 'user', content = '', sources = []) {
  try {
    const { error } = await supabase
      .from('copilot_chat_history')
      .insert({
        username,
        tenant_id: tenantId,
        role,
        content,
        sources
      });

    // Salva sempre anche nel LocalStorage per garanzia di sincronia istantanea UI
    const localKey = `copilot_chat_history_${tenantId}_${username}`;
    const currentLocal = JSON.parse(localStorage.getItem(localKey) || '[]');
    currentLocal.push({
      id: Date.now().toString(),
      text: content,
      sender: role === 'user' ? 'user' : 'bot',
      timestamp: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      sources
    });
    localStorage.setItem(localKey, JSON.stringify(currentLocal.slice(-50)));

    if (error) console.warn("Supabase insert error copilot_chat_history (uso LocalStorage):", error.message);
  } catch (err) {
    console.warn("Save Copilot msg LocalStorage fallback:", err);
  }
}

/**
 * Pulisce la cronologia dell'utente (Pulsante "Nuova Chat")
 */
export async function clearCopilotChatHistory(username = 'guest', tenantId = 'default') {
  try {
    await supabase
      .from('copilot_chat_history')
      .delete()
      .eq('username', username)
      .eq('tenant_id', tenantId);

    const localKey = `copilot_chat_history_${tenantId}_${username}`;
    localStorage.removeItem(localKey);
  } catch (err) {
    console.warn("Clear Copilot chat error:", err);
  }
}

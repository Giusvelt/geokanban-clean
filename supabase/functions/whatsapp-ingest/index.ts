// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  try {
    const payload = await req.json();
    console.log("📥 [WhatsApp Ingest Webhook] Ricevuto nuovo messaggio:", JSON.stringify(payload));

    let groupName = "Diga Team";
    let sender = "Operatore Cantiere";
    let messageText = "";
    let timestamp = new Date().toISOString();

    // 1. Parsing Formato Evolution API (Baileys)
    if (payload?.data?.key?.remoteJid || payload?.data?.message) {
      const data = payload.data;
      sender = data.pushName || data.key?.participant || "Operatore WhatsApp";
      
      messageText = 
        data.message?.conversation || 
        data.message?.extendedTextMessage?.text || 
        data.message?.imageMessage?.caption || 
        "";

      if (data.messageTimestamp) {
        timestamp = new Date(data.messageTimestamp * 1000).toISOString();
      }

      if (payload.group_name) {
        groupName = payload.group_name;
      } else if (data.groupName) {
        groupName = data.groupName;
      }
    } 
    // 2. Parsing Formato Diretto / Standard Webhook (Whapi / Green-API / Custom)
    else {
      groupName = payload.group_name || payload.group || payload.chat_name || "Diga Team";
      sender = payload.sender || payload.author || payload.from_name || "Operatore";
      messageText = payload.message_text || payload.text || payload.message || "";
      if (payload.timestamp) {
        timestamp = new Date(payload.timestamp).toISOString();
      }
    }

    if (!messageText || messageText.trim() === "") {
      return new Response(JSON.stringify({ status: "ignored", reason: "empty message_text" }), { headers: corsHeaders });
    }

    // 🔍 CONTROLLO WHITELIST DINAMICA SU DATABASE (whatsapp_monitored_groups)
    const { data: whitelist } = await supabase
      .from("whatsapp_monitored_groups")
      .select("group_name")
      .eq("is_active", true);

    const allowedGroupNames = new Set((whitelist || []).map((w: any) => w.group_name.trim().toLowerCase()));

    // Se la Whitelist è definita su DB, filtriamo i messaggi provenienti da gruppi non autorizzati
    if (allowedGroupNames.size > 0 && !allowedGroupNames.has(groupName.trim().toLowerCase())) {
      console.log(`⚠️ Messaggio dal gruppo "${groupName}" scartato (non presente in Whitelist)`);
      return new Response(JSON.stringify({ status: "ignored", reason: "group_not_in_whitelist", group: groupName }), { headers: corsHeaders });
    }

    // Inseriamo il messaggio nella tabella whatsapp_messages
    const { data: inserted, error: insErr } = await supabase
      .from("whatsapp_messages")
      .insert({
        group_name: groupName,
        sender: sender,
        message_text: messageText.trim(),
        timestamp: timestamp,
        is_processed: false,
        raw_data: payload
      })
      .select("id")
      .single();

    if (insErr) {
      console.error("❌ Errore salvataggio messaggio WhatsApp:", insErr.message);
      throw insErr;
    }

    console.log(`✅ Messaggio salvato in whatsapp_messages per gruppo [${groupName}] con ID: ${inserted.id}`);

    return new Response(JSON.stringify({ status: "success", id: inserted.id }), { headers: corsHeaders });

  } catch (error: any) {
    console.error("❌ Errore Webhook whatsapp-ingest:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});

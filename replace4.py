import re

with open('src/hooks/useMessaging.js', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace("import { supabase } from '../lib/supabase';", "import { messagesService } from '../services/api/messagesService';")

c = re.sub(r"const \{ data, error \} = await supabase\s*\.from\('activity_messages'\)\s*\.select\('\*, sender:user_profiles\(display_name\)'\)\s*\.eq\('vessel_activity_id', activityId\)\s*\.order\('created_at', \{ ascending: true \}\);", "const { data, error } = await messagesService.fetchMessagesForHook(activityId);", c)

c = re.sub(r"const channel = supabase\s*\.channel\(ctivity-messages-\$\{activityId\}\)\s*\.on\(\s*'postgres_changes',\s*\{\s*event: 'INSERT',\s*schema: 'public',\s*table: 'activity_messages',\s*filter: essel_activity_id=eq\.\$\{activityId\}\s*\},\s*\(payload\) => \{\s*setMessages\(\(prev\) => \[\.\.\.prev, payload\.new\]\);\s*\}\s*\)\s*\.subscribe\(\);", "const channel = messagesService.subscribeToActivity(activityId, (payload) => setMessages((prev) => [...prev, payload.new]));", c)

c = re.sub(r"supabase.removeChannel\(channel\);", "messagesService.unsubscribe(channel);", c)

c = re.sub(r"const \{ error \} = await supabase\s*\.from\('activity_messages'\)\s*\.insert\(\{\s*vessel_activity_id: activityId,\s*sender_id: userId,\s*sender_role: role,\s*message_text: text\s*\}\);", "await messagesService.sendMessage({activityId, senderId: userId, senderRole: role, messageText: text}); const error = null;", c)

c = re.sub(r"const \{ error \} = await supabase\s*\.from\('activity_messages'\)\s*\.update\(\{ included_in_logbook: included \}\)\s*\.eq\('id', messageId\);", "const { error } = await messagesService.toggleInLogbook(messageId, included);", c)

with open('src/hooks/useMessaging.js', 'w', encoding='utf-8') as f:
    f.write(c)

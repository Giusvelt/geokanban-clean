import sys
with open('src/components/LogbookWriterTab.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace("import { supabase } from '../lib/supabase';", "import { logbookService } from '../services/api/logbookService';")

fetch_str = '''const { data, error } = await supabase
                .from('logbook_entries')
                .select('id, vessel_activity_id, status, narrative_text, structured_fields, document_hash, message_snapshot, logbook_services(*)')
                .in('vessel_activity_id', ids);'''
c = c.replace(fetch_str, "const { data, error } = await logbookService.fetchLogbookEntriesByActivityIds(ids);")

update_str = '''supabase
                .from('logbook_entries')
                .update({ structured_fields: updatedFields })
                .eq('id', existingEntry.entryId)
                .then(); // Fire and forget'''
c = c.replace(update_str, "logbookService.updateStructuredFields(existingEntry.entryId, updatedFields).then(); // Fire and forget")

with open('src/components/LogbookWriterTab.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

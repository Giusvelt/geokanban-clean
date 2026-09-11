import sys

with open('src/hooks/useLogbook.js', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace("import { supabase } from '../lib/supabase';", "import { logbookService } from '../services/api/logbookService';")

s1 = '''const { data, error: e1 } = await supabase
                .from('logbook_entries')
                .select('*, vessels(name, mmsi)')
                .eq('vessel_activity_id', activityId)
                .single();'''
c = c.replace(s1, "const { data, error: e1 } = await logbookService.fetchLogbookByActivity(activityId);")

s2 = '''const { data: svc, error: e2 } = await supabase
                    .from('logbook_services')
                    .select('*, services(name, code, provider)')
                    .eq('logbook_entry_id', data.id);'''
c = c.replace(s2, "const { data: svc, error: e2 } = await logbookService.fetchLogbookServices(data.id);")

s3 = '''const { error } = await supabase
                .from('logbook_entries')
                .update({ narrative_text: text, updated_at: new Date() })
                .eq('id', entryId);'''
c = c.replace(s3, "const { error } = await logbookService.updateLogbookNarrative(entryId, text);")

s4 = '''const { error } = await supabase
                .from('logbook_entries')
                .update({ status: 'submitted' })
                .eq('id', entryId);'''
c = c.replace(s4, "const { error } = await logbookService.submitLogbookEntry(entryId);")

s5 = '''const { error } = await supabase
                .from('logbook_services')
                .insert({
                    logbook_entry_id: entryId,
                    service_id: serviceId,
                    quantity: qty,
                    start_time: start,
                    end_time: end,
                    details: details
                });'''
c = c.replace(s5, "const { error } = await logbookService.addLogbookService(entryId, serviceId, qty, start, end, details);")

s6 = '''const { error } = await supabase
                .from('logbook_services')
                .delete()
                .eq('id', id);'''
c = c.replace(s6, "const { error } = await logbookService.removeLogbookService(id);")

s7 = '''const { error } = await supabase
                .from('logbook_services')
                .update(updates)
                .eq('id', id);'''
c = c.replace(s7, "const { error } = await logbookService.updateLogbookService(id, updates);")

with open('src/hooks/useLogbook.js', 'w', encoding='utf-8') as f:
    f.write(c)

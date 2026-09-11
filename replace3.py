import re

with open('src/hooks/useLogbook.js', 'r', encoding='utf-8') as f:
    c = f.read()

c = re.sub(r"await supabase\s*\.from\('logbook_entries'\)\s*\.select\('\*, vessels\(name, mmsi\)'\)\s*\.eq\('vessel_activity_id', activityId\)\s*\.maybeSingle\(\)", "await logbookService.fetchLogbookByActivity(activityId)", c)
c = re.sub(r"await supabase\s*\.from\('logbook_entries'\)\s*\.update\(\{ narrative_text: text, updated_at: new Date\(\) \}\)\s*\.eq\('id', entryId\)", "await logbookService.updateLogbookNarrative(entryId, text)", c)
c = re.sub(r"await supabase\s*\.from\('logbook_entries'\)\s*\.update\(\{ status: 'submitted' \}\)\s*\.eq\('id', entryId\)", "await logbookService.submitLogbookEntry(entryId)", c)
c = re.sub(r"await supabase\s*\.from\('logbook_services'\)\s*\.insert\(\{\s*logbook_entry_id: entryId,\s*service_id: serviceId,\s*quantity: qty,\s*start_time: start,\s*end_time: end,\s*details: details\s*\}\)", "await logbookService.addLogbookService(entryId, serviceId, qty, start, end, details)", c)
c = re.sub(r"await supabase\s*\.from\('logbook_services'\)\s*\.delete\(\)\s*\.eq\('id', id\)", "await logbookService.removeLogbookService(id)", c)
c = re.sub(r"await supabase\s*\.from\('logbook_services'\)\s*\.update\(updates\)\s*\.eq\('id', id\)", "await logbookService.updateLogbookService(id, updates)", c)

with open('src/hooks/useLogbook.js', 'w', encoding='utf-8') as f:
    f.write(c)

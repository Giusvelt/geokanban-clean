const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Users/giuse/Desktop/ANTIGRAVITY/geokanban_v3/.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
    const { count, error } = await supabase
        .from('vessel_activity')
        .select('*', { count: 'exact', head: true });
    
    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Vessel Activity Count:', count);
    }

    const { count: logbookCount } = await supabase
        .from('logbook_entries')
        .select('*', { count: 'exact', head: true });
    
    console.log('Logbook Entries Count:', logbookCount);
}

check();

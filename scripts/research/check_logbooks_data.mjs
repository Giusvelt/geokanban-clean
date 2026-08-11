import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envPath = '.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
const env = {};
envLines.forEach(line => {
    if (line.includes('=')) {
        const parts = line.split('=');
        const k = parts[0].trim();
        const v = parts.slice(1).join('=').trim();
        env[k] = v;
    }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function runTest() {
    await supabase.auth.signInWithPassword({ email: 'veromidollo@gmail.com', password: 'crew123' });

    const { data: logbooks, error } = await supabase.from('logbook_entries').select('*');
    if (error) {
        console.error(error);
        return;
    }
    console.log(`Logbook entries count: ${logbooks.length}`);
    if (logbooks.length > 0) {
        console.log(`First entry:`, logbooks[0]);
    }
}
runTest();

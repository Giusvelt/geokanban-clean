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
    const { data, error } = await supabase.from('vessels').select('*');
    console.log(`Total vessels in DB: ${data.length}`);
}
runTest();

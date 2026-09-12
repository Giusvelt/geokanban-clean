import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data, error } = await supabase
        .from('vessel_tracking')
        .select('timestamp')
        .order('timestamp', { ascending: false })
        .limit(1);
    console.log('Error:', error);
    console.log('Data:', data);
}
test();

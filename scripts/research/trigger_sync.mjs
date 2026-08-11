import fs from 'fs';

const envPath = 'c:/Users/giuse/Desktop/ANTIGRAVITY/geokanban_v3/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
const env = {};
envLines.forEach(line => { if (line.includes('=')) { const [k, v] = line.split('='); env[k.trim()] = v.trim(); } });

const functionUrl = `${env.VITE_SUPABASE_URL}/functions/v1/fetch-vessel-positions`;

async function triggerSync() {
    console.log(`--- Manually Triggering Sync: ${functionUrl} ---`);
    try {
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const text = await response.text();
        console.log('Response Status:', response.status);
        console.log('Response Content:', text);
    } catch (err) {
        console.error('Fetch error:', err.message);
    }
}
triggerSync();

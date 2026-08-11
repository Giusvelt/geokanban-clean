import fs from 'fs';

const envPath = 'c:/Users/giuse/Desktop/ANTIGRAVITY/geokanban_v3/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
const env = {};
envLines.forEach(line => { if (line.includes('=')) { const [k, v] = line.split('='); env[k.trim()] = v.trim(); } });

async function testDatalastic() {
    console.log('--- Checking Datalastic for Maria Vittoria (247366300) ---');
    const apiKey = env.VITE_DATALASTIC_API_KEY;
    const mmsi = '247366300';
    const url = `https://api.datalastic.com/api/v0/vessel?mmsi=${mmsi}`;

    try {
        const res = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        const json = await res.json();
        console.log('Datalastic Status:', res.status);
        console.log('Datalastic Data:', JSON.stringify(json, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
}
testDatalastic();

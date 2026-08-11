import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envPath = 'c:/Users/giuse/Desktop/ANTIGRAVITY/geokanban_v3/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
const env = {};
envLines.forEach(line => { if (line.includes('=')) { const [k, v] = line.split('='); env[k.trim()] = v.trim(); } });

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

function isPointInPolygon(lat, lon, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        let xi = polygon[i][0], yi = polygon[i][1];
        let xj = polygon[j][0], yj = polygon[j][1];
        let intersect = ((yi > lon) != (yj > lon))
            && (lat < (xj - xi) * (lon - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

async function checkFabioInGeos() {
    const { data: vessel } = await supabase.from('vessels').select('id').ilike('name', '%Fabio Duo%').single();
    const { data: tracking } = await supabase.from('vessel_tracking').select('*').eq('vessel_id', vessel.id).order('timestamp', { ascending: true });
    const { data: geos } = await supabase.from('geofences').select('id, name, polygon_coords');

    tracking?.forEach(t => {
        geos?.forEach(g => {
            const coords = typeof g.polygon_coords === 'string' ? JSON.parse(g.polygon_coords) : g.polygon_coords;
            if (coords && isPointInPolygon(t.lat, t.lon, coords)) {
                console.log(`POINT AT ${t.timestamp} (${t.lat}, ${t.lon}) IS INSIDE ${g.name}`);
            }
        });
    });
}
checkFabioInGeos();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function updateSettoreT6Geofence() {
    console.log("🚀 Aggiornamento del geofence 'Settore T6' dal file KMZ (Settore T_6.kmz)...");

    // Legge il file doc.kml estratto da Settore T_6.kmz
    const kmlPath = path.join(process.cwd(), 'scratch', 'settore_t6_kmz', 'doc.kml');
    if (!fs.existsSync(kmlPath)) {
        console.error("❌ File doc.kml non trovato in scratch/settore_t6_kmz/doc.kml");
        return;
    }

    const kmlContent = fs.readFileSync(kmlPath, 'utf8');
    const coordMatch = kmlContent.match(/<coordinates>([\s\S]*?)<\/coordinates>/);
    if (!coordMatch || !coordMatch[1]) {
        console.error("❌ Tag <coordinates> non trovato nel KML.");
        return;
    }

    const rawCoordsStr = coordMatch[1].trim();
    const rawTokens = rawCoordsStr.split(/\s+/).filter(t => t.length > 0);

    const geoJsonCoords = []; // [lon, lat]
    const latLonPairs = [];    // [lat, lon]

    let sumLat = 0;
    let sumLon = 0;

    for (const token of rawTokens) {
        const parts = token.split(',');
        if (parts.length >= 2) {
            const lon = parseFloat(parts[0]);
            const lat = parseFloat(parts[1]);

            if (!isNaN(lon) && !isNaN(lat)) {
                geoJsonCoords.push([lon, lat]);
                latLonPairs.push([lat, lon]);
                sumLat += lat;
                sumLon += lon;
            }
        }
    }

    if (geoJsonCoords.length === 0) {
        console.error("❌ Nessuna coordinata valida estratta dal KMZ.");
        return;
    }

    // Assicura che il poligono sia chiuso (primo e ultimo punto uguali)
    const firstGeo = geoJsonCoords[0];
    const lastGeo = geoJsonCoords[geoJsonCoords.length - 1];
    if (firstGeo[0] !== lastGeo[0] || firstGeo[1] !== lastGeo[1]) {
        geoJsonCoords.push([firstGeo[0], firstGeo[1]]);
        latLonPairs.push([latLonPairs[0][0], latLonPairs[0][1]]);
    }

    const centroidLat = sumLat / (rawTokens.length || 1);
    const centroidLon = sumLon / (rawTokens.length || 1);

    const polygonCoordsJson = JSON.stringify(latLonPairs);
    const polygonGeomJson = {
        type: "Polygon",
        crs: {
            type: "name",
            properties: {
                name: "EPSG:4326"
            }
        },
        coordinates: [geoJsonCoords]
    };

    console.log(`📍 Estratti ${geoJsonCoords.length} vertici del nuovo poligono per Settore T6:`);
    console.log(`   • Centroide: Lat ${centroidLat.toFixed(6)}, Lon ${centroidLon.toFixed(6)}`);

    // Aggiornamento su Supabase nella tabella geofences per ID Settore T6
    const settoreT6Id = '0cc994e6-30c4-4a80-8b0c-d5b32145248b';

    const { data: updated, error: updateErr } = await supabase
        .from('geofences')
        .update({
            lat: centroidLat,
            lon: centroidLon,
            polygon_coords: polygonCoordsJson,
            polygon_geom: polygonGeomJson
        })
        .eq('id', settoreT6Id)
        .select();

    if (updateErr) {
        console.error("❌ Errore aggiornamento Supabase geofences:", updateErr.message);
        return;
    }

    console.log("✅ Geofence 'Settore T6' aggiornato con successo su Supabase!");
    console.log("Dettagli record aggiornato:", updated[0]);
}

updateSettoreT6Geofence();

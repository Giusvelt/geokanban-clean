import * as XLSX from 'xlsx';

/**
 * Parses an Excel file containing Geofence definitions.
 * Expected columns: Name, Latitude (lat), Longitude (lon), Nature, Family, Color, Vertex.
 * 
 * @param {File} file - The Excel file from the input event
 * @returns {Promise<Array>} - Resolves to an array of parsed Geofence objects ready for insertion
 */
export const parseGeofencesFromExcel = (file) => {
    return new Promise((resolve, reject) => {
        if (!file) return reject(new Error("Nessun file fornito"));

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const rawData = XLSX.utils.sheet_to_json(ws);

                if (rawData.length === 0) throw new Error("Il file Excel è vuoto.");

                // Normalizza le chiavi di ogni riga in minuscolo per supportare qualsiasi maiuscola/minuscola nelle colonne
                const data = rawData.map(row => {
                    const normalizedRow = {};
                    for (const key in row) {
                        normalizedRow[key.toLowerCase().trim()] = row[key];
                    }
                    return normalizedRow;
                });

                // Group by Geofence Name
                const groups = {};
                data.forEach((row, rowIndex) => {
                    const name = row.name || row.nome || row.geofence;
                    if (!name) {
                        console.warn(`Riga ${rowIndex + 2} saltata: colonna 'Name' non trovata o vuota.`);
                        return;
                    }
                    const nameKey = String(name).trim();
                    if (!groups[nameKey]) groups[nameKey] = [];
                    groups[nameKey].push(row);
                });

                const groupNames = Object.keys(groups);
                if (groupNames.length === 0) {
                    throw new Error("Nessuna colonna 'Name' (o 'name') trovata nel file Excel.");
                }

                const parsedGeofences = [];

                for (const name of groupNames) {
                    const rows = groups[name].sort((a, b) => (parseFloat(a.vertex) || 0) - (parseFloat(b.vertex) || 0));
                    
                    const coords = rows.map((r, idx) => {
                        let latVal = r.latitude !== undefined ? r.latitude : (r.lat !== undefined ? r.lat : r.latitudine);
                        let lonVal = r.longitude !== undefined ? r.longitude : (r.lon !== undefined ? r.lon : r.longitudine);
                        
                        if (typeof latVal === 'string') latVal = latVal.replace(',', '.');
                        if (typeof lonVal === 'string') lonVal = lonVal.replace(',', '.');

                        const lat = parseFloat(latVal);
                        const lon = parseFloat(lonVal);
                        
                        return [lat, lon];
                    }).filter(c => !isNaN(c[0]) && !isNaN(c[1]));

                    if (coords.length < 3) {
                        console.warn(`Geofence "${name}" ignorata: trovati solo ${coords.length} vertici validi (minimo richiesto: 3).`);
                        continue;
                    }

                    // Calculate center (approximate centroid)
                    const lat = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
                    const lon = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;

                    const nature = rows[0].nature || rows[0].natura || 'general';
                    const family = rows[0].family || rows[0].famiglia || '';
                    const color = rows[0].color || rows[0].colore || '#3b82f6';

                    let natureStr = String(nature).toLowerCase().trim();
                    
                    // Intelligent automatic mapping to match database check constraints
                    if (natureStr === 'quarry' || natureStr === 'cava' || natureStr === 'loading' || natureStr === 'loading site' || natureStr === 'loading_site') {
                        natureStr = 'loading_site';
                    } else if (natureStr === 'unloading' || natureStr === 'unloading site' || natureStr === 'unloading_site' || natureStr === 'diga' || natureStr === 'scarico') {
                        natureStr = 'unloading_site';
                    } else if (natureStr === 'base port' || natureStr === 'base_port' || natureStr === 'porto' || natureStr === 'rada' || natureStr === 'roadstead') {
                        natureStr = 'base_port';
                    } else {
                        natureStr = natureStr.replace(/\s+/g, '_');
                    }

                    parsedGeofences.push({
                        name,
                        nature: natureStr,
                        family: String(family).trim(),
                        color: String(color).trim(),
                        lat,
                        lon,
                        polygon_coords: JSON.stringify(coords)
                    });
                }

                if (parsedGeofences.length === 0) {
                    throw new Error("Il file è stato letto, ma nessun poligono contiene almeno 3 vertici validi. Verifica che le colonne si chiamino 'Name', 'Latitude' (o 'Lat'), 'Longitude' (o 'Lon') e 'Vertex'.");
                }

                resolve(parsedGeofences);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error("Errore durante la lettura del file."));
        reader.readAsBinaryString(file);
    });
};

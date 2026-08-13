/**
 * geoUtils.js — Utility geografiche per il parsing e formatting di coordinate.
 * Estrae da DBManager.jsx le funzioni di conversione DD/DDM.
 * Usato da: DBManager, e potenzialmente da import Excel e form geofence.
 */

/**
 * Parsa una stringa rappresentante una singola coordinata (lat o lon).
 * Supporta formato DD (gradi decimali) e DDM (gradi minuti decimali).
 * @param {string} str
 * @param {boolean} isLat
 * @returns {number} valore decimale, NaN se non parsabile
 */
export const parsePart = (str, isLat) => {
    if (!str) return NaN;
    const cleanStr = str.trim();

    // DDM: es. 44° 07.407' N oppure 44 07.407 N
    const ddmRegex = /(\d+)\s*°?\s*(\d+(?:[\.,]\d+)?)\s*'?\s*([NnSsEeWwOo])/i;
    const match = cleanStr.match(ddmRegex);
    if (match) {
        const deg = parseFloat(match[1]);
        const min = parseFloat(match[2].replace(',', '.'));
        const hemi = match[3].toUpperCase();
        let val = deg + (min / 60);
        if (hemi === 'S' || hemi === 'W' || hemi === 'O') val = -val;
        return val;
    }

    // Gradi decimali semplici
    return parseFloat(cleanStr.replace(',', '.'));
};

/**
 * Parsa una riga di testo contenente lat e lon separati da tab, punto e virgola,
 * virgola, spazio o pattern DDM riconoscibili.
 * @param {string} line
 * @returns {[number, number] | null} [lat, lon] oppure null
 */
export const parseCoordinateLine = (line) => {
    let clean = line.trim();
    if (!clean) return null;

    let parts = [];
    if (clean.includes('\t')) {
        parts = clean.split('\t');
    } else if (clean.includes(';')) {
        parts = clean.split(';');
    } else if (clean.includes(',') && (clean.match(/,/g) || []).length === 1) {
        parts = clean.split(',');
    } else {
        const ddmPattern = /\d+\s*°?\s*\d+(?:[\.,]\d+)?\s*'?\s*[NnSsEeWwOo]/gi;
        const ddmMatches = clean.match(ddmPattern);
        if (ddmMatches && ddmMatches.length === 2) {
            parts = ddmMatches;
        } else {
            const spaceParts = clean.split(/\s+/).filter(Boolean);
            if (spaceParts.length === 2) {
                parts = spaceParts;
            } else if (clean.includes(',') && (clean.match(/,/g) || []).length === 3) {
                const commaSpaceParts = clean.split(/,\s+/);
                if (commaSpaceParts.length === 2) {
                    parts = commaSpaceParts;
                } else {
                    const commaParts = clean.split(',');
                    if (commaParts.length === 4) {
                        parts = [
                            commaParts[0].trim() + '.' + commaParts[1].trim(),
                            commaParts[2].trim() + '.' + commaParts[3].trim(),
                        ];
                    }
                }
            }
        }
    }

    if (parts.length < 2) return null;

    const lat = parsePart(parts[0], true);
    const lon = parsePart(parts[1], false);
    if (isNaN(lat) || isNaN(lon)) return null;
    return [lat, lon];
};

/**
 * Converte un valore decimale in formato DDM (Gradi Minuti Decimali).
 * Es. 44.1234 → "44° 7.4040' N"
 * @param {number} val
 * @param {boolean} isLat
 * @returns {string}
 */
export const toDDM = (val, isLat) => {
    if (val === undefined || val === null || isNaN(val)) return '';
    const absVal = Math.abs(val);
    const deg = Math.floor(absVal);
    const min = ((absVal - deg) * 60).toFixed(4);
    const hemi = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
    return `${deg}° ${min}' ${hemi}`;
};

/**
 * Formatta un array di coordinate [[lat,lon], ...] in stringa leggibile.
 * @param {Array<[number,number]>} coordsArray
 * @param {'DDM'|'DD'} format
 * @returns {string}
 */
export const formatCoords = (coordsArray, format) => {
    if (!Array.isArray(coordsArray)) return '';
    return coordsArray.map(([lat, lon]) => {
        if (format === 'DDM') {
            return `${toDDM(lat, true)}, ${toDDM(lon, false)}`;
        }
        return `${lat.toFixed(8)}, ${lon.toFixed(8)}`;
    }).join('\n');
};

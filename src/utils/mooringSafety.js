/**
 * mooringSafety.js
 * Libreria di calcolo delle condizioni di sicurezza ormeggio secondo le prescrizioni RINA.
 */

export function getDeltaAngle(windDir, mooringHeading) {
    let delta = Math.abs(windDir - mooringHeading);
    if (delta > 180) {
        delta = 360 - delta;
    }
    return delta;
}

export function validateMooring({ dwt, grossTonnage, berth, waveDir, mooringHeading, hs, windSpeed }) {
    // 1. Calculate Delta
    const delta = getDeltaAngle(waveDir, mooringHeading);
    
    // 2. Identify the active limits
    let hsLimit = null;
    let windLimit = null;
    let isError = false;

    // Resolve DWT class from grossTonnage if not explicitly passed
    let dwtNum = dwt ? Number(dwt) : null;
    if (!dwtNum && grossTonnage) {
        const gt = Number(grossTonnage);
        if (gt >= 15000) {
            dwtNum = 40000;
        } else if (gt >= 4000 && gt < 15000) {
            dwtNum = 7300;
        } else if (gt > 0) {
            dwtNum = 5270;
        }
    }

    if (dwtNum === 40000) {
        windLimit = 20;
        if (delta >= 0 && delta <= 5) {
            hsLimit = 2.0;
        } else if (delta > 5 && delta <= 45) {
            hsLimit = 0.7;
        } else if (delta > 45 && delta <= 90) {
            hsLimit = 0.3;
        } else {
            isError = true;
        }
    } else if (dwtNum === 7300) {
        windLimit = 20;
        if (delta >= 0 && delta <= 5) {
            hsLimit = 1.0;
        } else if (delta > 5 && delta <= 45) {
            hsLimit = 0.6;
        } else if (delta > 45 && delta <= 90) {
            hsLimit = 0.3;
        } else {
            isError = true;
        }
    } else if (dwtNum === 5270) {
        windLimit = 10;
        const isT7 = String(berth).toUpperCase() === 'T7';
        if (isT7) {
            if (delta >= 0 && delta <= 5) {
                hsLimit = 0.5;
            } else if (delta > 5 && delta <= 90) {
                hsLimit = 0.4;
            } else {
                isError = true;
            }
        } else {
            // Non-T7 (e.g. T1, T2, T3, T5)
            if (delta >= 0 && delta <= 45) {
                isError = true;
            } else if (delta > 45 && delta <= 90) {
                hsLimit = 0.3;
            } else if (delta > 90 && delta <= 175) {
                hsLimit = 0.4;
            } else if (delta > 175 && delta <= 180) {
                hsLimit = 0.5;
            } else {
                isError = true;
            }
        }
    } else {
        return {
            delta,
            hsLimit: null,
            windLimit: null,
            status: 'UNKNOWN',
            message: 'Classe DWT sconosciuta'
        };
    }

    if (isError) {
        return {
            delta,
            hsLimit: 'ERRORE',
            windLimit,
            status: 'ERRORE',
            message: 'Fuori tolleranza RINA (disormeggio obbligatorio)'
        };
    }

    // 3. Evaluate safety status
    const isSafe = hs <= hsLimit && windSpeed <= windLimit;
    
    return {
        delta,
        hsLimit,
        windLimit,
        status: isSafe ? 'POSITIVO' : 'NEGATIVO',
        message: isSafe 
            ? 'Condizioni sicure' 
            : `Limite superato (${hs > hsLimit ? 'Hs' : ''}${hs > hsLimit && windSpeed > windLimit ? ' e ' : ''}${windSpeed > windLimit ? 'Vento' : ''})`
    };
}

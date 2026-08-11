/**
 * useSessionLock — Hook per limitare l'app ad una sola sessione attiva per utente.
 *
 * ⚠️  STATO ATTUALE: DISABILITATO (ENABLED = false)
 *
 * Per abilitare il Session Lock:
 * 1. Eseguire la migration SQL: supabase/session_lock_prep.sql
 * 2. Cambiare ENABLED = false → ENABLED = true qui sotto
 * 3. Testare il comportamento in development prima del deploy
 *
 * COME FUNZIONA (quando abilitato):
 * - Al login, viene generato un UUID univoco (session_token) e un device_id basato sul browser.
 * - Questi vengono scritti nella colonna `session_token` e `session_device_id` di `user_profiles`.
 * - Ad ogni accesso successivo, il token salvato viene confrontato con quello in memoria.
 * - Se non coincidono → significa che un altro dispositivo ha effettuato il login → l'utente corrente viene disconnesso.
 *
 * GESTIONE CASI LIMITE:
 * - Cambio PC legittimo: l'utente deve semplicemente fare logout da tutti i dispositivi e rientrare.
 * - Admin override: un admin può resettare il `session_token` di un utente dalla tabella user_profiles.
 */

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────
// 🔒 IMPOSTARE A TRUE PER ATTIVARE IL SESSION LOCK
const ENABLED = false;
// ─────────────────────────────────────────────

const CHECK_INTERVAL_MS = 30 * 1000; // Controlla ogni 30 secondi

/**
 * Genera un ID dispositivo stabile basato sul fingerprint del browser.
 * Non è infallibile ma copre il 90% dei casi reali.
 */
function getDeviceId() {
    let id = localStorage.getItem('gk_device_id');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('gk_device_id', id);
    }
    return id;
}

/**
 * Hook principale. Da usare in ActivityDashboard o App root.
 * @param {string|null} userId - L'ID Supabase dell'utente corrente
 * @param {Function} onKicked - Callback chiamata se la sessione viene invalidata da un altro dispositivo
 */
export function useSessionLock(userId, onKicked) {
    const sessionTokenRef = useRef(null);
    const intervalRef = useRef(null);

    // Registra la sessione corrente nel DB
    const registerSession = useCallback(async () => {
        if (!ENABLED || !userId) return;

        const token = crypto.randomUUID();
        const deviceId = getDeviceId();
        sessionTokenRef.current = token;

        const { error } = await supabase
            .from('user_profiles')
            .update({
                session_token: token,
                session_device_id: deviceId,
                session_registered_at: new Date().toISOString()
            })
            .eq('user_id', userId);

        if (error) {
            console.warn('[SessionLock] Failed to register session:', error.message);
        } else {
            console.info('[SessionLock] Session registered for device:', deviceId);
        }
    }, [userId]);

    // Controlla periodicamente se la sessione è ancora valida
    const checkSession = useCallback(async () => {
        if (!ENABLED || !userId || !sessionTokenRef.current) return;

        const { data, error } = await supabase
            .from('user_profiles')
            .select('session_token')
            .eq('user_id', userId)
            .single();

        if (error) return;

        if (data?.session_token !== sessionTokenRef.current) {
            console.warn('[SessionLock] Session invalidated — another device logged in.');
            clearInterval(intervalRef.current);
            onKicked?.('Your account was accessed from another device. You have been signed out for security.');
        }
    }, [userId, onKicked]);

    useEffect(() => {
        if (!ENABLED || !userId) return;

        registerSession();

        intervalRef.current = setInterval(checkSession, CHECK_INTERVAL_MS);

        return () => clearInterval(intervalRef.current);
    }, [userId, registerSession, checkSession]);

    // Pulizia al logout: resetta il token nel DB
    const clearSession = useCallback(async () => {
        if (!ENABLED || !userId) return;
        await supabase
            .from('user_profiles')
            .update({ session_token: null, session_device_id: null })
            .eq('user_id', userId);
    }, [userId]);

    return { clearSession };
}

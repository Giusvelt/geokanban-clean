/**
 * permissions.js — Helper centralizzato per la gestione dei permessi GeoKanban V3
 *
 * RUOLI DISPONIBILI:
 *   crew            → vede solo la propria nave
 *   crew_admin      → vede tutta la flotta della propria compagnia (sola lettura)
 *   operation       → vede tutto, può modificare, senza DB Manager
 *   operation_admin → accesso totale + DB Manager + User Management
 *
 * USO NEI COMPONENTI:
 *   import { can, ROLES, getRoleLabel, getRoleColor } from '../lib/permissions';
 *   const perms = can(profile?.role);
 *   if (perms.submitLogbook) { ... }
 */

// ─── Costanti ruoli ───────────────────────────────────────────────────────────
export const ROLES = {
    CREW:              'crew',
    CREW_ADMIN:        'crew_admin',
    OPERATION:         'operation',
    OPERATION_ADMIN:   'operation_admin',
};

// ─── Label UI per ogni ruolo ─────────────────────────────────────────────────
export const getRoleLabel = (role) => ({
    crew:             'Crew',
    crew_admin:       'Crew Admin',
    operation:        'Operations',
    operation_admin:  'Operations Admin',
}[role] || role || 'Unknown');

// ─── Colori badge per ogni ruolo ─────────────────────────────────────────────
export const getRoleColor = (role) => ({
    crew:             { bg: '#f0fdf4', text: '#166534' },   // verde chiaro
    crew_admin:       { bg: '#eff6ff', text: '#1d4ed8' },   // blu chiaro
    operation:        { bg: '#fff7ed', text: '#c2410c' },   // arancio
    operation_admin:  { bg: '#fef2f2', text: '#991b1b' },   // rosso
}[role] || { bg: '#f1f5f9', text: '#475569' });

/**
 * Restituisce un oggetto con tutti i permessi dell'utente dato il suo ruolo e gli overrides.
 * @param {string} role - Il ruolo dell'utente
 * @param {Object} overrides - Eventuali permessi forzati (si/no) dal database
 * @returns {Object} Oggetto con tutti i permessi booleani
 */
export const can = (role, overrides = {}) => {
    const isCrew            = role === ROLES.CREW;
    const isCrewAdmin       = role === ROLES.CREW_ADMIN;
    const isOperation       = role === ROLES.OPERATION;
    const isOperationAdmin  = role === ROLES.OPERATION_ADMIN;

    // --- Helper per combinare default del ruolo con override manuale ---
    const check = (defaultVal, overrideKey) => {
        if (overrides && overrides[overrideKey] !== undefined) {
            return !!overrides[overrideKey];
        }
        return defaultVal;
    };

    return {
        // ── Visibilità Mappa & Attività ──────────────────────────────
        /** Vede solo la propria nave? (Se ha seeAllVessels o seeCompanyVessels è false) */
        seeOwnVesselOnly:       isCrew && !check(isOperation || isOperationAdmin, 'see_all_vessels'),
        
        /** Vede tutte le navi della propria compagnia? */
        seeCompanyVessels:      isCrewAdmin || isCrew,
        
        /** POTERE EXTRA: Vede tutta la flotta (Mappa Live) */
        seeAllVessels:          check(isOperation || isOperationAdmin, 'see_all_vessels') || check(false, 'show_map'),

        /** POTERE EXTRA: Mappa Flotta Live (Specifico per icona UI) */
        showMap:                check(isOperation || isOperationAdmin, 'show_map') || check(isOperation || isOperationAdmin, 'see_all_vessels'),

        // ── Logbook ──────────────────────────────────────────────────
        /** POTERE EXTRA: Può compilare e sottomettere il logbook (ESCLUSIVO CREW) */
        submitLogbook:          (isCrew || isCrewAdmin) && check(true, 'access_logbook'),
        /** Può leggere i logbook (sempre vero per il proprio scope) */
        readLogbook:            true,
        /** Può approvare o rifiutare un logbook */
        approveLogbook:         isOperation || isOperationAdmin,
        /** Vede il tab Submitted Logbooks (solo Crew, Crew Admin e Operation Admin) */
        seeSubmittedLogbooks:   check(isCrew || isCrewAdmin || isOperationAdmin, 'see_logbook_submitted'),

        // ── Attività (Vessel Activity) ───────────────────────────────
        /** Può modificare le attività (ESCLUSIVO CREW) */
        editActivities:         (isCrew || isCrewAdmin),
        deleteActivities:       isOperationAdmin,

        // ── Tab Visibilità ────────────────────────────────────────────
        /** Accede al tab Digital Twin Copilot (Gestibile per Profilo/Tenant) */
        seeCopilot:             check(isOperation || isOperationAdmin, 'see_copilot'),
        /** Accede al tab Production Targets (solo Operation Admin) */
        seeProductionTargets:   check(isOperationAdmin, 'see_production'),
        /** Accede al tab Rewind Map */
        seeRewindMap:           check(isOperation || isOperationAdmin, 'see_rewind'),
        /** Accede al tab DB Manager */
        accessDBManager:        check(isOperationAdmin, 'see_dbmanager'),
        /** POTERE EXTRA: Accede al tab User Management (Sola lettura o Full) */
        accessUserManagement:   isOperationAdmin,
        /** POTERE EXTRA: Dashboard Admin / KPI Stats */
        adminDashboard:         check(isOperation || isOperationAdmin, 'admin_dashboard'),
        /** Accede al tab Weather Analytics */
        seeWeatherAnalytics:    check(true, 'see_weather'),

        // ── Schedule ─────────────────────────────────────────────────
        editSchedule:           check(isCrew || isOperation || isOperationAdmin, 'edit_schedule'),
        seeSchedule:            check(true, 'see_schedule'),

        // ── Chat ─────────────────────────────────────────────────────
        sendChatMessages:       true,

        // ── Metadati ─────────────────────────────────────────────────
        role,
        isCrew,
        isCrewAdmin,
        isOperation,
        isOperationAdmin,
    };
};

// ─── Helper: controlla se un ruolo esiste ─────────────────────────────────────
export const isValidRole = (role) => Object.values(ROLES).includes(role);

// ─── Helper: ruoli ordinati per livello (usato per select/dropdown) ───────────
export const ALL_ROLES_ORDERED = [
    { value: ROLES.CREW,             label: 'Crew' },
    { value: ROLES.CREW_ADMIN,       label: 'Crew Admin' },
    { value: ROLES.OPERATION,        label: 'Operations' },
    { value: ROLES.OPERATION_ADMIN,  label: 'Operations Admin' },
];

/**
 * activityUtils.js — Shared Activity Utilities
 * Centralizes logic previously duplicated across VesselActivityTab.jsx and MobileCrewActivity.jsx.
 */

/**
 * Returns a hex color code based on activity name string.
 * @param {string} activity - The activity name (e.g. 'Loading', 'Navigation')
 * @returns {string} Hex color code
 */
export const activityColor = (activity) => {
    const map = {
        'Loading':           '#10b981',
        'Unloading':         '#f59e0b',
        'Navigation':        '#3b82f6',
        'Anchorage':         '#8b5cf6',
        'Stand-by':          '#64748b',
        'Port Operations':   '#06b6d4',
        'Mooring':           '#14b8a6',
        'Technical Standby': '#38bdf8',
    };
    return map[activity] || '#94a3b8';
};

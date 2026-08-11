/**
 * timeConstants.js — Shared Time/Date Constants
 * Centralizes arrays previously duplicated in EditActivityModal.jsx and ManualActivityModal.jsx.
 */

export const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
export const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

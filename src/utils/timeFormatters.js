export const formatDate = (ts) => {
    if (!ts) return 'â€”';
    return new Date(ts).toLocaleDateString('en-GB', {
        day: '2-digit', month: '2-digit', year: '2-digit'
    });
};

export const formatHour = (ts) => {
    if (!ts) return 'â€”';
    return new Date(ts).toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit'
    });
};

export const formatTime = (ts) => {
    if (!ts) return 'â€”';
    return `${formatDate(ts)} ${formatHour(ts)}`;
};

export const calcDuration = (start, end) => {
    if (!start || !end) return null;
    const ms = new Date(end) - new Date(start);
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `${mins} m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h < 24) return `${h}h ${m} m`;
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24} h`;
};


export const mergeDateTime = (baseDate, timeStr) => {
    if (!timeStr) return null;
    try {
        const [hours, minutes] = timeStr.split(':');
        const d = new Date(baseDate);
        d.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        return d.toISOString();
    } catch { return null; }
};

export const fmt = (ts) => {
    if (!ts) return '';
    try {
        const d = new Date(ts);
        if (isNaN(d.getTime())) return '';
        const offset = d.getTimezoneOffset();
        return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 16);
    } catch { return ''; }
};

export const fmtDisplay = (ts) => {
    if (!ts) return '—';
    try { return new Date(ts).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return '—'; }
};

/**
 * formatTimeShort — Restituisce solo HH:MM da un timestamp.
 * Usato nei componenti Mobile. Precedentemente duplicato in MobileCrewActivity.jsx e MobileOperatorChat.jsx.
 */
export const formatTimeShort = (ts) => {
    if (!ts) return '--:--';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};


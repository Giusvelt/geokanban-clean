// Activities that need nautical services (not open-sea navigation)
export const NEEDS_SERVICES = ['Loading', 'Unloading', 'Port Operations', 'Mooring', 'Anchorage', 'Transit'];

// Activities where 'Transit' type = anchorage, no mooring crew expected
export const NO_MOORING = ['Transit', 'Anchorage', 'Navigation'];

// Activities requiring effective cargo entry
export const NEEDS_CARGO = ['Loading', 'Unloading'];

// Activities requiring bunker entry
export const NEEDS_BUNKER = ['Port Operations'];

export const ACTIVITY_COLORS = {
    'Loading': '#f59e0b',
    'Unloading': '#10b981',
    'Navigation': '#3b82f6',
    'Port Operations': '#8b5cf6',
    'Transit': '#6b7280',
    'Mooring': '#ec4899',
    'Anchorage': '#0891b2',
};

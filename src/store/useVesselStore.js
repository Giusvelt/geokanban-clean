import { create } from 'zustand';
import { supabase } from '../lib/supabase';

/**
 * Vessel Store
 * Manages the fleet list, historical tracking, and real-time positions.
 */
export const useVesselStore = create((set, get) => ({
    vessels: [],
    vesselPositions: [],
    loading: false,
    error: null,
    
    // Core Actions
    setVessels: (vessels) => set({ vessels }),
    
    fetchVessels: async () => {
        set({ loading: true });
        try {
            const { data: vesselsData, error: vesselsError } = await supabase
                .from('vessels')
                .select('*')
                .order('name');
            if (vesselsError) throw vesselsError;

            // Fetch active tracking status from the view
            const { data: activeData } = await supabase
                .from('active_vessels')
                .select('id');
            
            const activeIds = new Set(activeData?.map(v => v.id) || []);

            const enrichedVessels = (vesselsData || []).map(v => ({
                ...v,
                tracking_active: activeIds.has(v.id)
            }));

            set({ vessels: enrichedVessels });
        } catch (err) {
            set({ error: err.message });
        } finally {
            set({ loading: false });
        }
    },

    addVessel: async (vessel) => {
        try {
            const { data, error } = await supabase.from('vessels').insert(vessel).select().single();
            if (error) throw error;
            set(state => ({ vessels: [...state.vessels, data] }));
            return { success: true, data };
        } catch (err) {
            return { success: false, error: err.message };
        }
    },

    updateVessel: async (id, updates) => {
        try {
            // Strip out virtual/in-memory properties to avoid PostgREST schema errors
            const { tracking_active, ...cleanUpdates } = updates;
            const { error } = await supabase.from('vessels').update(cleanUpdates).eq('id', id);
            if (error) throw error;
            set(state => ({
                vessels: state.vessels.map(v => v.id === id ? { ...v, ...updates } : v)
            }));
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    },

    deleteVessel: async (id) => {
        try {
            const { error } = await supabase.from('vessels').delete().eq('id', id);
            if (error) throw error;
            set(state => ({ vessels: state.vessels.filter(v => v.id !== id) }));
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    },

    /**
     * Load historical positions from Supabase tracking table.
     * Optimized to fetch only the most recent points if needed.
     */
    loadHistoricalPositions: async (visibleVessels = []) => {
        if (!visibleVessels.length) return;
        
        const visibleIds = visibleVessels.map(v => v.id);
        
        // Calculate yesterday 23:59:59 UTC cutoff for T+1 Certified Historical Mode
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayEndIso = `${yesterday.toISOString().split('T')[0]}T23:59:59Z`;

        // Fetch latest point for EACH vessel individually up to yesterday end (T-1)
        const latestPromises = visibleVessels.map(v => 
            supabase
                .from('vessel_tracking')
                .select('vessel_id, mmsi, lat, lon, speed, heading, course, status, timestamp')
                .eq('vessel_id', v.id)
                .lte('timestamp', yesterdayEndIso)
                .order('timestamp', { ascending: false })
                .limit(1)
        );

        const results = await Promise.all(latestPromises);
        
        const latestMap = new Map();
        results.forEach(({ data, error }) => {
            if (!error && data && data.length > 0) {
                latestMap.set(data[0].vessel_id, data[0]);
            }
        });

        const positions = visibleVessels.map(v => {
            const track = latestMap.get(v.id);
            return {
                vessel: v.name,
                vesselId: v.id,
                lat: track?.lat || 0,
                lon: track?.lon || 0,
                speed: track?.speed || 0,
                heading: track?.heading || 0,
                course: track?.course || 0,
                status: track?.status || 'unknown',
                lastUpdate: track?.timestamp || null
            };
        });
        
        set({ vesselPositions: positions });
    },

    /**
     * Subscribe to real-time tracking updates from Supabase.
     */
    subscribeToTracking: (visibleVessels = []) => {
        if (!visibleVessels.length) return null;
        
        const channel = supabase
            .channel('vessel-tracking-realtime')
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'vessel_tracking' 
            }, (payload) => {
                const newPoint = payload.new;
                const { vessels, vesselPositions } = get();
                
                const vessel = vessels.find(v => v.id === newPoint.vessel_id || String(v.mmsi) === String(newPoint.mmsi));
                if (!vessel) return;

                const updatedPositions = vesselPositions.map(pos => {
                    if (pos.vesselId === vessel.id) {
                        return {
                            ...pos,
                            lat: newPoint.lat,
                            lon: newPoint.lon,
                            speed: newPoint.speed,
                            heading: newPoint.heading,
                            status: newPoint.status,
                            lastUpdate: newPoint.timestamp
                        };
                    }
                    return pos;
                });

                set({ vesselPositions: updatedPositions });
            })
            .subscribe();

        return channel;
    },

    /**
     * Overlay Datalastic live data onto the current positions.
     * @deprecated Use subscribeToTracking for DB-driven real-time instead.
     */
    updateLivePositions: (livePositions) => {
        // Keeping this for backward compatibility if needed, 
        // but the goal is to move fully to DB-driven tracking.
        const { vessels, vesselPositions } = get();
        if (!livePositions || !vessels.length || !vesselPositions.length) return;

        const vesselsByName = new Map();
        vessels.forEach(v => { if (v.name) vesselsByName.set(v.name, v); });

        let hasChanges = false;
        const newPositions = vesselPositions.map(pos => {
            const v = vesselsByName.get(pos.vessel);
            if (!v?.mmsi) return pos;
            
            const live = livePositions[v.mmsi];
            if (!live) return pos;

            if (pos.lat === live.lat && pos.lon === live.lon && pos.speed === live.speed && pos.heading === live.course) {
                return pos;
            }
            
            hasChanges = true;
            return {
                ...pos,
                lat: live.lat || pos.lat,
                lon: live.lon || pos.lon,
                speed: live.speed ?? pos.speed,
                heading: live.course ?? pos.heading,
                status: live.status || pos.status,
                lastUpdate: new Date().toISOString()
            };
        });

        if (hasChanges) set({ vesselPositions: newPositions });
    }
}));

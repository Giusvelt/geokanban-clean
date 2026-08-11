import { supabase } from '../../lib/supabase';

/**
 * weatherService.js — SOLID Service Layer
 * Centralizes all weather-related database queries.
 * Used by: WeatherAnalyticsTab.jsx
 */
export const weatherService = {
    /**
     * Fetch all vessels (id, name, mmsi) ordered by name.
     */
    async fetchVessels() {
        const { data, error } = await supabase
            .from('active_vessels')
            .select('id, name, mmsi, gross_tonnage')
            .order('name');
        if (error) throw error;
        return data || [];
    },

    /**
     * Fetch weather logs for a specific vessel within a date range.
     * Searches by both vessel name AND mmsi to cover all location_name formats:
     *   - "Vessel: MARIA VITTORIA Z"  (name-based, from newer edge function)
     *   - "Vessel: 248141000"         (mmsi-based, from older edge function runs)
     * @param {string} vesselName - The name of the vessel
     * @param {string|number} mmsi - The MMSI of the vessel
     * @param {string} startDate - Start date in YYYY-MM-DD format
     * @param {string} endDate - End date in YYYY-MM-DD format
     */
    async fetchWeatherLogs(vesselName, mmsi, startDate, endDate) {
        // Build OR filter: match by name OR by mmsi
        // location_name formats: "Vessel: NAME" or "Vessel: MMSI"
        const nameFilter = `location_name.ilike.%${vesselName}%`;
        const mmsiFilter = mmsi ? `location_name.eq.Vessel: ${mmsi}` : null;
        const orFilter = mmsiFilter ? `${nameFilter},${mmsiFilter}` : nameFilter;

        const { data, error } = await supabase
            .from('weather_logs')
            .select('*')
            .or(orFilter)
            .gte('timestamp', `${startDate}T00:00:00Z`)
            .lte('timestamp', `${endDate}T23:59:59Z`)
            .order('timestamp', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    /**
     * Fetch the latest weather log recorded for the Genoa reference location ('Scanno Diga').
     */
    async fetchLatestGenoaWeather() {
        const { data, error } = await supabase
            .from('weather_logs')
            .select('*')
            .eq('location_name', 'Scanno Diga')
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    /**
     * Fetch meteo_genova records (Scanno Diga) for a date range.
     * Used by WeatherAnalyticsTab to overlay the Genova reference curve on the vessel chart.
     * @param {string} startDate - Start date in YYYY-MM-DD format
     * @param {string} endDate - End date in YYYY-MM-DD format
     */
    async fetchGenovaRange(startDate, endDate) {
        const { data, error } = await supabase
            .from('meteo_genova')
            .select('timestamp, wave_height, wind_speed')
            .gte('timestamp', `${startDate}T00:00:00Z`)
            .lte('timestamp', `${endDate}T23:59:59Z`)
            .order('timestamp', { ascending: true });
        if (error) throw error;
        return data || [];
    }
};

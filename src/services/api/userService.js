import { supabase } from '../../lib/supabase';

/**
 * userService.js — SOLID Service Layer
 * Centralizes all user management database queries and RPCs.
 * Used by: UserManagementTab.jsx, AddUserModal.jsx
 */
export const userService = {
    /**
     * Load all user profiles with joined companies and vessels.
     */
    async fetchUsersWithRelations() {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*, companies(name), vessels(name, mmsi)')
            .order('display_name', { ascending: true });
        return { data, error };
    },

    /**
     * Fallback query without custom_overrides (for older schemas).
     */
    async fetchUsersFallback() {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('id, email, display_name, role, company_id, vessel_id, mmsi, is_blocked, last_seen_at, companies(name), vessels(name, mmsi)')
            .order('display_name', { ascending: true });
        return { data, error };
    },

    /**
     * Load all companies ordered by name.
     */
    async fetchCompanies() {
        const { data, error } = await supabase
            .from('companies')
            .select('*')
            .order('name');
        if (error) throw error;
        return data || [];
    },

    /**
     * Toggle the is_blocked flag on a user profile.
     * @param {string} userId
     * @param {boolean} isBlocked - the new blocked state
     */
    async toggleBlock(userId, isBlocked) {
        const { error } = await supabase
            .from('user_profiles')
            .update({ is_blocked: isBlocked })
            .eq('id', userId);
        if (error) throw error;
    },

    /**
     * Update an existing user via the update_user_v3 RPC.
     */
    async updateUser(userId, form) {
        try {
            const { data, error } = await supabase.rpc('update_user_v3', {
                target_user_id: userId,
                new_email: form.email || null,
                new_password: form.password || null,
                new_display_name: form.display_name || null,
                new_role: form.role,
                new_company_id: form.company_id || null,
                new_vessel_id: form.vessel_id || null,
                new_mmsi: form.mmsi || null,
                new_custom_overrides: form.custom_overrides || {}
            });
            if (!error && data && data.success) return data;
        } catch (rpcErr) {
            console.warn('RPC update_user_v3 non riuscito, eseguo l\'update diretto:', rpcErr);
        }

        // Fallback: update diretto sulla tabella user_profiles
        const payload = {
            display_name: form.display_name,
            role: form.role,
            company_id: form.company_id || null,
            vessel_id: form.vessel_id || null,
            mmsi: form.mmsi || null,
            custom_overrides: form.custom_overrides || {}
        };
        if (form.email) payload.email = form.email;
        if (form.password) payload.password_plain = form.password;

        const { data, error } = await supabase
            .from('user_profiles')
            .update(payload)
            .eq('id', userId)
            .select();

        if (error) throw error;
        return { success: true, data };
    },

    /**
     * Create a new user via the create_new_user_v3 RPC.
     */
    async createUser({ email, password, displayName, role, companyId, vesselId, mmsi, customOverrides }) {
        const { data, error } = await supabase.rpc('create_new_user_v3', {
            p_email: email,
            p_password: password,
            p_display_name: displayName,
            p_role: role,
            p_company_id: companyId || null,
            p_vessel_id: vesselId || null,
            p_mmsi: mmsi || null,
            p_custom_overrides: customOverrides
        });
        if (error) throw error;
        return data;
    }
};

import { useState, useEffect, useCallback } from 'react';
import { authService } from '../services/api/authService';
import { userService } from '../services/api/userService';
import { can } from '../lib/permissions';

export function useUserProfile() {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadProfile = useCallback(async () => {
        setLoading(true);
        const { data: { user } } = await authService.getUser();
        if (!user) {
            setProfile(null);
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('*, vessels(name, mmsi), companies(name, code)')
                .eq('id', user.id)
                .maybeSingle();

            if (data && !error) {
                const role = data.role || 'crew';
                setProfile({
                    id:           data.id,
                    email:        data.email,
                    displayName:  data.display_name,
                    role,
                    permissions:  can(role, data.custom_overrides || {}),
                    custom_overrides: data.custom_overrides || {},
                    vesselId:     data.vessel_id,
                    vesselName:   data.vessels?.name || null,
                    mmsi:         data.mmsi || data.vessels?.mmsi || null,
                    companyId:    data.company_id,
                    companyName:  data.companies?.name || null,
                    phoneNumber:  data.phone_number,
                    signatureTitle: data.signature_title,
                    isActive:     data.is_active,
                    isBlocked:    data.is_blocked || false,
                });
            } else {
                // Default Fallback
                setProfile({
                    id: user.id,
                    email: user.email,
                    displayName: user.email.split('@')[0],
                    role: 'crew',
                    permissions: can('crew'),
                    isActive: true,
                    isBlocked: false
                });
            }
        } catch (err) {
            console.error("Profile Load Error:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!profile?.id) return;
        const updateHeartbeat = async () => {
            await userService.updateLastSeen(profile.id);
        };
        updateHeartbeat();
        const interval = setInterval(updateHeartbeat, 60_000);
        return () => clearInterval(interval);
    }, [profile?.id]);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    return { 
        profile, 
        loading, 
        updateProfile: async (updates) => {
            const mapped = {};
            if (updates.displayName !== undefined) mapped.display_name = updates.displayName;
            if (updates.phoneNumber !== undefined) mapped.phone_number = updates.phoneNumber;
            if (updates.signatureTitle !== undefined) mapped.signature_title = updates.signatureTitle;
            if (updates.vesselId !== undefined) mapped.vessel_id = updates.vesselId;
            if (updates.companyId !== undefined) mapped.company_id = updates.companyId;
            if (updates.mmsi !== undefined) mapped.mmsi = updates.mmsi;
            if (updates.isActive !== undefined) mapped.is_active = updates.isActive;
            if (updates.isBlocked !== undefined) mapped.is_blocked = updates.isBlocked;
            if (updates.custom_overrides !== undefined) mapped.custom_overrides = updates.custom_overrides;

            const { error } = await userService.updateUserProfile(profile.id, mapped);
            if (!error) await loadProfile();
            return { error };
        }, 
        reloadProfile: loadProfile 
    };
}

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useProductionPlans() {
    const [plans, setPlans] = useState([]);

    const fetchPlans = useCallback(async () => {
        const { data, error } = await supabase
            .from('production_plans')
            .select('*')
            .order('period_name');
        if (!error && data) setPlans(data);
    }, []);

    const upsertPlan = async (plan) => {
        // Prepare the payload for upsert
        const payload = {
            vessel_id: plan.vessel_id || null, // Ensure null for global plans
            period_name: plan.period_name,
            target_trips: plan.target_trips || 0,
            target_quantity: plan.target_quantity || 0,
            status: 'active',
            updated_at: new Date().toISOString()
        };

        // If it's a vessel plan, we might want to preserve existing actuals if not provided
        // But since the DB trigger will recalculate them anyway, we can just send targets.
        
        const { data, error } = await supabase
            .from('production_plans')
            .upsert(payload, { 
                onConflict: 'vessel_id,period_name',
                ignoreDuplicates: false 
            })
            .select();

        if (!error) await fetchPlans();
        return { success: !error, data: data?.[0], error: error?.message };
    };

    const deletePlan = async (vesselId, periodName) => {
        const { error } = await supabase
            .from('production_plans')
            .delete()
            .eq('vessel_id', vesselId)
            .eq('period_name', periodName);
        if (!error) await fetchPlans();
    };

    useEffect(() => { fetchPlans(); }, [fetchPlans]);

    return { plans, fetchPlans, upsertPlan, deletePlan };
}

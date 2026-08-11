import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useUserProfile } from '../hooks/useUserProfile';
import { useGeofenceStore } from '../store/useGeofenceStore';
import { useVesselStore } from '../store/useVesselStore';
import { useActivityStore } from '../store/useActivityStore';
import { useConfigStore } from '../store/useConfigStore';
import { useProjectStore } from '../store/useProjectStore';
// Removed legacy useDatalastic import

const DataContext = createContext();
export const useData = () => useContext(DataContext);

export function DataProvider({ children }) {
    const { profile } = useUserProfile();

    // Zustand store bindings
    const { 
        vessels, vesselPositions, loading: vesselsLoading, 
        fetchVessels, addVessel, updateVessel, deleteVessel,
        loadHistoricalPositions, updateLivePositions, subscribeToTracking
    } = useVesselStore();

    const { 
        geofences, loading: geofencesLoading, 
        fetchGeofences, addGeofence, updateGeofence, deleteGeofence 
    } = useGeofenceStore();

    const { 
        activities, productionPlans, loading: activitiesLoading, lastUpdate,
        fetchActivities, upsertPlan, deletePlan, fetchPlans,
        selectedMonth, setSelectedMonth, selectedYear, setSelectedYear
    } = useActivityStore();

    const { 
        standbyReasons, schedules, 
        fetchReasons, fetchSchedules, upsertSchedule, deleteSchedule,
        addStandbyReason, updateStandbyReason, deleteStandbyReason,
        approveSchedule, rejectSchedule
    } = useConfigStore();

    const { fetchProjects } = useProjectStore();

    // Replaced legacy useDatalastic hook call with DB-driven tracking

    const crewVesselId = useMemo(() => {
        if (!profile || !vessels?.length) return null;
        if (profile.role !== 'crew') return null;
        if (profile.vesselId) return profile.vesselId;
        if (profile.mmsi) {
            const byMmsi = vessels.find(v => String(v.mmsi) === String(profile.mmsi));
            if (byMmsi) return byMmsi.id;
        }
        return null;
    }, [profile, vessels]);

    const companyVesselIds = useMemo(() => {
        if (!profile || !vessels?.length) return null;
        if (profile.role !== 'crew_admin') return null;
        if (!profile.companyId) return null;
        return vessels.filter(v => v.company_id === profile.companyId).map(v => v.id);
    }, [profile, vessels]);

    useEffect(() => {
        fetchProjects(profile?.id, profile?.role);
        fetchVessels();
        fetchGeofences();
        fetchReasons();
        fetchSchedules();
        fetchPlans();
    }, [fetchProjects, profile?.id, profile?.role, fetchVessels, fetchGeofences, fetchReasons, fetchSchedules, fetchPlans]);

    // Fetch activities
    useEffect(() => {
        if (!profile) return;
        let targetId = null;
        if (profile.role === 'crew') {
            if (!crewVesselId) return;
            targetId = crewVesselId;
        } else if (profile.role === 'crew_admin') {
            if (!companyVesselIds) return;
            targetId = companyVesselIds;
        }
        fetchActivities(targetId, profile.role, selectedMonth, selectedYear);
    }, [profile, crewVesselId, companyVesselIds, fetchActivities, selectedMonth, selectedYear]);

    // Realtime: Updates KPI when a logbook is certified or activity is inserted
    useEffect(() => {
        let targetId = null;
        if (profile?.role === 'crew') targetId = crewVesselId;
        else if (profile?.role === 'crew_admin') targetId = companyVesselIds;

        const channel = supabase
            .channel('kpi-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'logbook_entries' },
                () => { 
                    fetchActivities(targetId, profile?.role);
                    fetchPlans(); // Crucial for Admin KPI sync
                }
            )
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vessel_activity' },
                () => { fetchActivities(targetId, profile?.role); }
            )
            .on('postgres_changes', { event: '*', schema: 'public', table: 'production_plans' },
                () => { fetchPlans(); }
            )
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [profile, crewVesselId, companyVesselIds, fetchActivities, fetchPlans]);

    // Realtime Tracking: Replaces direct AIS polling with DB-driven updates
    useEffect(() => {
        if (!vessels?.length || !profile) return;

        let visibleVessels = vessels;
        if (profile.role === 'crew' && crewVesselId) {
            const crewVessel = vessels.find(v => v.id === crewVesselId);
            const crewCompanyId = crewVessel?.company_id || profile.companyId;
            visibleVessels = crewCompanyId
                ? vessels.filter(v => v.company_id === crewCompanyId)
                : [crewVessel].filter(Boolean);
        } else if (profile.role === 'crew_admin' && profile.companyId) {
            visibleVessels = vessels.filter(v => v.company_id === profile.companyId);
        }
        
        // 1. Load initial "Latest" state from DB
        loadHistoricalPositions(visibleVessels);
        
        // 2. Subscribe to new points (Realtime)
        const channel = subscribeToTracking(visibleVessels);
        
        // 3. Periodic full sync as fallback (every 5 mins)
        const interval = setInterval(() => {
            loadHistoricalPositions(visibleVessels);
        }, 5 * 60 * 1000);
        
        // 4. Recovery strategy for PC Sleep / Network reconnection
        const handleWakeUp = () => {
            if (document.visibilityState === 'visible' && navigator.onLine) {
                console.log("[DataContext] Recovery trigger: refreshing AIS positions after sleep/offline");
                loadHistoricalPositions(visibleVessels);
                // Also trigger a refresh of other critical data
                fetchActivities(profile?.role === 'crew' ? crewVesselId : companyVesselIds, profile?.role);
                fetchVessels();
            }
        };

        window.addEventListener('visibilitychange', handleWakeUp);
        window.addEventListener('online', handleWakeUp);
        
        return () => {
            clearInterval(interval);
            window.removeEventListener('visibilitychange', handleWakeUp);
            window.removeEventListener('online', handleWakeUp);
            if (channel) supabase.removeChannel(channel);
        };
    }, [vessels.length, crewVesselId, profile?.role, profile?.companyId, loadHistoricalPositions, subscribeToTracking, fetchActivities, fetchVessels, companyVesselIds]);

    const value = useMemo(() => ({
        vessels, vesselPositions, geofences, activities, productionPlans,
        standbyReasons, schedules,
        profile, crewVesselId, companyVesselIds, lastUpdate,
        selectedMonth, setSelectedMonth, selectedYear, setSelectedYear,
        loading: vesselsLoading || geofencesLoading || activitiesLoading,
        fetchVessels, addVessel, updateVessel, deleteVessel,
        fetchGeofences, addGeofence, updateGeofence, deleteGeofence,
        fetchActivities,
        upsertPlan, deletePlan, fetchPlans,
        subscribeToTracking, loadHistoricalPositions,
        // useConfigStore explicitly named fetchReasons, but context expects fetchStandbyReasons
        fetchStandbyReasons: fetchReasons, 
        fetchSchedules, upsertSchedule, deleteSchedule,
        addStandbyReason, updateStandbyReason, deleteStandbyReason,
        approveSchedule, rejectSchedule
    }), [
        vessels, vesselPositions, geofences, activities, productionPlans,
        standbyReasons, schedules, profile, crewVesselId, companyVesselIds, lastUpdate,
        selectedMonth, setSelectedMonth, selectedYear, setSelectedYear,
        vesselsLoading, geofencesLoading, activitiesLoading,
        fetchVessels, addVessel, updateVessel, deleteVessel,
        fetchGeofences, addGeofence, updateGeofence, deleteGeofence,
        fetchActivities, upsertPlan, deletePlan, fetchPlans,
        fetchReasons, fetchSchedules, upsertSchedule, deleteSchedule,
        addStandbyReason, updateStandbyReason, deleteStandbyReason, approveSchedule, rejectSchedule, subscribeToTracking
    ]);

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

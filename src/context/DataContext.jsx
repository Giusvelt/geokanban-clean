import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useUserProfile } from '../hooks/useUserProfile';
import { useGeofenceStore } from '../store/useGeofenceStore';
import { useVesselStore } from '../store/useVesselStore';
import { useActivityStore } from '../store/useActivityStore';
import { useConfigStore } from '../store/useConfigStore';
import { useProjectStore } from '../store/useProjectStore';

// ─── 3 Context slice separati ────────────────────────────────────────────────
// Dividere il god-context in slice indipendenti riduce i re-render:
// - un aggiornamento AIS  → solo consumer di useFleet() re-renderizzano
// - un logbook certificato → solo consumer di useOperations() re-renderizzano
// - uno schedule approvato → solo consumer di useConfig() re-renderizzano
//
// useData() rimane disponibile come alias backward-compat per i 21 consumer
// esistenti — zero breaking changes, migrazione incrementale possibile.
// ─────────────────────────────────────────────────────────────────────────────

const FleetContext      = createContext();
const OperationsContext = createContext();
const ConfigContext     = createContext();

/** Vessels, posizioni live, tracking realtime, ID equipaggio/compagnia. */
export const useFleet      = () => useContext(FleetContext);

/** Attività, production plans, geofence, filtri mese/anno, KPI. */
export const useOperations = () => useContext(OperationsContext);

/** Profilo utente, standby reasons, schedule, permessi. */
export const useConfig     = () => useContext(ConfigContext);

/**
 * Hook di compatibilità backward — aggrega i 3 slice.
 * I 21 componenti esistenti continuano a funzionare senza modifiche.
 * @deprecated Preferire useFleet() / useOperations() / useConfig() per
 *             componenti nuovi o refactoring futuri (riduce i re-render).
 */
export const useData = () => ({
    ...useFleet(),
    ...useOperations(),
    ...useConfig(),
});

// ─── DataProvider — unico orchestratore ──────────────────────────────────────
export function DataProvider({ children }) {
    const { profile } = useUserProfile();

    // ── Zustand store bindings ──────────────────────────────────────────────
    const {
        vessels, vesselPositions, loading: vesselsLoading,
        fetchVessels, addVessel, updateVessel, deleteVessel,
        loadHistoricalPositions, updateLivePositions, subscribeToTracking,
    } = useVesselStore();

    const {
        geofences, loading: geofencesLoading,
        fetchGeofences, addGeofence, updateGeofence, deleteGeofence,
    } = useGeofenceStore();

    const {
        activities, productionPlans, loading: activitiesLoading, lastUpdate,
        fetchActivities, upsertPlan, deletePlan, fetchPlans,
        selectedMonth, setSelectedMonth, selectedYear, setSelectedYear,
    } = useActivityStore();

    const {
        standbyReasons, schedules,
        fetchReasons, fetchSchedules, upsertSchedule, deleteSchedule,
        addStandbyReason, updateStandbyReason, deleteStandbyReason,
        approveSchedule, rejectSchedule,
    } = useConfigStore();

    const { fetchProjects } = useProjectStore();

    // ── Computed: ID nave dell'utente crew ──────────────────────────────────
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

    // ── Initial data fetch ──────────────────────────────────────────────────
    useEffect(() => {
        fetchProjects(profile?.id, profile?.role);
        fetchVessels();
        fetchGeofences();
        fetchReasons();
        fetchSchedules();
        fetchPlans();
    }, [fetchProjects, profile?.id, profile?.role, fetchVessels, fetchGeofences, fetchReasons, fetchSchedules, fetchPlans]);

    // ── Fetch activities (dipende da role + vessel scope) ───────────────────
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

    // ── Realtime KPI: logbook certificato / attività inserita ───────────────
    useEffect(() => {
        let targetId = null;
        if (profile?.role === 'crew')       targetId = crewVesselId;
        else if (profile?.role === 'crew_admin') targetId = companyVesselIds;

        const channel = supabase
            .channel('kpi-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'logbook_entries' },
                () => {
                    fetchActivities(targetId, profile?.role);
                    fetchPlans(); // Sync KPI Admin
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

    // ── Realtime Tracking: DB-driven, con recovery da sleep/offline ─────────
    useEffect(() => {
        if (!vessels?.length || !profile) return;

        let visibleVessels = vessels;
        if (profile.role === 'crew' && crewVesselId) {
            const crewVessel    = vessels.find(v => v.id === crewVesselId);
            const crewCompanyId = crewVessel?.company_id || profile.companyId;
            visibleVessels = crewCompanyId
                ? vessels.filter(v => v.company_id === crewCompanyId)
                : [crewVessel].filter(Boolean);
        } else if (profile.role === 'crew_admin' && profile.companyId) {
            visibleVessels = vessels.filter(v => v.company_id === profile.companyId);
        }

        loadHistoricalPositions(visibleVessels);
        const channel  = subscribeToTracking(visibleVessels);
        const interval = setInterval(() => loadHistoricalPositions(visibleVessels), 5 * 60 * 1000);

        const handleWakeUp = () => {
            if (document.visibilityState === 'visible' && navigator.onLine) {
                loadHistoricalPositions(visibleVessels);
                fetchActivities(
                    profile?.role === 'crew' ? crewVesselId : companyVesselIds,
                    profile?.role
                );
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
    }, [vessels, crewVesselId, profile?.role, profile?.companyId,
        loadHistoricalPositions, subscribeToTracking, fetchActivities, fetchVessels, companyVesselIds]);

    // ── Slice 1: Fleet ───────────────────────────────────────────────────────
    const fleetValue = useMemo(() => ({
        vessels,
        vesselPositions,
        crewVesselId,
        companyVesselIds,
        loading: vesselsLoading,
        fetchVessels,
        addVessel,
        updateVessel,
        deleteVessel,
        loadHistoricalPositions,
        subscribeToTracking,
    }), [
        vessels, vesselPositions, crewVesselId, companyVesselIds, vesselsLoading,
        fetchVessels, addVessel, updateVessel, deleteVessel,
        loadHistoricalPositions, subscribeToTracking,
    ]);

    // ── Slice 2: Operations ──────────────────────────────────────────────────
    const operationsValue = useMemo(() => ({
        activities,
        productionPlans,
        geofences,
        lastUpdate,
        selectedMonth,
        setSelectedMonth,
        selectedYear,
        setSelectedYear,
        loading: activitiesLoading || geofencesLoading,
        fetchActivities,
        upsertPlan,
        deletePlan,
        fetchPlans,
        fetchGeofences,
        addGeofence,
        updateGeofence,
        deleteGeofence,
    }), [
        activities, productionPlans, geofences, lastUpdate,
        selectedMonth, setSelectedMonth, selectedYear, setSelectedYear,
        activitiesLoading, geofencesLoading,
        fetchActivities, upsertPlan, deletePlan, fetchPlans,
        fetchGeofences, addGeofence, updateGeofence, deleteGeofence,
    ]);

    // ── Slice 3: Config ──────────────────────────────────────────────────────
    const configValue = useMemo(() => ({
        profile,
        standbyReasons,
        schedules,
        // useConfigStore espone fetchReasons, ma i consumer si aspettano fetchStandbyReasons
        fetchStandbyReasons: fetchReasons,
        fetchSchedules,
        upsertSchedule,
        deleteSchedule,
        addStandbyReason,
        updateStandbyReason,
        deleteStandbyReason,
        approveSchedule,
        rejectSchedule,
    }), [
        profile, standbyReasons, schedules,
        fetchReasons, fetchSchedules, upsertSchedule, deleteSchedule,
        addStandbyReason, updateStandbyReason, deleteStandbyReason,
        approveSchedule, rejectSchedule,
    ]);

    return (
        <FleetContext.Provider value={fleetValue}>
            <OperationsContext.Provider value={operationsValue}>
                <ConfigContext.Provider value={configValue}>
                    {children}
                </ConfigContext.Provider>
            </OperationsContext.Provider>
        </FleetContext.Provider>
    );
}

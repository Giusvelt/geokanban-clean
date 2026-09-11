import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { pubsubService } from '../services/api/pubsubService';
import { useUserProfile } from '../hooks/useUserProfile';
import { useGeofenceStore } from '../store/useGeofenceStore';
import { useVesselStore } from '../store/useVesselStore';
import { useActivityStore } from '../store/useActivityStore';
import { useConfigStore } from '../store/useConfigStore';
import { useProjectStore } from '../store/useProjectStore';

// â”€â”€â”€ 3 Context slice separati â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Dividere il god-context in slice indipendenti riduce i re-render:
// - un aggiornamento AIS  â†’ solo consumer di useFleet() re-renderizzano
// - un logbook certificato â†’ solo consumer di useOperations() re-renderizzano
// - uno schedule approvato â†’ solo consumer di useConfig() re-renderizzano
//
// useData() rimane disponibile come alias backward-compat per i 21 consumer
// esistenti â€” zero breaking changes, migrazione incrementale possibile.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const FleetContext      = createContext();
const OperationsContext = createContext();
const ConfigContext     = createContext();

/** Vessels, posizioni live, tracking realtime, ID equipaggio/compagnia. */
export const useFleet      = () => useContext(FleetContext);

/** AttivitÃ , production plans, geofence, filtri mese/anno, KPI. */
export const useOperations = () => useContext(OperationsContext);

/** Profilo utente, standby reasons, schedule, permessi. */
export const useConfig     = () => useContext(ConfigContext);

/**
 * Hook di compatibilitÃ  backward â€” aggrega i 3 slice.
 * I 21 componenti esistenti continuano a funzionare senza modifiche.
 * @deprecated Preferire useFleet() / useOperations() / useConfig() per
 *             componenti nuovi o refactoring futuri (riduce i re-render).
 */
export const useData = () => ({
    ...useFleet(),
    ...useOperations(),
    ...useConfig(),
});

// â”€â”€â”€ DataProvider â€” unico orchestratore â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function DataProvider({ children }) {
    const { profile } = useUserProfile();

    // â”€â”€ Zustand store bindings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€ Computed: ID nave dell'utente crew â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€ Initial data fetch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    useEffect(() => {
        fetchProjects(profile?.id, profile?.role);
        fetchVessels();
        fetchGeofences();
        fetchReasons();
        fetchSchedules();
        fetchPlans();
    }, [fetchProjects, profile?.id, profile?.role, fetchVessels, fetchGeofences, fetchReasons, fetchSchedules, fetchPlans]);

    // â”€â”€ Fetch activities (dipende da role + vessel scope) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€ Realtime KPI: logbook certificato / attivitÃ  inserita â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    useEffect(() => {
        let targetId = null;
        if (profile?.role === 'crew')       targetId = crewVesselId;
        else if (profile?.role === 'crew_admin') targetId = companyVesselIds;

                const channel = pubsubService.subscribeGlobal('kpi-realtime', { event: '*', schema: 'public' }, (payload) => {
            if (payload.table === 'logbook_entries') {
                fetchActivities(targetId, profile?.role);
                fetchPlans(); // Sync KPI Admin
            } else if (payload.table === 'vessel_activity' && payload.eventType === 'INSERT') {
                fetchActivities(targetId, profile?.role);
            } else if (payload.table === 'production_plans') {
                fetchPlans();
            }
        });

        return () => pubsubService.unsubscribe(channel);
    }, [profile, crewVesselId, companyVesselIds, fetchActivities, fetchPlans]);

    // â”€â”€ Realtime Tracking: DB-driven, con recovery da sleep/offline â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
            if (channel) pubsubService.unsubscribe(channel);
        };
    }, [vessels, crewVesselId, profile?.role, profile?.companyId,
        loadHistoricalPositions, subscribeToTracking, fetchActivities, fetchVessels, companyVesselIds]);

    // â”€â”€ Slice 1: Fleet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€ Slice 2: Operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€ Slice 3: Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

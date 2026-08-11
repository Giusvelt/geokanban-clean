import { supabase } from '../../lib/supabase';

export const activityService = {
    async certifyMonthlySal(month, year) {
        const { data, error } = await supabase.rpc('certify_monthly_sal', { p_month: month, p_year: year });
        if (error) throw error;
        return data;
    },

    async createManualActivity(payload) {
        const newStart = new Date(payload.startTime);
        const newEnd = payload.endTime ? new Date(payload.endTime) : null;

        // 1. Fetch overlapping activities for this vessel
        let query = supabase
            .from('vessel_activity')
            .select('*')
            .eq('vessel_id', payload.vesselId);

        if (newEnd) {
            query = query.lt('start_time', newEnd.toISOString())
                         .or(`end_time.gt.${newStart.toISOString()},end_time.is.null`);
        } else {
            // Se la nuova attività non ha una fine, si sovrappone a tutto ciò che inizia dopo
            // o che la contiene.
            query = query.or(`start_time.gte.${newStart.toISOString()},and(start_time.lt.${newStart.toISOString()},or(end_time.gt.${newStart.toISOString()},end_time.is.null))`);
        }

        const { data: overlapping, error: fetchErr } = await query;
        if (fetchErr) throw new Error("Errore nel controllo overlap: " + fetchErr.message);

        const newGeo = payload.geofenceId || payload.geofenceFromId;

        if (overlapping && overlapping.length > 0) {
            for (let act of overlapping) {
                const actStart = new Date(act.start_time);
                const actEnd = act.end_time ? new Date(act.end_time) : null;

                const startsBefore = actStart < newStart;
                const endsAfter = newEnd && actEnd ? (actEnd > newEnd) : (!actEnd && newEnd !== null);

                // Caso C: Completamente inglobata (inizia >= newStart e finisce <= newEnd)
                const startsInside = actStart >= newStart;
                const endsInside = newEnd ? (actEnd && actEnd <= newEnd) : true;

                if (startsInside && endsInside) {
                    await supabase.from('vessel_activity').delete().eq('id', act.id);
                    continue;
                }

                // Caso D: Contiene completamente la nuova (Split Implicito)
                if (startsBefore && endsAfter) {
                    const firstLegGeoTo = (act.activity_type && act.activity_type.includes('Navigation')) ? newGeo : act.geofence_to_id;
                    const secondLegGeoFrom = (act.activity_type && act.activity_type.includes('Navigation')) ? (payload.geofenceId || payload.geofenceToId) : act.geofence_from_id;

                    await supabase.from('vessel_activity')
                        .update({ end_time: newStart.toISOString(), status: 'completed', geofence_to_id: firstLegGeoTo })
                        .eq('id', act.id);
                        
                    delete act.id; // prepare for insert
                    await supabase.from('vessel_activity')
                        .insert({
                            ...act,
                            geofence_from_id: secondLegGeoFrom,
                            start_time: newEnd.toISOString(),
                            status: act.end_time ? 'completed' : 'active',
                            source: 'manual'
                        });
                    continue;
                }

                // Caso A: Inizia prima, ma finisce "dentro" la nuova
                if (startsBefore && !endsAfter) {
                    const firstLegGeoTo = (act.activity_type && act.activity_type.includes('Navigation')) ? newGeo : act.geofence_to_id;
                    await supabase.from('vessel_activity')
                        .update({ end_time: newStart.toISOString(), status: 'completed', geofence_to_id: firstLegGeoTo })
                        .eq('id', act.id);
                }

                // Caso B: Inizia "dentro" la nuova, ma finisce dopo
                if (!startsBefore && endsAfter && newEnd) {
                    const secondLegGeoFrom = (act.activity_type && act.activity_type.includes('Navigation')) ? (payload.geofenceId || payload.geofenceToId) : act.geofence_from_id;
                    await supabase.from('vessel_activity')
                        .update({ start_time: newEnd.toISOString(), geofence_from_id: secondLegGeoFrom })
                        .eq('id', act.id);
                }
            }
        }

        // Finalmente, inseriamo la nuova attività pulita
        const { data, error } = await supabase
            .from('vessel_activity')
            .insert({
                vessel_id: payload.vesselId,
                activity_type: payload.activityType,
                geofence_id: payload.geofenceId || null,
                geofence_from_id: payload.geofenceFromId || null,
                geofence_to_id: payload.geofenceToId || null,
                start_time: payload.startTime,
                end_time: payload.endTime || null,
                source: 'manual',
                status: payload.endTime ? 'completed' : 'active'
            })
            .select()
            .single();
            
        if (error) throw error;
        return data;
    },

    async createManualActivityAndSplit(payload, originalActivityId) {
        // 1. Fetch full details of the original activity to be split
        const { data: original, error: fetchErr } = await supabase
            .from('vessel_activity')
            .select('*')
            .eq('id', originalActivityId)
            .single();
        if (fetchErr) throw new Error("Could not find the overlapping activity to split: " + fetchErr.message);

        // 2. Step A: Update the first segment (original activity) to end at the new start time
        // If the original activity is a Navigation, update its destination to be the new geofence
        const firstLegGeoTo = (original.activity_type && original.activity_type.includes('Navigation'))
            ? (payload.geofenceId || payload.geofenceFromId)
            : original.geofence_to_id;

        const { error: updateErr } = await supabase
            .from('vessel_activity')
            .update({
                end_time: payload.startTime,
                status: 'completed',
                geofence_to_id: firstLegGeoTo
            })
            .eq('id', original.id);
        if (updateErr) throw new Error("Failed to update first segment: " + updateErr.message);

        // 3. Step B: Insert the new manual activity
        const { data: insertedNew, error: insertNewErr } = await supabase
            .from('vessel_activity')
            .insert({
                vessel_id: payload.vesselId,
                activity_type: payload.activityType,
                geofence_id: payload.geofenceId || null,
                geofence_from_id: payload.geofenceFromId || null,
                geofence_to_id: payload.geofenceToId || null,
                start_time: payload.startTime,
                end_time: payload.endTime || null,
                source: 'manual',
                status: 'completed'
            })
            .select()
            .single();
        if (insertNewErr) {
            // Attempt to restore first segment
            await supabase
                .from('vessel_activity')
                .update({ 
                    end_time: original.end_time, 
                    status: original.status,
                    geofence_to_id: original.geofence_to_id
                })
                .eq('id', original.id);
            throw new Error("Failed to insert new activity: " + insertNewErr.message);
        }

        // 4. Step C: Insert the second segment (starts at new ATD, ends at original ATD)
        // If the original activity is a Navigation, update its origin to be the new geofence
        const secondLegGeoFrom = (original.activity_type && original.activity_type.includes('Navigation'))
            ? (payload.geofenceId || payload.geofenceToId)
            : original.geofence_from_id;

        const { error: insertSecondErr } = await supabase
            .from('vessel_activity')
            .insert({
                vessel_id: original.vessel_id,
                activity_type: original.activity_type,
                geofence_id: original.geofence_id,
                geofence_from_id: secondLegGeoFrom,
                geofence_to_id: original.geofence_to_id,
                start_time: payload.endTime, // Starts where the new one ends
                end_time: original.end_time, // Could be null (in progress)
                source: original.source,
                status: original.end_time ? 'completed' : 'active',
                weather_wind: original.weather_wind,
                weather_wave: original.weather_wave,
                probable_weather_standby: original.probable_weather_standby
            });
        if (insertSecondErr) {
            // Rollback first segment and delete the inserted new activity
            await supabase
                .from('vessel_activity')
                .update({ 
                    end_time: original.end_time, 
                    status: original.status,
                    geofence_to_id: original.geofence_to_id
                })
                .eq('id', original.id);
            await supabase
                .from('vessel_activity')
                .delete()
                .eq('id', insertedNew.id);
            throw new Error("Failed to insert split segment: " + insertSecondErr.message);
        }

        return insertedNew;
    },

    async deleteActivity(activityId) {
        // First delete any logbook entries associated with this activity (since they don't cascade automatically)
        const { error: logbookErr } = await supabase
            .from('logbook_entries')
            .delete()
            .eq('vessel_activity_id', activityId);
        if (logbookErr) throw logbookErr;

        // Now delete the activity itself
        const { data, error } = await supabase
            .from('vessel_activity')
            .delete()
            .eq('id', activityId)
            .select();
        if (error) throw error;
        return data;
    },

    async updateActivity(id, updates) {
        const { data, error } = await supabase
            .from('vessel_activity')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async fetchActivitiesRange(vesselId, startDate, endDate) {
        let query = supabase
            .from('vessel_activity')
            .select(`
                id, vessel_id, start_time, end_time, activity_type,
                geofence_from_id, geofence_to_id,
                geofence_from:geofences!vessel_activity_geofence_from_id_fkey(name),
                geofence_to:geofences!vessel_activity_geofence_to_id_fkey(name)
            `)
            .or(`vessel_id.eq.${vesselId},vessel_id.is.null`)
            .gte('start_time', `${startDate}T00:00:00Z`)
            .lte('start_time', `${endDate}T23:59:59Z`)
            .order('start_time', { ascending: true });

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }
};


import { supabase } from '../../lib/supabase';

/**
 * scheduleService.js — SOLID Service Layer
 * Centralizes all standby schedule database operations.
 * Used by: StandbySchedule.jsx
 */
export const scheduleService = {
    /**
     * Insert a new standby schedule entry (single day).
     */
    async insertSchedule({ vesselId, standbyDate, standbyReasonId, notes, createdBy, allDay = true, startTime = null, endTime = null }) {
        const { error } = await supabase
            .from('vessel_standby_schedule')
            .insert({
                vessel_id: vesselId,
                standby_date: standbyDate,
                standby_reason_id: standbyReasonId,
                notes,
                created_by: createdBy,
                all_day: allDay,
                start_time: allDay ? null : startTime,
                end_time: allDay ? null : endTime,
            });
        if (error) throw error;
    },

    /**
     * Insert standby for a date range (multi-day).
     * Creates one record per day in the range.
     * - allDay = true: full day for each day in range
     * - allDay = false: startTime/endTime applied with boundary logic:
     *     First day: startTime → '23:59'
     *     Middle days: '00:00' → '23:59'
     *     Last day: '00:00' → endTime
     *     Single day: startTime → endTime
     */
    async insertScheduleRange({ vesselId, startDate, endDate, standbyReasonId, notes, createdBy, allDay = true, startTime = null, endTime = null }) {
        const rows = [];
        const current = new Date(startDate + 'T00:00:00');
        const last = new Date(endDate + 'T00:00:00');

        let dayIndex = 0;
        const totalDays = Math.round((last - current) / 86400000) + 1;

        while (current <= last) {
            const yy = current.getFullYear();
            const mm = String(current.getMonth() + 1).padStart(2, '0');
            const dd = String(current.getDate()).padStart(2, '0');
            const dateStr = `${yy}-${mm}-${dd}`;

            let rowStartTime = null;
            let rowEndTime = null;

            if (!allDay) {
                if (totalDays === 1) {
                    rowStartTime = startTime;
                    rowEndTime = endTime;
                } else if (dayIndex === 0) {
                    rowStartTime = startTime;
                    rowEndTime = '23:59:00';
                } else if (dayIndex === totalDays - 1) {
                    rowStartTime = '00:00:00';
                    rowEndTime = endTime;
                } else {
                    rowStartTime = '00:00:00';
                    rowEndTime = '23:59:00';
                }
            }

            rows.push({
                vessel_id: vesselId,
                standby_date: dateStr,
                standby_reason_id: standbyReasonId,
                notes,
                created_by: createdBy,
                all_day: allDay,
                start_time: rowStartTime,
                end_time: rowEndTime,
            });

            current.setDate(current.getDate() + 1);
            dayIndex++;
        }

        if (rows.length === 0) return;

        const { error } = await supabase
            .from('vessel_standby_schedule')
            .insert(rows);
        if (error) throw error;
    },

    /**
     * Update an existing standby schedule entry.
     */
    async updateSchedule(id, { standbyReasonId, notes, allDay = true, startTime = null, endTime = null }) {
        const { error } = await supabase
            .from('vessel_standby_schedule')
            .update({
                standby_reason_id: standbyReasonId,
                notes,
                all_day: allDay,
                start_time: allDay ? null : startTime,
                end_time: allDay ? null : endTime,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
        if (error) throw error;
    },

    /**
     * Delete a standby schedule entry by ID.
     */
    async deleteSchedule(id) {
        const { error } = await supabase
            .from('vessel_standby_schedule')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};

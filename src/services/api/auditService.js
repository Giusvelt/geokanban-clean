import { supabase } from '../../lib/supabase';
import { getDeviceFingerprint } from '../../utils/deviceUtils';

export const auditService = {
    async logAction(activityId, userId, action, newValues) {
        try {
            await supabase.from('audit_logs').insert({
                activity_id: activityId,
                user_id: userId,
                action: action,
                new_values: newValues,
                device_info: getDeviceFingerprint()
            });
        } catch (auditErr) {
            console.warn('Audit Log failed (silent):', auditErr);
        }
    }
};

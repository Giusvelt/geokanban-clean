import { supabase } from '../../lib/supabase';

/**
 * messagesService.js — SOLID Service Layer (Refactored)
 * Centralizes ALL activity messaging operations.
 * Used by: ActivityChatModal.jsx, MobileOperatorChat.jsx, VesselActivityTab.jsx
 */
export const messagesService = {
    /**
     * Fetch recent messages for a quick preview (used by VesselActivityTab).
     */
    async fetchRecentMessages(activityId, limit = 2) {
        const { data, error } = await supabase
            .from('activity_messages')
            .select('message_text, sender_role')
            .eq('vessel_activity_id', activityId)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data || [];
    },

    /**
     * Fetch all messages for an activity with sender profile join.
     * Falls back to a simpler query if the FK relationship fails.
     */
    async fetchMessagesForActivity(activityId) {
        const { data, error } = await supabase
            .from('activity_messages')
            .select(`
                id, sender_id, sender_role, message_text, created_at, is_read,
                user_profiles:sender_id ( display_name )
            `)
            .eq('vessel_activity_id', activityId)
            .order('created_at', { ascending: true });

        if (error) {
            // Fallback without join if FK relationship issue
            if (error.message.includes('relationship')) {
                console.warn('⚠️ messagesService: FK fallback (no user_profiles join)');
                const { data: fallbackData, error: fbErr } = await supabase
                    .from('activity_messages')
                    .select('*')
                    .eq('vessel_activity_id', activityId)
                    .order('created_at', { ascending: true });
                if (fbErr) throw fbErr;
                return fallbackData || [];
            }
            throw error;
        }
        return data || [];
    },

    /**
     * Send a new message for an activity.
     */
    async sendMessage({ activityId, senderId, senderRole, messageText }) {
        const { error } = await supabase
            .from('activity_messages')
            .insert({
                vessel_activity_id: activityId,
                sender_id: senderId,
                sender_role: senderRole,
                message_text: messageText
            });
        if (error) throw error;
    },

    /**
     * Mark all messages in an activity as read for the opposite role.
     */
    async markAsRead(activityId, currentRole) {
        const { error } = await supabase
            .from('activity_messages')
            .update({ is_read: true })
            .eq('vessel_activity_id', activityId)
            .neq('sender_role', currentRole)
            .is('is_read', false);
        if (error) console.error('markAsRead error:', error.message);
    },

    /**
     * Subscribe to realtime inserts for a specific activity.
     * Returns the channel so the caller can unsubscribe.
     */
    subscribeToActivity(activityId, onNewMessage) {
        const channel = supabase
            .channel(`activity_chat_${activityId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'activity_messages',
                filter: `vessel_activity_id=eq.${activityId}`
            }, onNewMessage)
            .subscribe();
        return channel;
    },

    /**
     * Subscribe to all activity_messages inserts globally (for chat list).
     * Returns the channel so the caller can unsubscribe.
     */
    subscribeGlobal(onNewMessage) {
        const channel = supabase
            .channel('global_chat_updates')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'activity_messages'
            }, onNewMessage)
            .subscribe();
        return channel;
    },

    /**
     * Unsubscribe from a realtime channel.
     */
    unsubscribe(channel) {
        supabase.removeChannel(channel);
    },

    /**
     * Fetch conversations list (activities with their messages) for chat view.
     */
    async fetchConversations() {
        const { data, error } = await supabase
            .from('vessel_activity')
            .select(`
                id,
                vessel:vessels(name),
                activity:activity_type,
                geofence:geofences(name),
                startTime:start_time,
                status,
                activity_messages ( id, message_text, created_at, sender_role, is_read )
            `)
            .order('start_time', { ascending: false })
            .limit(30);
        if (error) throw error;
        return data || [];
    }
};

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Hook to manage the messaging thread for a specific activity.
 */
export function useMessaging(activityId, userId) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchMessages = useCallback(async () => {
        if (!activityId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('activity_messages')
                .select('*, sender:user_profiles(display_name)')
                .eq('vessel_activity_id', activityId)
                .order('created_at', { ascending: true });
            if (error) throw error;
            setMessages(data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [activityId]);

    useEffect(() => {
        fetchMessages();

        // Real-time subscription
        const channel = supabase
            .channel(`activity-messages-${activityId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'activity_messages', filter: `vessel_activity_id=eq.${activityId}` },
                () => {
                    fetchMessages();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activityId, fetchMessages]);

    const sendMessage = async (text, role = 'crew', includeInLogbook = false) => {
        if (!activityId || !userId) return { success: false, error: 'Context missing' };
        try {
            const { error } = await supabase
                .from('activity_messages')
                .insert({
                    vessel_activity_id: activityId,
                    sender_id: userId,
                    sender_role: role,
                    message_text: text,
                    included_in_logbook: includeInLogbook,
                    visibility: includeInLogbook ? 'exported' : 'internal'
                });
            if (error) throw error;
            // Subscription will update messages
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    const toggleInLogbook = async (messageId, included) => {
        try {
            const { error } = await supabase
                .from('activity_messages')
                .update({
                    included_in_logbook: included,
                    visibility: included ? 'exported' : 'internal'
                })
                .eq('id', messageId);
            if (error) throw error;
            fetchMessages();
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    return {
        messages,
        loading,
        error,
        sendMessage,
        toggleInLogbook,
        refresh: fetchMessages
    };
}

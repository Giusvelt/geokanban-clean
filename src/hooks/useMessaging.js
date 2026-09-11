import { useState, useCallback, useEffect } from 'react';
import { messagesService } from '../services/api/messagesService';

export function useMessaging(activityId, userId) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchMessages = useCallback(async () => {
        if (!activityId) return;
        setLoading(true);
        try {
            const { data, error } = await messagesService.fetchMessagesForHook(activityId);
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
        const channel = messagesService.subscribeToActivity(activityId, () => { fetchMessages(); });
        return () => { messagesService.unsubscribe(channel); };
    }, [activityId, fetchMessages]);

    const sendMessage = async (text, role = 'crew', includeInLogbook = false) => {
        if (!activityId || !userId) return { success: false, error: 'Context missing' };
        try {
            await messagesService.sendMessage({ activityId, senderId: userId, senderRole: role, messageText: text });
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    const toggleInLogbook = async (messageId, included) => {
        try {
            const { error } = await messagesService.toggleInLogbook(messageId, included);
            if (error) throw error;
            fetchMessages();
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    return { messages, loading, error, sendMessage, toggleInLogbook, refresh: fetchMessages };
}

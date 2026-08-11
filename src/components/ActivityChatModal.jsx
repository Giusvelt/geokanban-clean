import React, { useState, useEffect, useRef } from 'react';
import { messagesService } from '../services/api/messagesService';
import { X, Send, MessageSquare } from 'lucide-react';
import '../logbook-writer.css';

export default function ActivityChatModal({ activity, profile, onClose, readOnly = false }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);

    const fetchMessages = async () => {
        if (!activity?.id) return;
        setLoading(true);
        try {
            const data = await messagesService.fetchMessagesForActivity(activity.id);
            setMessages(data);

            if (profile?.role && !readOnly) {
                messagesService.markAsRead(activity.id, profile.role);
            }
        } catch (error) {
            console.error('❌ Errore durante il caricamento dei messaggi:', error.message || error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!activity?.id) return;

        fetchMessages();

        // Subscribe to new messages for this activity
        const channel = messagesService.subscribeToActivity(activity.id, () => {
            fetchMessages(); // Reload to get sender info
        });

        return () => {
            messagesService.unsubscribe(channel);
        };
    }, [activity?.id]);

    useEffect(() => {
        if (!readOnly) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, readOnly]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !profile || readOnly) return;

        try {
            await messagesService.sendMessage({
                activityId: activity.id,
                senderId: profile.id,
                senderRole: profile.role || 'crew',
                messageText: newMessage.trim(),
            });
            setNewMessage('');
            fetchMessages(); // Aggiorna istantaneamente la lista
        } catch (err) {
            console.error('Error sending message:', err);
        }
    };

    return (
        <div className="lem-overlay" onClick={onClose}>
            <div className={`chat-modal ${readOnly ? 'readonly-mode' : ''}`} onClick={e => e.stopPropagation()}>
                <div className="chat-header">
                    <div className="lem-title-row">
                        <MessageSquare size={18} />
                        <h2>{readOnly ? 'Activity History & Notes' : `Chat: ${activity?.activity}`}</h2>
                        <span className="lem-badge" style={{ background: '#3b82f6' }}>{activity?.vessel}</span>
                    </div>
                    <button className="lem-close" onClick={onClose}><X size={18} /></button>
                </div>

                <div className="chat-body">
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 20 }}>Loading notes...</div>
                    ) : messages.length === 0 ? (
                        <div className="chat-empty">No notes or messages for this activity.</div>
                    ) : (
                        <div className={readOnly ? 'notes-container' : 'bubbles-container'}>
                            {messages.map(m => {
                                const isMine = m.sender_id === profile?.id;
                                const d = new Date(m.created_at);
                                const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                
                                if (readOnly) {
                                    return (
                                        <div key={m.id} className="note-item">
                                            <span className="note-timestamp">[{timeStr}]</span>
                                            <span className="note-sender">{m.user_profiles?.display_name || 'System'}:</span>
                                            <span className="note-text">{m.message_text}</span>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={m.id} className={`chat-bubble ${isMine ? 'mine' : 'theirs'}`}>
                                        <div className="chat-meta">
                                            <span className="chat-sender">{m.user_profiles?.display_name || 'Admin'}</span>
                                            <span className="chat-time">{timeStr}</span>
                                        </div>
                                        <div className="chat-text">{m.message_text}</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {!readOnly && (
                    <form className="chat-footer" onSubmit={handleSend}>
                        <input
                            className="chat-input"
                            placeholder="Type a message..."
                            value={newMessage}
                            onChange={e => setNewMessage(e.target.value)}
                            autoFocus
                        />
                        <button type="submit" className="chat-send" disabled={!newMessage.trim()}>
                            <Send size={16} />
                        </button>
                    </form>
                )}
                {readOnly && (
                    <div className="chat-footer-readonly">
                        <span>Communication closed for this flow. Read-only access.</span>
                    </div>
                )}
            </div>
        </div>
    );
}

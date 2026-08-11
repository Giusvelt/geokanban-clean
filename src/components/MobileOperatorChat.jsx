import React, { useState, useEffect, useRef } from 'react';
import { messagesService } from '../services/api/messagesService';
import { 
  X, Send, MessageSquare, Ship, User, 
  CheckCheck, Clock, Search, Filter 
} from 'lucide-react';

export default function MobileOperatorChat({ profile }) {
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  // Fetch unique activities that have messages (our "Conversations")
  useEffect(() => {
    fetchConversations();
    
    // Global subscription for new messages
    const channel = messagesService.subscribeGlobal(() => {
      fetchConversations();
      if (activeChat) fetchMessages(activeChat.id);
    });

    return () => messagesService.unsubscribe(channel);
  }, [activeChat]);

  useEffect(() => {
    if (activeChat) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const acts = await messagesService.fetchConversations();
      // Map the nested join data to flat properties for the UI
      const mapped = acts.map(a => ({
        ...a,
        vessel: a.vessel?.name || 'Unknown',
        geofence: a.geofence?.name || 'Navigation',
      }));

      // Filter activities that have messages or are very recent/active
      const chatList = mapped.filter(a => a.activity_messages.length > 0 || a.status === 'in-progress');
      setConversations(chatList);
    } catch (error) {
      console.error('Chat fetch error:', error.message || error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (activityId) => {
    try {
      const data = await messagesService.fetchMessagesForActivity(activityId);
      setMessages(data || []);
      
      // Mark as read
      await messagesService.markAsRead(activityId, profile.role);
    } catch (error) {
      console.error('Error fetching messages:', error.message || error);
    }
  };

  const handleOpenChat = (activity) => {
    setActiveChat(activity);
    fetchMessages(activity.id);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    try {
      await messagesService.sendMessage({
        activityId: activeChat.id,
        senderId: profile.id,
        senderRole: profile.role,
        messageText: newMessage.trim()
      });
      setNewMessage('');
      fetchMessages(activeChat.id);
    } catch (error) {
      console.error('Error sending message:', error.message || error);
    }
  };

  if (activeChat) {
    return (
      <div className="fixed inset-0 z-[60] bg-surface flex flex-col font-inter animate-in slide-in-from-right duration-300">
        {/* Chat Header */}
        <header className="h-16 bg-surface-lowest border-b border-surface-low px-4 flex items-center gap-3 shadow-sm">
           <button onClick={() => setActiveChat(null)} className="p-1 -ml-2 text-primary">
              <X size={24} />
           </button>
           <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Ship size={20} />
           </div>
           <div className="flex-1 overflow-hidden">
              <h3 className="font-manrope font-extrabold text-sm text-on-surface truncate">
                {activeChat.vessel} • {activeChat.activity}
              </h3>
              <p className="text-[10px] font-bold text-on-surface/40 uppercase tracking-widest truncate">
                {activeChat.geofence}
              </p>
           </div>
        </header>

        {/* Message Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#e5ddd5]/30">
          {messages.map((m) => {
             const isMe = m.sender_id === profile.id;
             return (
               <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`
                    max-w-[85%] px-3 py-2 rounded-2xl shadow-sm relative text-[14px]
                    ${isMe ? 'bg-[#dcf8c6] text-slate-800 rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none'}
                  `}>
                    {!isMe && (
                      <p className="text-[10px] font-black text-primary/70 uppercase mb-0.5">
                        {m.user_profiles?.display_name || m.sender_role}
                      </p>
                    )}
                    <p className="leading-relaxed">{m.message_text}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[9px] font-bold text-slate-400">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isMe && <CheckCheck size={10} className="text-primary" />}
                    </div>
                  </div>
               </div>
             );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="p-3 bg-surface-low/50 flex gap-2 items-center">
            <input 
              type="text" 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-white border-none py-2.5 px-4 rounded-full text-sm shadow-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button 
              type="submit"
              className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
            >
              <Send size={18} />
            </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search/Filter Bar */}
      <div className="flex gap-2">
         <div className="flex-1 bg-surface-low border border-surface-low/50 rounded-full h-10 flex items-center px-4 gap-2 text-on-surface/40">
            <Search size={16} />
            <span className="text-sm font-semibold">Cerca conversazione...</span>
         </div>
      </div>

      {/* Chat List */}
      <div className="space-y-px rounded-xl overflow-hidden border border-surface-low/50 shadow-sm">
        {conversations.map((chat) => {
          const lastMsg = chat.activity_messages[chat.activity_messages.length - 1];
          const unreadCount = chat.activity_messages.filter(m => !m.is_read && m.sender_role !== profile.role).length;
          
          return (
            <button 
              key={chat.id}
              onClick={() => handleOpenChat(chat)}
              className="w-full bg-surface-lowest flex items-center gap-4 p-4 active:bg-surface-low transition-colors border-b border-surface-low/30 last:border-none"
            >
               <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center text-primary shrink-0 relative">
                  <Ship size={24} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-surface-lowest">
                       {unreadCount}
                    </span>
                  )}
               </div>
               
               <div className="flex-1 text-left overflow-hidden">
                  <div className="flex justify-between items-baseline mb-0.5">
                     <h4 className="font-manrope font-extrabold text-[15px] text-on-surface truncate">
                        {chat.vessel}
                     </h4>
                     <span className="text-[10px] font-bold text-on-surface/30">
                        {lastMsg ? formatChatTimestamp(lastMsg.created_at) : ''}
                     </span>
                  </div>
                  <p className="text-[11px] font-black text-primary/60 uppercase tracking-widest mb-1 truncate">
                    {chat.activity} @ {chat.geofence}
                  </p>
                  <p className="text-sm text-on-surface/60 truncate font-inter">
                     {lastMsg ? lastMsg.message_text : 'Nessun messaggio ancora'}
                  </p>
               </div>
            </button>
          );
        })}
      </div>
      
      {loading && conversations.length === 0 && (
        <div className="py-10 text-center text-on-surface/20">
          <Clock className="mx-auto mb-2 animate-pulse" size={32} />
          <p className="text-xs font-black uppercase tracking-widest">Sincronizzazione conversazioni...</p>
        </div>
      )}
    </div>
  );
}

/**
 * formatChatTimestamp — Logica specifica chat: mostra HH:MM se il messaggio
 * è di oggi, altrimenti mostra GG/MM. Diversa da formatTimeShort (solo ora).
 * Rimane locale perché questa logica è esclusiva del componente chat.
 */
function formatChatTimestamp(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
}

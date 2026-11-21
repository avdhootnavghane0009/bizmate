import React, { useEffect, useState, useRef } from 'react';
import { useBusiness } from '../../context/BusinessContext';
import { api } from '../../api/client';
import { 
  Lock, Unlock, MessageSquare, Send, MessageSquareDashed, 
  Check, CheckCheck, Sparkles, Phone, User, RefreshCw, SendHorizontal 
} from 'lucide-react';

export const WhatsAppInboxPage: React.FC = () => {
  const { business } = useBusiness();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState('');
  const [isLockedByHuman, setIsLockedByHuman] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // 1. Fetch Conversations
  const fetchConversations = (silent = false) => {
    if (!business.id) return;
    if (!silent) setLoading(true);

    api.get<any[]>('/inbox/conversations')
      .then((res) => {
        if (Array.isArray(res)) {
          setConversations(res);
          if (res.length > 0 && !activeChat) {
            setActiveChat(res[0]);
            setIsLockedByHuman(Boolean(res[0].isLocked));
          } else if (res.length === 0) {
            setActiveChat(null);
          }
        } else {
          setConversations([]);
          setActiveChat(null);
        }
      })
      .catch((err) => {
        console.warn('Inbox conversations fetch error:', err);
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  // 2. Fetch Messages for Active Chat
  const fetchMessages = (chatId?: string) => {
    const targetId = chatId || activeChat?.id;
    if (!targetId) return;

    api.get<any[]>(`/inbox/conversations/${targetId}/messages`)
      .then((res) => {
        if (Array.isArray(res)) {
          setMessages(res);
        }
      })
      .catch((err) => {
        console.warn('Messages fetch error:', err);
      });
  };

  // Auto-scroll messages stream to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  // Initial load & 4-second real-time polling loop
  useEffect(() => {
    fetchConversations();
    const interval = setInterval(() => {
      fetchConversations(true);
      if (activeChat?.id) {
        fetchMessages(activeChat.id);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [business.id, activeChat?.id]);

  // When activeChat changes, load its messages immediately
  useEffect(() => {
    if (activeChat) {
      setIsLockedByHuman(Boolean(activeChat.isLocked));
      fetchMessages(activeChat.id);
    } else {
      setMessages([]);
    }
  }, [activeChat?.id]);

  const handleSend = async () => {
    if (!replyText.trim() || !activeChat) return;
    setSending(true);
    const textToSend = replyText;
    setReplyText('');

    // Optimistic UI update
    const tempMsg = {
      id: `temp-${Date.now()}`,
      sender: isLockedByHuman ? 'human' : 'ai',
      content: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      delivery_status: 'sent',
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await api.post<any>('/inbox/send', {
        conversation_id: activeChat.id,
        content: textToSend,
      });

      if (res && res.id) {
        fetchMessages(activeChat.id);
      }
      fetchConversations(true);
    } catch (e) {
      console.warn('Failed sending message through backend:', e);
    } finally {
      setSending(false);
    }
  };

  const handleToggleLock = async () => {
    if (!activeChat) return;
    const nextState = !isLockedByHuman;
    setIsLockedByHuman(nextState);
    try {
      await api.post(`/inbox/conversations/${activeChat.id}/lock`, {
        is_locked: nextState,
      });
      activeChat.isLocked = nextState;
      fetchConversations(true);
    } catch (e) {
      console.warn('Lock toggle error:', e);
    }
  };

  const renderDeliveryStatus = (status?: string) => {
    if (status === 'read') {
      return (
        <span title="Read by customer">
          <CheckCheck className="w-3.5 h-3.5 text-blue-500 inline" />
        </span>
      );
    }
    if (status === 'delivered') {
      return (
        <span title="Delivered to WhatsApp">
          <CheckCheck className="w-3.5 h-3.5 text-[#EDE8DE]/70 inline" />
        </span>
      );
    }
    return (
      <span title="Sent via Meta Cloud API">
        <Check className="w-3 h-3 text-[#EDE8DE]/60 inline" />
      </span>
    );
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex rounded-2xl border border-[#D8CDBC] dark:border-[#2C2C26] bg-[#FFFFFF] dark:bg-[#20211D] overflow-hidden">
      {/* 1. Left: Conversation List */}
      <div className="w-80 border-r border-[#D8CDBC] dark:border-[#2C2C26] flex flex-col bg-[#EDE8DE]/40 dark:bg-[#181915]">
        <div className="p-3 border-b border-[#D8CDBC] dark:border-[#2C2C26] flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-[#A0815A]">Live WhatsApp Inbox</h3>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Real-Time Polling Active"></span>
          </div>
          <button 
            onClick={() => fetchConversations()} 
            className="p-1 hover:bg-[#D8CDBC] dark:hover:bg-[#2C2C26] rounded text-[#57554F] dark:text-[#9E998E]"
            title="Refresh conversations"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#D8CDBC] dark:divide-[#2C2C26]">
          {loading ? (
            <div className="p-6 text-center text-xs text-[#57554F] dark:text-[#9E998E]">Loading conversations...</div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center space-y-2">
              <MessageSquareDashed className="w-8 h-8 mx-auto text-[#A0815A]/60" />
              <p className="text-xs font-semibold text-[#181915] dark:text-[#EDE8DE]">No Conversations Yet</p>
              <p className="text-[11px] text-[#57554F] dark:text-[#9E998E]">
                Incoming messages from your WhatsApp test number will arrive here automatically.
              </p>
            </div>
          ) : (
            conversations.map((c) => {
              const isSelected = activeChat?.id === c.id;
              return (
                <div 
                  key={c.id} 
                  onClick={() => setActiveChat(c)}
                  className={`p-3.5 cursor-pointer transition ${
                    isSelected 
                      ? 'bg-[#A0815A]/10 border-l-4 border-[#A0815A]' 
                      : 'bg-[#FFFFFF] dark:bg-[#20211D] hover:bg-[#EDE8DE]/30'
                  }`}
                >
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="truncate">{c.name}</span>
                    <span className="text-[10px] text-[#57554F] dark:text-[#9E998E] shrink-0">{c.time}</span>
                  </div>
                  <p className="text-[11px] text-[#57554F] dark:text-[#9E998E] truncate mt-1">{c.lastMessage}</p>
                  
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {c.intent && c.intent !== 'Enquiry' && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#A0815A]/20 text-[#A0815A]">
                        {c.intent}
                      </span>
                    )}
                    {c.isLocked && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-500">
                        Human Takeover
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Right: Active Workspace & Chat Thread */}
      <div className="flex-1 flex flex-col justify-between bg-[#FFFFFF] dark:bg-[#20211D]">
        {activeChat ? (
          <>
            {/* Header */}
            <div className="h-14 border-b border-[#D8CDBC] dark:border-[#2C2C26] px-5 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[#181915] dark:text-[#EDE8DE] flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-[#A0815A]" />
                  <span>{activeChat.name}</span>
                  <span className="text-[11px] font-mono font-normal text-[#57554F] dark:text-[#9E998E]">({activeChat.phone})</span>
                </h3>
                <span className="text-[10px] text-emerald-500 font-mono">Synced with Meta WhatsApp Cloud API</span>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleToggleLock}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                    isLockedByHuman ? 'bg-amber-600 text-white' : 'bg-[#EDE8DE] dark:bg-[#181915] border border-[#D8CDBC] dark:border-[#2C2C26] text-[#A0815A]'
                  }`}
                >
                  {isLockedByHuman ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  <span>{isLockedByHuman ? 'Human Takeover Active' : 'Take Over from AI'}</span>
                </button>
              </div>
            </div>

            {/* Message Chronological Stream */}
            <div className="flex-1 p-5 overflow-y-auto space-y-3 text-xs">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-[#57554F] dark:text-[#9E998E]">
                  No message history yet for this conversation.
                </div>
              ) : (
                messages.map((m, idx) => {
                  const isCustomer = m.sender === 'customer';
                  return (
                    <div 
                      key={m.id || idx} 
                      className={`p-3 rounded-2xl max-w-md ${
                        isCustomer 
                          ? 'bg-[#EDE8DE] dark:bg-[#181915] text-[#181915] dark:text-[#EDE8DE]' 
                          : 'bg-[#A0815A]/20 border border-[#A0815A]/40 text-[#181915] dark:text-[#EDE8DE] ml-auto'
                      }`}
                    >
                      <div className="flex justify-between items-center text-[10px] opacity-70 mb-1 font-mono gap-3">
                        <span>
                          {isCustomer ? `${activeChat?.name || 'Customer'}` : (m.sender === 'human' ? 'Store Manager' : 'Gemini AI')}
                        </span>
                        <div className="flex items-center gap-1">
                          <span>{m.time || 'Now'}</span>
                          {!isCustomer && renderDeliveryStatus(m.delivery_status)}
                        </div>
                      </div>

                      <p className="whitespace-pre-wrap">{m.content}</p>

                      {/* Multilingual Translation */}
                      {m.translated && m.translated !== m.content && (
                        <div className="text-[10px] opacity-80 mt-1 italic font-sans border-t border-[#A0815A]/20 pt-1">
                          [English Translation]: {m.translated}
                        </div>
                      )}

                      {/* AI Intent Tag */}
                      {m.intent && isCustomer && (
                        <div className="mt-1 pt-1 flex items-center gap-1 text-[9px] font-mono text-[#A0815A]">
                          <Sparkles className="w-2.5 h-2.5" /> Intent: {m.intent}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Outbound Message Composer */}
            <div className="p-3 border-t border-[#D8CDBC] dark:border-[#2C2C26] flex gap-2">
              <input 
                type="text" 
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={isLockedByHuman ? 'Reply to customer via WhatsApp...' : 'Type WhatsApp reply (sent as Store Manager)...'}
                className="flex-1 bg-[#EDE8DE] dark:bg-[#181915] border border-[#D8CDBC] dark:border-[#2C2C26] rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-[#A0815A]"
              />
              <button 
                onClick={handleSend} 
                disabled={sending}
                className="px-5 py-2 bg-[#A0815A] hover:bg-[#8C6F4B] text-white rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {sending ? 'Sending...' : <><SendHorizontal className="w-3.5 h-3.5" /> Send</>}
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-2">
            <MessageSquare className="w-10 h-10 text-[#A0815A]/50" />
            <h3 className="font-bold text-sm text-[#181915] dark:text-[#EDE8DE]">No Active Conversation Selected</h3>
            <p className="text-xs text-[#57554F] dark:text-[#9E998E] max-w-sm">
              Select a conversation from the left to view customer messages, monitor Gemini AI replies, or initiate a human takeover.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

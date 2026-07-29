import React, { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { Send, Smile } from 'lucide-react';
import { format } from 'date-fns';

const EMOJIS = [
  { char: '😀', label: 'smiley' }, { char: '😂', label: 'joy' }, { char: '🥰', label: 'love' },
  { char: '😍', label: 'heart_eyes' }, { char: '😘', label: 'kiss' }, { char: '😋', label: 'yum' },
  { char: '😎', label: 'cool' }, { char: '😊', label: 'blush' }, { char: '😢', label: 'cry' },
  { char: '😡', label: 'angry' }, { char: '😱', label: 'scream' }, { char: '🤔', label: 'thinking' },
  { char: '👍', label: 'thumbsup' }, { char: '👎', label: 'thumbsdown' }, { char: '👏', label: 'applause' },
  { char: '🙌', label: 'hooray' }, { char: '🙏', label: 'pray' }, { char: '💪', label: 'strong' },
  { char: '🔥', label: 'fire' }, { char: '✨', label: 'sparkles' }, { char: '🎉', label: 'party' },
  { char: '❤️', label: 'heart' }, { char: '💖', label: 'sparkling_heart' }, { char: '🥺', label: 'pleading' },
  { char: '🐶', label: 'dog' }, { char: '🐱', label: 'cat' }, { char: '🦖', label: 'dino' },
  { char: '🍕', label: 'pizza' }, { char: '🍦', label: 'icecream' }, { char: '☕', label: 'coffee' }
];



const isGifUrl = (text: string): boolean => {
  return typeof text === 'string' && (
    text.startsWith('http') && (
      text.includes('giphy.com/media') || 
      text.includes('media.giphy.com') ||
      text.includes('giphy.gif') ||
      text.endsWith('.gif')
    )
  );
};

export const ChatView: React.FC = () => {
  const { messages, sendMessage, loading } = useChatStore();
  const { user, partner, updateProfile } = useAuthStore();
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleSelectEmoji = (char: string) => {
    setInputText(prev => prev + char);
    setShowEmojiPicker(false);
  };


  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, setTick] = useState(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, partner?.isTyping]);

  // Keep presence/status info ticking for real-time elapsed calculations
  useEffect(() => {
    const statusInterval = setInterval(() => {
      setTick(t => t + 1);
    }, 30000);
    return () => clearInterval(statusInterval);
  }, []);

  // Cleanup typing status when leaving the chat tab
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      const currentAuth = useAuthStore.getState();
      if (currentAuth.user?.isTyping && currentAuth.updateProfile) {
        currentAuth.updateProfile({ isTyping: false }).catch(console.error);
      }
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    if (!user || !updateProfile) return;

    // Set typing state to true if not already typing
    if (!user.isTyping) {
      updateProfile({ isTyping: true }).catch(console.error);
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to clear typing after 2.5s of keyboard inactivity
    typingTimeoutRef.current = setTimeout(() => {
      updateProfile({ isTyping: false }).catch(console.error);
    }, 2500);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    // Clear typing indicator state immediately on send
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (user?.isTyping && updateProfile) {
      updateProfile({ isTyping: false }).catch(console.error);
    }

    await sendMessage(inputText);
    setInputText('');
  };

  const getPartnerStatus = () => {
    if (!partner || !partner.lastActive) {
      return { isOnline: false, text: 'Offline' };
    }
    const lastActiveDate = new Date(partner.lastActive);
    const diffMs = new Date().getTime() - lastActiveDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 2) {
      return { isOnline: true, text: 'Online' };
    } else if (diffMins < 60) {
      return { isOnline: false, text: `Active ${diffMins}m ago` };
    } else {
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) {
        return { isOnline: false, text: `Active ${diffHours}h ago` };
      } else {
        return { isOnline: false, text: `Active ${format(lastActiveDate, 'MMM d')}` };
      }
    }
  };

  const status = getPartnerStatus();

  // Helper to format dates separating messages
  const renderDateSeparator = (dateStr: string) => {
    return (
      <div className="flex justify-center my-4" key={`sep-${dateStr}`}>
        <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-100 dark:bg-brand-900 px-3 py-1 rounded-full shadow-sm">
          {format(new Date(dateStr), 'MMMM d, yyyy')}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-100px)] max-w-4xl mx-auto backdrop-blur-md bg-white/70 dark:bg-brand-900/60 border border-slate-200/50 dark:border-brand-800/40 rounded-[32px] overflow-hidden shadow-2xl transition-all duration-300">
      
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100/50 dark:border-brand-800/30 flex items-center justify-between bg-slate-50/40 dark:bg-brand-950/20 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer">
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-lg font-black shadow-lg shadow-black/10 transition-transform duration-300 group-hover:scale-105" style={{ backgroundColor: partner?.avatarColor || '#64748b' }}>
              {partner?.avatarEmoji || '👤'}
            </div>
            {status.isOnline && (
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-brand-900 rounded-full shadow-md animate-pulse" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Chat with {partner?.name || 'Partner'}</h3>
            <span className={`text-[10px] font-black uppercase tracking-widest ${status.isOnline ? 'text-emerald-500 animate-pulse' : 'text-slate-400 dark:text-slate-500'}`}>
              {status.text}
            </span>
          </div>
        </div>
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5 no-scrollbar bg-gradient-to-tr from-slate-50/50 via-indigo-50/10 to-purple-50/20 dark:from-brand-950 dark:via-indigo-950/10 dark:to-purple-950/15 relative">
        {loading ? (
          <div className="h-full flex items-center justify-center text-[10px] text-slate-400 dark:text-slate-500 font-black animate-pulse uppercase tracking-widest">
            Loading chat messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 animate-in fade-in duration-500">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-brand-950 flex items-center justify-center text-2xl shadow-inner mb-3">💬</div>
            <h4 className="text-sm font-black mb-1.5 text-slate-800 dark:text-slate-200">Start the conversation</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed font-medium">Send a sweet message, update your partner, or coordinate your day.</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderId === user?.uid;
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const isNewDay = !prevMsg || new Date(msg.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString();
            
            return (
              <React.Fragment key={msg.id || index}>
                {isNewDay && renderDateSeparator(msg.timestamp)}
                <div className={`flex items-end gap-2.5 ${isMe ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 fade-in duration-300 ease-out`}>
                  {/* Left Avatar for partner */}
                  {!isMe && (
                    <div 
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md shrink-0 mb-1 select-none" 
                      style={{ backgroundColor: msg.avatarColor }}
                    >
                      {msg.avatarEmoji}
                    </div>
                  )}

                  {/* Message Bubble Container */}
                  <div className={`flex flex-col max-w-[72%] ${isMe ? 'items-end' : 'items-start'} group`}>
                    <div 
                      className={`px-4 py-2.5 rounded-2xl text-[12px] font-medium leading-relaxed break-words w-full shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer ${
                        isMe 
                          ? 'bg-gradient-to-r from-blue-600 to-sky-600 dark:from-blue-600/90 dark:to-sky-600/90 text-white rounded-tr-none shadow-blue-500/10' 
                          : 'bg-gradient-to-r from-emerald-600 to-teal-650 dark:from-emerald-600/90 dark:to-teal-650/90 text-white rounded-tl-none shadow-emerald-500/10'
                      }`}
                    >
                      {isGifUrl(msg.text) ? (
                        <img 
                          src={msg.text} 
                          alt="gif" 
                          className="max-w-[200px] sm:max-w-xs rounded-xl shadow-inner border border-slate-200/15" 
                          loading="lazy"
                        />
                      ) : (
                        msg.text
                      )}
                    </div>
                    {/* Timestamp & Read Receipts */}
                    <div className="flex items-center gap-1 mt-1 px-1 transition-opacity duration-200 opacity-60 group-hover:opacity-100">
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">
                        {format(new Date(msg.timestamp), 'h:mm a')}
                      </span>
                      {isMe && (
                        <span className="text-[10px] select-none leading-none" title={partner && partner.lastReadChat && partner.lastReadChat >= msg.timestamp ? "Read" : "Sent"}>
                          {partner && partner.lastReadChat && partner.lastReadChat >= msg.timestamp ? (
                            <span className="text-indigo-500 dark:text-indigo-400 font-bold">✓✓</span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">✓</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Avatar for current user */}
                  {isMe && (
                    <div 
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md shrink-0 mb-1 select-none" 
                      style={{ backgroundColor: msg.avatarColor }}
                    >
                      {msg.avatarEmoji}
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })
        )}

        {/* Typing indicator bubble */}
        {partner?.isTyping && (
          <div className="flex items-end gap-2.5 justify-start animate-in slide-in-from-bottom-2 fade-in duration-200">
            <div 
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md shrink-0 mb-1" 
              style={{ backgroundColor: partner.avatarColor }}
            >
              {partner.avatarEmoji}
            </div>
            <div className="flex flex-col max-w-[70%] items-start">
              <div className="px-4 py-3 bg-white/90 dark:bg-brand-950/80 border border-slate-250/20 dark:border-brand-800/30 rounded-2xl rounded-tl-none flex items-center gap-1 shadow-sm">
                <span className="w-1.5 h-1.5 bg-slate-450 dark:bg-slate-450 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-450 dark:bg-slate-450 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-450 dark:bg-slate-450 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="p-4 border-t border-slate-100/50 dark:border-brand-800/20 bg-slate-50/20 dark:bg-brand-950/10 shrink-0 relative">
        {/* Emoji Picker Popover */}
        {showEmojiPicker && (
          <div className="absolute bottom-20 left-6 z-50 bg-white/95 dark:bg-brand-900/95 border border-slate-200/50 dark:border-brand-800/40 backdrop-blur-md rounded-2xl shadow-2xl p-4 w-72 max-h-60 overflow-y-auto no-scrollbar animate-in slide-in-from-bottom-2 duration-200">
            <div className="grid grid-cols-6 gap-2">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji.char}
                  type="button"
                  onClick={() => handleSelectEmoji(emoji.char)}
                  className="w-8 h-8 flex items-center justify-center text-lg hover:bg-slate-100 dark:hover:bg-brand-800 rounded-xl active:scale-90 transition-all select-none cursor-pointer"
                  title={emoji.label}
                >
                  {emoji.char}
                </button>
              ))}
            </div>
          </div>
        )}



        <form onSubmit={handleSend} className="max-w-3xl mx-auto flex gap-2 items-center p-1.5 bg-white/95 dark:bg-brand-950/60 border border-slate-200/50 dark:border-brand-850/50 backdrop-blur-md rounded-2xl shadow-lg shadow-indigo-500/5 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500/40 transition-all duration-200">
          <button
            type="button"
            onClick={() => {
              setShowEmojiPicker(!showEmojiPicker);
            }}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0 ${showEmojiPicker ? 'bg-slate-100 dark:bg-brand-800 text-indigo-650 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
          >
            <Smile size={18} />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            placeholder={`Write a message for ${partner?.name || 'your partner'}...`}
            className="flex-1 px-2 py-2 bg-transparent border-none text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-0 text-xs font-semibold leading-relaxed"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="w-10 h-10 bg-gradient-to-r from-blue-600 to-sky-600 hover:shadow-lg hover:shadow-blue-500/20 active:scale-95 disabled:opacity-30 disabled:scale-100 disabled:shadow-none text-white rounded-xl shadow-md transition-all duration-200 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <Send size={15} />
          </button>
        </form>
      </div>

    </div>
  );
};

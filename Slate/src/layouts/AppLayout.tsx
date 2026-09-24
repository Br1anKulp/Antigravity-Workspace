import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useCalendarStore } from '../store/calendarStore';
import { useTasksStore } from '../store/tasksStore';
import { useChatStore } from '../store/chatStore';

import { 
  Calendar, 
  CheckSquare, 
  FileText, 
  Columns, 
  MessageSquare,
  Settings as SettingsIcon, 
  Bell, 
  Moon, 
  Sun, 
  LogOut, 
  Wifi, 
  WifiOff,
  ShoppingCart,
  X,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Menu,
  Plus,
  ChevronDown,
  Search,
  MoreHorizontal
} from 'lucide-react';
import { setMonth, setYear } from 'date-fns';
import { isMockMode } from '../firebase/config';
import { useListsStore } from '../store/listsStore';
import { CAL_PALETTE } from '../utils/constants';
import { CommandPalette } from '../components/CommandPalette';
import { FloatingActionButton } from '../components/FloatingActionButton';
import { hapticLight, hapticMedium } from '../utils/haptics';



const formatRelativeTime = (timestamp: string): string => {
  try {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

interface AppLayoutProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ currentTab, setCurrentTab, children }) => {
  const { user, signOut, theme, toggleTheme, updateProfile } = useAuthStore();
  const { notifications, unreadCount, markAsRead, markAllAsRead, requestPermission, deleteNotification } = useNotificationStore();
  const { 
    googleCals, 
    toggleCalendarVisibility, 
    updateCalendarColor, 
    activeView, 
    setActiveView,
    selectedDate,
    setSelectedDate,
    setShowCreateEventModal
  } = useCalendarStore();
  const { tasks } = useTasksStore();
  const { messages } = useChatStore();
  const { items: listItems } = useListsStore();

  const [showBellMenu, setShowBellMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showMobileMoreSheet, setShowMobileMoreSheet] = useState(false);
  const [moreDragY, setMoreDragY] = useState(0);
  const [isDraggingMore, setIsDraggingMore] = useState(false);
  const moreTouchStartY = useRef(0);
  const currentMoreDragY = useRef(0);

  const handleMoreTouchStart = (e: React.TouchEvent) => {
    moreTouchStartY.current = e.touches[0].clientY;
    currentMoreDragY.current = 0;
    setIsDraggingMore(true);
  };

  const handleMoreTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingMore && moreTouchStartY.current === 0) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - moreTouchStartY.current;
    if (delta > 0) {
      if (e.cancelable) e.preventDefault();
      currentMoreDragY.current = delta;
      setMoreDragY(delta);
    } else {
      currentMoreDragY.current = 0;
      setMoreDragY(0);
    }
  };

  const handleMoreTouchEnd = () => {
    setIsDraggingMore(false);
    if (currentMoreDragY.current > 60) {
      hapticLight();
      setShowMobileMoreSheet(false);
    }
    setMoreDragY(0);
    currentMoreDragY.current = 0;
    moreTouchStartY.current = 0;
  };

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastReadChat, setLastReadChat] = useState<string>(localStorage.getItem('slate_last_read_chat') || new Date(0).toISOString());

  // Global keyboard shortcut for Command Palette (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync Android / mobile browser theme-color meta tags
  useEffect(() => {
    const metaLight = document.getElementById('theme-color-light');
    const metaDark = document.getElementById('theme-color-dark');
    if (metaLight && metaDark) {
      if (theme === 'dark') {
        metaDark.setAttribute('content', '#0a0d14');
      } else {
        metaLight.setAttribute('content', '#ffffff');
      }
    }
  }, [theme]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (currentTab === 'chat' && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.timestamp !== lastReadChat) {
        localStorage.setItem('slate_last_read_chat', lastMsg.timestamp);
        if (updateProfile) {
          updateProfile({ lastReadChat: lastMsg.timestamp }).catch(console.error);
        }
        setTimeout(() => {
          setLastReadChat(lastMsg.timestamp);
        }, 0);
      }
    }
  }, [currentTab, messages, lastReadChat, updateProfile]);

  const overdueTasksCount = React.useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const localTodayStr = `${year}-${month}-${day}`;
    return tasks.filter(t => !t.completed && t.dueDate && t.dueDate < localTodayStr).length;
  }, [tasks]);

  const unreadChatCount = React.useMemo(() => {
    return currentTab === 'chat' ? 0 : messages.filter(m => m.senderId !== user?.uid && m.timestamp > lastReadChat).length;
  }, [currentTab, messages, user?.uid, lastReadChat]);

  const activeListItemsCount = React.useMemo(() => {
    return listItems.filter(i => !i.completed).length;
  }, [listItems]);

  const navItems = [
    { id: 'calendar', name: 'Calendar', icon: Calendar },
    { id: 'tasks', name: 'Tasks', icon: CheckSquare, badge: overdueTasksCount > 0 ? { count: overdueTasksCount, type: 'danger' } : undefined },
    { id: 'lists', name: 'Lists', icon: ShoppingCart, badge: activeListItemsCount > 0 ? { count: activeListItemsCount, type: 'primary' } : undefined },
    { id: 'notes', name: 'Notes', icon: FileText },
    { id: 'chat', name: 'Chat', icon: MessageSquare, badge: unreadChatCount > 0 ? { count: unreadChatCount, type: 'primary' } : undefined },
    { id: 'settings', name: 'Settings', icon: SettingsIcon },
  ];

  const sidebarNavItems = navItems.filter(item => item.id !== 'settings');

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-brand-950 text-slate-800 dark:text-slate-200">
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-brand-900 border-r border-slate-200 dark:border-brand-800 sticky top-0 h-screen">
        <div className="p-6 border-b border-slate-200 dark:border-brand-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
              S
            </div>
            <span className="font-semibold text-xl tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              Slate
            </span>
          </div>

          <button 
            onClick={toggleTheme} 
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-brand-800 transition-colors"
            title="Toggle Light/Dark Theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>


        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto no-scrollbar">
          {sidebarNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive 
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-black shadow-md font-semibold' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-brand-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} />
                  {item.name}
                </div>
                {item.badge && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    item.badge.type === 'danger'
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'bg-indigo-650 text-white dark:bg-indigo-500'
                  }`}>
                    {item.badge.count}
                  </span>
                )}
              </button>
            );
          })}

        </nav>

        {/* Settings Button - Moved to just above profile card */}
        <div className="px-4 py-2 border-t border-slate-100 dark:border-brand-850">
          <button
            onClick={() => setCurrentTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              currentTab === 'settings'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-black shadow-md font-semibold' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-brand-800'
            }`}
          >
            <SettingsIcon size={18} />
            Settings
          </button>
        </div>

        {/* User Card */}
        <div className="p-4 border-t border-slate-200 dark:border-brand-800">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-brand-950">
            <div className="flex items-center gap-3">
              <div 
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-inner" 
                style={{ backgroundColor: user?.avatarColor || '#64748b' }}
              >
                {user?.avatarEmoji || '👤'}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold leading-tight">{user?.name}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate w-32">{user?.email}</span>
              </div>
            </div>
            <button 
              onClick={() => signOut()} 
              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="relative flex-1 flex flex-col min-w-0 pb-16 md:pb-0 overflow-hidden">
        {/* Ambient lighting radial aura blurs */}
        <div className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 -right-40 w-96 h-96 bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-3xl" />
        
        {/* Top Header */}
        <header className="relative sticky top-0 z-40 shrink-0 min-h-[64px] bg-white/80 dark:bg-brand-900/80 backdrop-blur-md border-b border-slate-200 dark:border-brand-800 px-3 sm:px-6 py-3.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 relative min-w-0 flex-1">
            {/* Universal Hamburger Menu button */}
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-brand-850 text-slate-700 dark:text-slate-200 cursor-pointer transition-colors border border-slate-200/60 dark:border-brand-800/60 shadow-2xs shrink-0"
              title="Calendar & Filter Options"
            >
              {showFilterMenu ? <X size={18} /> : <Menu size={18} />}
            </button>

            {/* Title & Month Selector when on Calendar tab */}
            <div className="flex items-center gap-1.5 min-w-0">
              <h1 className="text-base sm:text-xl font-bold tracking-tight capitalize truncate hidden sm:block">
                {currentTab === 'kanban' ? 'projects' : currentTab}
              </h1>

              {currentTab === 'calendar' && (
                <div className="flex items-center gap-1">
                  {/* Month Select */}
                  <div className="relative flex items-center">
                    <select
                      value={selectedDate.getMonth()}
                      onChange={(e) => {
                        const newMonthIndex = parseInt(e.target.value, 10);
                        setSelectedDate(setMonth(selectedDate, newMonthIndex));
                      }}
                      className="appearance-none bg-indigo-50 dark:bg-indigo-950/60 text-indigo-650 dark:text-indigo-300 font-extrabold text-xs sm:text-sm pl-2 pr-5 py-1.5 rounded-xl border border-indigo-200/80 dark:border-indigo-900/60 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      {[
                        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
                      ].map((mName, idx) => (
                        <option key={idx} value={idx} className="bg-white dark:bg-brand-900 text-slate-800 dark:text-slate-100 font-bold">
                          {mName}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-1.5 text-indigo-500 pointer-events-none" />
                  </div>

                  {/* Year Select */}
                  <div className="relative flex items-center">
                    <select
                      value={selectedDate.getFullYear()}
                      onChange={(e) => {
                        const newYear = parseInt(e.target.value, 10);
                        setSelectedDate(setYear(selectedDate, newYear));
                      }}
                      className="appearance-none bg-slate-100 dark:bg-brand-850 text-slate-700 dark:text-slate-300 font-extrabold text-xs sm:text-sm pl-2 pr-5 py-1.5 rounded-xl border border-slate-200 dark:border-brand-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 1 + i).map((yearNum) => (
                        <option key={yearNum} value={yearNum} className="bg-white dark:bg-brand-900 text-slate-800 dark:text-slate-100 font-bold">
                          {yearNum}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-1.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}
            </div>

            {/* Desktop-only Add Event Button (Mobile uses floating action button) */}
            {currentTab === 'calendar' && (
              <div className="hidden sm:flex items-center shrink-0 ml-auto sm:ml-1">
                <button
                  onClick={() => setShowCreateEventModal(true)}
                  className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-xl text-xs font-extrabold shadow-xs transition-all cursor-pointer shrink-0"
                >
                  <Plus size={14} />
                  <span>Event</span>
                </button>
              </div>
            )}

            {/* Hamburger Dropdown Popover */}
            {showFilterMenu && (
              <div className="absolute top-12 left-0 z-50 w-64 bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-2xl p-4 shadow-xl space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-brand-850">
                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                    Calendar Filters
                  </span>
                  <button 
                    onClick={() => setShowFilterMenu(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
                  >
                    Close
                  </button>
                </div>

                <div className="space-y-3">
                  {/* View Modes Selector */}
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
                      View Mode
                    </span>
                    <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-brand-950 p-1 rounded-xl border border-slate-200/50 dark:border-brand-800/50">
                      {[
                        { label: 'Day', value: 'Day' as const },
                        { label: '1 Week', value: '4-Day' as const },
                        { label: 'Month', value: 'Month' as const }
                      ].map(({ label, value }) => {
                        const isActive = activeView === value;
                        return (
                          <button
                            key={value}
                            onClick={() => {
                              setActiveView(value);
                              setShowFilterMenu(false);
                            }}
                            className={`text-center py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                              isActive
                                ? 'bg-white text-slate-900 dark:bg-brand-850 dark:text-white shadow-xs'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {googleCals.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-brand-850">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Calendars & Visibility
                      </span>
                      {googleCals.map(cal => (
                        <div key={cal.id} className="flex items-center justify-between text-xs font-semibold py-1 px-1 rounded-lg hover:bg-slate-50 dark:hover:bg-brand-850/50">
                          <label className="flex items-center gap-2 cursor-pointer min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={cal.visible}
                              onChange={() => toggleCalendarVisibility(cal.id)}
                              className="rounded border-slate-300 dark:border-brand-800 w-3.5 h-3.5 cursor-pointer shrink-0"
                            />
                            <span className="truncate text-slate-700 dark:text-slate-350">{cal.summary}</span>
                          </label>
                          <button 
                            type="button"
                            onClick={() => {
                              const curIdx = CAL_PALETTE.indexOf(cal.color);
                              const nextColor = CAL_PALETTE[(curIdx + 1) % CAL_PALETTE.length];
                              updateCalendarColor(cal.id, nextColor);
                            }}
                            className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10 dark:border-white/10 cursor-pointer"
                            style={{ backgroundColor: cal.color }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Status Indicators (Hidden on narrow mobile screens to avoid squeezing header) */}
            <div className="hidden md:flex items-center gap-2">
              {!isOnline ? (
                <span className="flex items-center gap-1 text-[10px] bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 px-2 py-0.5 rounded-full font-medium">
                  <WifiOff size={10} /> Offline
                </span>
              ) : null}
              {isMockMode ? (
                <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium" title="Running client-side localStorage sync">
                  Local Mode
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300 px-2 py-0.5 rounded-full font-medium">
                  <Wifi size={10} /> Live
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Spotlight / Command Palette Button */}
            <button
              onClick={() => {
                hapticLight();
                setShowCommandPalette(true);
              }}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-brand-850 border border-slate-200/80 dark:border-brand-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Search and Commands (Ctrl+K)"
            >
              <Search size={16} />
              <span className="hidden sm:inline text-xs font-semibold text-slate-500 dark:text-slate-400">Search</span>
              <kbd className="hidden sm:inline text-[9px] font-extrabold bg-slate-100 dark:bg-brand-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-brand-700">⌘K</kbd>
            </button>

            {/* Theme toggle mobile */}
            <button 
              onClick={toggleTheme} 
              className="p-2 md:hidden rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-brand-800 transition-colors"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Notification Bell Icon */}
            <div className="relative">
              <button 
                onClick={() => {
                  setShowBellMenu(!showBellMenu);
                  requestPermission(user?.uid); // Proactively request desktop/mobile permissions
                }}
                className="relative p-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-brand-800 transition-colors focus:outline-none"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 text-white text-[9px] font-bold items-center justify-center shadow">
                      {unreadCount}
                    </span>
                  </span>
                )}
              </button>

            </div>

            {/* Mobile Header User Info */}
            <div 
              className="md:hidden w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-inner" 
              style={{ backgroundColor: user?.avatarColor || '#64748b' }}
            >
              {user?.avatarEmoji || '👤'}
            </div>
          </div>
        </header>

        {/* Notification Dropdown/Fullscreen Portal - rendered into document.body to escape all CSS containing blocks */}
        {showBellMenu && createPortal(
          <>
            {/* Backdrop overlay to close menu (visible/active on desktop only) */}
            <div className="hidden sm:block fixed inset-0 z-[9998] cursor-pointer" onClick={() => setShowBellMenu(false)} />
            {/* Dropdown panel */}
            <div className="fixed inset-0 sm:inset-auto sm:top-[70px] sm:right-6 sm:left-auto sm:w-80 md:w-96 w-full h-full sm:h-auto bg-white dark:bg-brand-900 border-none sm:border sm:border-slate-200 sm:dark:border-brand-800 rounded-none sm:rounded-2xl shadow-none sm:shadow-xl z-[9999] overflow-hidden flex flex-col py-1 animate-in fade-in sm:zoom-in-95 sm:slide-in-from-top-4 duration-200 ease-out">
              <div className="px-6 py-4 sm:px-4 sm:py-3 border-b border-slate-100 dark:border-brand-800 flex items-center justify-between shrink-0">
                <span className="font-bold sm:font-semibold text-base sm:text-sm">Notifications</span>
                <div className="flex items-center gap-3">
                  {unreadCount > 0 && (
                    <button 
                      onClick={() => markAllAsRead()}
                      className="text-xs text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 font-medium cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                  {/* Close button - mobile only */}
                  <button
                    onClick={() => setShowBellMenu(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-650 hover:bg-slate-50 dark:hover:bg-brand-850 transition-colors sm:hidden cursor-pointer"
                    title="Close"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto sm:max-h-[350px] divide-y divide-slate-100 dark:divide-brand-800 no-scrollbar">
                {notifications.length === 0 ? (
                  <div className="px-6 py-8 text-center text-slate-400 text-xs">
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((n) => {
                    let IconComponent = Bell;
                    let iconBg = 'bg-slate-100 text-slate-500 dark:bg-brand-850 dark:text-slate-400';
                    
                    if (n.type === 'cardAssigned') {
                      IconComponent = CheckSquare;
                      iconBg = 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400';
                    } else if (n.type === 'cardMoved') {
                      IconComponent = Columns;
                      iconBg = 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400';
                    } else if (n.type === 'cardCompleted') {
                      IconComponent = CheckCircle2;
                      iconBg = 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400';
                    } else if (n.type === 'commentAdded') {
                      IconComponent = MessageSquare;
                      iconBg = 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400';
                    } else if (n.type === 'dueDateReminder') {
                      IconComponent = Calendar;
                      iconBg = 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400';
                    } else if (n.type === 'wipLimitExceeded') {
                      IconComponent = AlertTriangle;
                      iconBg = 'bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400';
                    }

                    return (
                      <div 
                        key={n.id} 
                        className={`p-3.5 flex items-start gap-3.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-brand-850/60 ${!n.read ? 'bg-indigo-50/15 dark:bg-indigo-950/10' : ''}`}
                      >
                        {/* Type Icon Badge */}
                        <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${iconBg}`}>
                          <IconComponent size={15} />
                        </div>

                        {/* Text Content */}
                        <div 
                          onClick={() => {
                            markAsRead(n.id);
                            if (n.relatedId && n.relatedType) {
                              localStorage.setItem('slate_open_item_id', n.relatedId);
                              localStorage.setItem('slate_open_item_type', n.relatedType);
                              const tabMap: Record<string, string> = {
                                event: 'calendar',
                                task: 'tasks',
                                card: 'kanban',
                                note: 'notes'
                              };
                              if (tabMap[n.relatedType]) {
                                setCurrentTab(tabMap[n.relatedType]);
                              }
                            }
                            setShowBellMenu(false);
                          }}
                          className="flex-1 min-w-0 cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className={`text-xs font-semibold leading-normal truncate ${!n.read ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                              {n.title}
                            </span>
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 shrink-0 mt-0.5">
                              {formatRelativeTime(n.timestamp)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed break-words">
                            {n.description}
                          </p>
                        </div>
                        
                        {/* Delete Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(n.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors shrink-0 cursor-pointer self-start"
                          title="Delete notification"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>,
          document.body
        )}

        {/* Layout Body */}
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">
          {children}
        </main>
      </div>

      {/* Universal Contextual Floating Action Button (Mobile) */}
      <FloatingActionButton 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
      />

      {/* Spotlight Command Palette (Cmd+K / Ctrl+K) */}
      <CommandPalette 
        isOpen={showCommandPalette} 
        onClose={() => setShowCommandPalette(false)} 
        setCurrentTab={setCurrentTab} 
      />

      {/* Streamlined Mobile Bottom Navigation Bar (4 Primary + More) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-brand-900/95 border-t border-slate-300 dark:border-slate-800 flex items-center justify-around pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] z-30 backdrop-blur-lg font-medium shadow-lg">
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                hapticLight();
                setCurrentTab(item.id);
              }}
              className={`relative flex-1 flex flex-col items-center gap-0.5 py-1 px-1 rounded-xl transition-all duration-150 ${
                isActive 
                  ? 'text-indigo-650 dark:text-indigo-400 font-bold scale-105' 
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <Icon size={20} className={isActive ? 'stroke-[2.5]' : ''} />
              <span className="text-[10px] tracking-tight">{item.name}</span>
              {item.badge && (
                <span className={`absolute top-0.5 right-1/4 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-xs ${
                  item.badge.type === 'danger' ? 'bg-rose-500 animate-pulse' : 'bg-indigo-650 dark:bg-indigo-500'
                }`}>
                  {item.badge.count}
                </span>
              )}
            </button>
          );
        })}

        {/* 5th Navigation Tab: More Drawer */}
        <button
          onClick={() => {
            hapticLight();
            setShowMobileMoreSheet(true);
          }}
          className={`relative flex-1 flex flex-col items-center gap-0.5 py-1 px-1 rounded-xl transition-all duration-150 ${
            ['chat', 'settings'].includes(currentTab)
              ? 'text-indigo-650 dark:text-indigo-400 font-bold scale-105' 
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <MoreHorizontal size={20} className={['chat', 'settings'].includes(currentTab) ? 'stroke-[2.5]' : ''} />
          <span className="text-[10px] tracking-tight">More</span>
          {unreadChatCount > 0 && (
            <span className="absolute top-0.5 right-1/4 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white bg-indigo-650 dark:bg-indigo-500 shadow-xs">
              {unreadChatCount}
            </span>
          )}
        </button>
      </nav>

      {/* Mobile "More" Drawer Bottom Sheet */}
      {showMobileMoreSheet && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setShowMobileMoreSheet(false)}
          />
          {/* Sheet Body */}
          <div 
            style={{
              transform: moreDragY > 0 ? `translateY(${moreDragY}px)` : undefined,
              transition: isDraggingMore ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className="relative z-10 bg-white dark:bg-brand-900 border-t border-slate-300 dark:border-slate-700 rounded-t-3xl p-5 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-2xl animate-sheet-up space-y-4 overscroll-contain"
          >
            {/* Top Drag Header with touch-action: none to block pull-to-refresh */}
            <div
              className="touch-none select-none -mt-2"
              onTouchStart={handleMoreTouchStart}
              onTouchMove={handleMoreTouchMove}
              onTouchEnd={handleMoreTouchEnd}
            >
              {/* Drag Handle */}
              <div 
                onClick={() => {
                  if (currentMoreDragY.current < 5) setShowMobileMoreSheet(false);
                }}
                className="w-full py-2 flex justify-center items-center cursor-pointer mb-1 active:opacity-75"
              >
                <div className="w-12 h-1.5 bg-slate-300 dark:bg-brand-700 rounded-full opacity-70" />
              </div>
              
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-brand-850">
                <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                  More Features
                </span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMobileMoreSheet(false);
                  }}
                  onTouchStart={(e) => e.stopPropagation()}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Chat */}
              <button
                onClick={() => {
                  hapticLight();
                  setCurrentTab('chat');
                  setShowMobileMoreSheet(false);
                }}
                className={`col-span-2 relative p-4 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
                  currentTab === 'chat'
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200 shadow-xs'
                    : 'bg-slate-50 dark:bg-brand-850/60 border-slate-200 dark:border-brand-800 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <MessageSquare size={20} />
                  </div>
                  <div>
                    <span className="text-sm font-bold block">Partner Chat</span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">Shared couple messaging</span>
                  </div>
                </div>
                {unreadChatCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black shadow-xs shrink-0">
                    {unreadChatCount} new
                  </span>
                )}
              </button>

              {/* Settings */}
              <button
                onClick={() => {
                  hapticLight();
                  setCurrentTab('settings');
                  setShowMobileMoreSheet(false);
                }}
                className={`p-3.5 rounded-2xl border flex flex-col gap-2 text-left transition-all cursor-pointer ${
                  currentTab === 'settings'
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200 shadow-xs'
                    : 'bg-slate-50 dark:bg-brand-850/60 border-slate-200 dark:border-brand-800 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-400 flex items-center justify-center">
                  <SettingsIcon size={18} />
                </div>
                <div>
                  <span className="text-xs font-bold block">Settings</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">Colors & pairing</span>
                </div>
              </button>

              {/* Quick Theme Toggle Card */}
              <button
                onClick={() => {
                  hapticLight();
                  toggleTheme();
                }}
                className="p-3.5 rounded-2xl border border-slate-200 dark:border-brand-800 bg-slate-50 dark:bg-brand-850/60 flex flex-col gap-2 text-left transition-all text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </div>
                <div>
                  <span className="text-xs font-bold block">{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">Tap to toggle</span>
                </div>
              </button>
            </div>

            {/* User profile & signout footer */}
            <div className="pt-3 border-t border-slate-100 dark:border-brand-850 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-inner" 
                  style={{ backgroundColor: user?.avatarColor || '#64748b' }}
                >
                  {user?.avatarEmoji || '👤'}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold leading-tight text-slate-900 dark:text-slate-100">{user?.name}</span>
                  <span className="text-[10px] text-slate-400 truncate max-w-[170px]">{user?.email}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  hapticMedium();
                  signOut();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-bold transition-colors cursor-pointer"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

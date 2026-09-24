import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Calendar, 
  CheckSquare, 
  ShoppingCart, 
  FileText, 
  MessageSquare, 
  Settings, 
  Moon, 
  Sun, 
  Plus, 
  CornerDownLeft, 
  X,
  Sparkles
} from 'lucide-react';
import { useCalendarStore } from '../store/calendarStore';
import { useTasksStore } from '../store/tasksStore';
import { useListsStore } from '../store/listsStore';
import { useNotesStore } from '../store/notesStore';
import { useAuthStore } from '../store/authStore';
import { hapticLight, hapticMedium } from '../utils/haptics';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  setCurrentTab: (tab: string) => void;
}

interface CommandItem {
  id: string;
  title: string;
  category: 'Navigation' | 'Actions' | 'Items';
  subtitle?: string;
  icon: React.ComponentType<{ size: number; className?: string }>;
  action: () => void;
  badge?: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  setCurrentTab
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { theme, toggleTheme } = useAuthStore();
  const { events, setShowCreateEventModal } = useCalendarStore();
  const { tasks } = useTasksStore();
  const { items: listItems } = useListsStore();
  const { notes } = useNotesStore();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const navCommands: CommandItem[] = [
    {
      id: 'nav-calendar',
      title: 'Calendar',
      category: 'Navigation',
      subtitle: 'View your shared schedule & events',
      icon: Calendar,
      action: () => {
        setCurrentTab('calendar');
        onClose();
      }
    },
    {
      id: 'nav-tasks',
      title: 'Tasks & Reminders',
      category: 'Navigation',
      subtitle: 'Manage to-dos and priorities',
      icon: CheckSquare,
      action: () => {
        setCurrentTab('tasks');
        onClose();
      }
    },
    {
      id: 'nav-lists',
      title: 'Shopping & Lists',
      category: 'Navigation',
      subtitle: 'Manage shared groceries & lists',
      icon: ShoppingCart,
      action: () => {
        setCurrentTab('lists');
        onClose();
      }
    },
    {
      id: 'nav-notes',
      title: 'Shared Notes',
      category: 'Navigation',
      subtitle: 'Markdown notes & thoughts',
      icon: FileText,
      action: () => {
        setCurrentTab('notes');
        onClose();
      }
    },
    {
      id: 'nav-chat',
      title: 'Partner Chat',
      category: 'Navigation',
      subtitle: 'Chat & shared coordination',
      icon: MessageSquare,
      action: () => {
        setCurrentTab('chat');
        onClose();
      }
    },
    {
      id: 'nav-settings',
      title: 'Settings & Profile',
      category: 'Navigation',
      subtitle: 'Preferences & theme',
      icon: Settings,
      action: () => {
        setCurrentTab('settings');
        onClose();
      }
    }
  ];

  const actionCommands: CommandItem[] = [
    {
      id: 'act-new-event',
      title: 'New Calendar Event',
      category: 'Actions',
      subtitle: 'Add a new event to shared calendar',
      icon: Plus,
      badge: 'Event',
      action: () => {
        setCurrentTab('calendar');
        setShowCreateEventModal(true);
        onClose();
      }
    },
    {
      id: 'act-new-task',
      title: 'New Task',
      category: 'Actions',
      subtitle: 'Add a new task',
      icon: Plus,
      badge: 'Task',
      action: () => {
        setCurrentTab('tasks');
        onClose();
      }
    },
    {
      id: 'act-new-item',
      title: 'Add to Shopping List',
      category: 'Actions',
      subtitle: 'Quickly add grocery or household item',
      icon: Plus,
      badge: 'List',
      action: () => {
        setCurrentTab('lists');
        onClose();
      }
    },
    {
      id: 'act-theme',
      title: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      category: 'Actions',
      subtitle: 'Toggle app appearance',
      icon: theme === 'dark' ? Sun : Moon,
      action: () => {
        toggleTheme();
        onClose();
      }
    }
  ];

  // Dynamic search through user data
  const matchingItems: CommandItem[] = [];
  const q = query.trim().toLowerCase();

  if (q.length > 0) {
    // Tasks
    tasks.filter(t => t.title.toLowerCase().includes(q)).slice(0, 4).forEach(t => {
      matchingItems.push({
        id: `item-task-${t.id}`,
        title: t.title,
        category: 'Items',
        subtitle: `Task • Priority: ${t.priority}`,
        icon: CheckSquare,
        action: () => {
          setCurrentTab('tasks');
          onClose();
        }
      });
    });

    // Calendar events
    events.filter(e => e.title.toLowerCase().includes(q)).slice(0, 4).forEach(e => {
      matchingItems.push({
        id: `item-event-${e.id}`,
        title: e.title,
        category: 'Items',
        subtitle: `Calendar • ${e.start.slice(0, 10)}`,
        icon: Calendar,
        action: () => {
          setCurrentTab('calendar');
          onClose();
        }
      });
    });

    // Notes
    notes.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)).slice(0, 3).forEach(n => {
      matchingItems.push({
        id: `item-note-${n.id}`,
        title: n.title,
        category: 'Items',
        subtitle: 'Note',
        icon: FileText,
        action: () => {
          setCurrentTab('notes');
          onClose();
        }
      });
    });

    // Grocery items
    listItems.filter(i => i.name.toLowerCase().includes(q)).slice(0, 3).forEach(i => {
      matchingItems.push({
        id: `item-list-${i.id}`,
        title: i.name,
        category: 'Items',
        subtitle: `List • ${i.category}`,
        icon: ShoppingCart,
        action: () => {
          setCurrentTab('lists');
          onClose();
        }
      });
    });
  }

  // Filter navigation & actions if query is typed
  const filteredNav = navCommands.filter(c => 
    c.title.toLowerCase().includes(q) || (c.subtitle && c.subtitle.toLowerCase().includes(q))
  );

  const filteredActions = actionCommands.filter(c => 
    c.title.toLowerCase().includes(q) || (c.subtitle && c.subtitle.toLowerCase().includes(q))
  );

  const allItems: CommandItem[] = [
    ...filteredActions,
    ...matchingItems,
    ...filteredNav
  ];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      hapticLight();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, allItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      hapticLight();
      setSelectedIndex(prev => (prev - 1 + allItems.length) % Math.max(1, allItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        hapticMedium();
        allItems[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-14 sm:pt-24 px-4">
      {/* Blurred Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Palette Modal */}
      <div className="relative w-full max-w-xl bg-white dark:bg-brand-900 border border-slate-300 dark:border-slate-700 rounded-3xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-brand-800">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search anything..."
            className="flex-1 bg-transparent text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          {query ? (
            <button 
              onClick={() => {
                setQuery('');
                setSelectedIndex(0);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X size={14} />
            </button>
          ) : (
            <div className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-brand-850 px-2 py-0.5 rounded-md border border-slate-200/50 dark:border-brand-800/50">
              <span>ESC</span>
            </div>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-2 no-scrollbar space-y-1">
          {allItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500">
              <Sparkles size={24} className="mx-auto mb-2 opacity-50" />
              <p className="text-xs font-semibold">No results found for "{query}"</p>
            </div>
          ) : (
            allItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    hapticMedium();
                    item.action();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-950 dark:text-white' 
                      : 'hover:bg-slate-50 dark:hover:bg-brand-850/50 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-xl shrink-0 transition-colors ${
                      isSelected 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'bg-slate-100 dark:bg-brand-850 text-slate-500 dark:text-slate-400'
                    }`}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate leading-tight flex items-center gap-2">
                        <span>{item.title}</span>
                        {item.badge && (
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <CornerDownLeft size={14} className="text-indigo-500 dark:text-indigo-400 shrink-0 ml-2" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-brand-950/50 border-t border-slate-100 dark:border-brand-850 flex items-center justify-between text-[10px] text-slate-400 font-medium">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 text-[9px] font-bold">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 text-[9px] font-bold">↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 text-[9px] font-bold">↵</kbd>
              <span>to select</span>
            </span>
          </div>
          <span>Slate Spotlight</span>
        </div>

      </div>
    </div>
  );
};

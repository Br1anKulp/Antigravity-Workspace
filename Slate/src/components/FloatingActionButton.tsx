import React, { useState } from 'react';
import { 
  Plus, 
  Calendar, 
  CheckSquare, 
  ShoppingCart, 
  FileText
} from 'lucide-react';
import { useCalendarStore } from '../store/calendarStore';
import { hapticLight, hapticMedium } from '../utils/haptics';

interface FloatingActionButtonProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenCreateTask?: () => void;
  onOpenCreateNote?: () => void;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  currentTab,
  setCurrentTab,
  onOpenCreateTask,
  onOpenCreateNote
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { setShowCreateEventModal } = useCalendarStore();

  const handleMainClick = () => {
    hapticMedium();
    // Contextual direct action if user taps once
    if (!isOpen) {
      if (currentTab === 'calendar') {
        setShowCreateEventModal(true);
        return;
      }
      if (currentTab === 'tasks') {
        if (onOpenCreateTask) onOpenCreateTask();
        else {
          window.dispatchEvent(new CustomEvent('slate-open-add-task'));
        }
        return;
      }
      if (currentTab === 'lists') {
        // Scroll to or focus the list input
        const input = document.getElementById('slate-grocery-input');
        if (input) {
          input.focus();
          input.scrollIntoView({ behavior: 'smooth' });
        }
        return;
      }
      if (currentTab === 'notes') {
        if (onOpenCreateNote) onOpenCreateNote();
        else {
          window.dispatchEvent(new CustomEvent('slate-open-add-note'));
        }
        return;
      }
    }

    // Otherwise toggle speed-dial menu
    setIsOpen(!isOpen);
  };

  const handleSpeedDialAction = (type: 'event' | 'task' | 'list' | 'note') => {
    hapticLight();
    setIsOpen(false);

    if (type === 'event') {
      setCurrentTab('calendar');
      setTimeout(() => setShowCreateEventModal(true), 50);
    } else if (type === 'task') {
      setCurrentTab('tasks');
      setTimeout(() => {
        if (onOpenCreateTask) onOpenCreateTask();
        else window.dispatchEvent(new CustomEvent('slate-open-add-task'));
      }, 50);
    } else if (type === 'list') {
      setCurrentTab('lists');
      setTimeout(() => {
        const input = document.getElementById('slate-grocery-input');
        if (input) {
          input.focus();
          input.scrollIntoView({ behavior: 'smooth' });
        }
      }, 50);
    } else if (type === 'note') {
      setCurrentTab('notes');
      setTimeout(() => {
        if (onOpenCreateNote) onOpenCreateNote();
        else window.dispatchEvent(new CustomEvent('slate-open-add-note'));
      }, 50);
    }
  };

  return (
    <div className="sm:hidden fixed bottom-20 right-4 z-40 flex flex-col items-end">
      {/* Backdrop when speed dial is open */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs z-30 transition-opacity animate-in fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Speed Dial Options Container */}
      {isOpen && (
        <div className="relative z-40 mb-3 flex flex-col items-end gap-2.5 animate-in slide-in-from-bottom-5 fade-in duration-150">
          
          {/* Note Option */}
          <button
            onClick={() => handleSpeedDialAction('note')}
            className="flex items-center gap-2.5 group cursor-pointer"
          >
            <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm">
              New Note
            </span>
            <div className="w-10 h-10 rounded-full bg-amber-500 text-white shadow-md flex items-center justify-center transition-transform active:scale-90">
              <FileText size={18} />
            </div>
          </button>

          {/* List Item Option */}
          <button
            onClick={() => handleSpeedDialAction('list')}
            className="flex items-center gap-2.5 group cursor-pointer"
          >
            <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm">
              List Item
            </span>
            <div className="w-10 h-10 rounded-full bg-emerald-500 text-white shadow-md flex items-center justify-center transition-transform active:scale-90">
              <ShoppingCart size={18} />
            </div>
          </button>

          {/* Task Option */}
          <button
            onClick={() => handleSpeedDialAction('task')}
            className="flex items-center gap-2.5 group cursor-pointer"
          >
            <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm">
              New Task
            </span>
            <div className="w-10 h-10 rounded-full bg-blue-500 text-white shadow-md flex items-center justify-center transition-transform active:scale-90">
              <CheckSquare size={18} />
            </div>
          </button>

          {/* Event Option */}
          <button
            onClick={() => handleSpeedDialAction('event')}
            className="flex items-center gap-2.5 group cursor-pointer"
          >
            <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm">
              New Event
            </span>
            <div className="w-10 h-10 rounded-full bg-indigo-600 text-white shadow-md flex items-center justify-center transition-transform active:scale-90">
              <Calendar size={18} />
            </div>
          </button>

        </div>
      )}

      {/* Main Trigger Button */}
      <button
        type="button"
        onClick={handleMainClick}
        onContextMenu={(e) => {
          e.preventDefault();
          hapticMedium();
          setIsOpen(!isOpen);
        }}
        aria-label="Create Action"
        className={`relative z-40 w-13 h-13 rounded-full text-white shadow-xl shadow-indigo-600/30 flex items-center justify-center cursor-pointer transition-all duration-200 border-2 border-white/20 active:scale-90 ${
          isOpen ? 'bg-slate-800 dark:bg-slate-700 rotate-45' : 'bg-indigo-650 hover:bg-indigo-550'
        }`}
      >
        <Plus size={24} className="stroke-[2.5] transition-transform" />
      </button>
    </div>
  );
};

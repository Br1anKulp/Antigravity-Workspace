import React from 'react';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { Calendar, Plus } from 'lucide-react';
import type { CalendarEvent } from '../../store/calendarStore';
import { useAuthStore } from '../../store/authStore';

interface DayDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  getFilteredEvents: (startDate: Date, endDate: Date) => CalendarEvent[];
  isEventPassed: (event: CalendarEvent) => boolean;
  openCreateModal: (date: Date) => void;
  openEditModal: (event: CalendarEvent) => void;
}

export const DayDetailModal: React.FC<DayDetailModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  getFilteredEvents,
  isEventPassed,
  openCreateModal,
  openEditModal
}) => {
  const { user } = useAuthStore();

  if (!isOpen) return null;

  const dayEvents = getFilteredEvents(startOfDay(selectedDate), endOfDay(selectedDate));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center mb-4 border-b border-slate-150 dark:border-brand-850 pb-3">
          <div>
            <h3 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-550 uppercase tracking-widest">
              Selected Day Overview
            </h3>
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 mt-0.5">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-brand-800 hover:bg-slate-50 dark:hover:bg-brand-850 text-slate-700 dark:text-slate-350 cursor-pointer"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1 no-scrollbar my-2">
          {dayEvents.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
              <Calendar size={48} className="text-slate-300 dark:text-slate-700 mb-3 stroke-[1.5]" />
              <p className="text-sm font-semibold">No events scheduled for this day.</p>
              <p className="text-xs opacity-70 mt-1">Tap 'Add Event' below to add something to this day.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {dayEvents.map(e => (
                <div
                  key={e.id}
                  onClick={() => {
                    onClose();
                    openEditModal(e);
                  }}
                  className="p-4 bg-slate-50/50 dark:bg-brand-950/25 border border-slate-150 dark:border-brand-850 rounded-2xl hover:border-slate-350 dark:hover:border-brand-700 transition-all flex justify-between items-center cursor-pointer group hover:scale-[0.99]"
                >
                  <div className="flex gap-3 items-center min-w-0">
                    <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                    <div className="min-w-0">
                      <h4 className={`text-sm font-bold transition-colors truncate ${isEventPassed(e) ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200 group-hover:text-indigo-650 dark:group-hover:text-indigo-400'}`}>
                        {e.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-slate-750 dark:text-slate-300">
                          {e.allDay ? 'All Day' : format(parseISO(e.start), 'h:mm a')}
                        </span>
                        {e.notes && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                            <span className="truncate max-w-[150px]">{e.notes}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {(() => {
                    const isMine = e.assignee === 'both' ||
                      (e.creatorId === user?.uid && e.assignee === 'self') ||
                      (e.creatorId !== user?.uid && e.assignee === 'partner');
                    const isBoth = e.assignee === 'both';
                    return (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        isBoth
                          ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400'
                          : isMine
                          ? 'bg-blue-50 text-blue-650 dark:bg-blue-950/30 dark:text-blue-400'
                          : 'bg-pink-50 text-pink-650 dark:bg-pink-950/30 dark:text-pink-400'
                      }`}>
                        {isBoth ? 'Both' : isMine ? 'Me' : 'Partner'}
                      </span>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-150 dark:border-brand-850 flex justify-end gap-2">
          <button
            onClick={() => {
              onClose();
              openCreateModal(selectedDate);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-slate-100 rounded-xl text-xs font-bold shadow-md transition-all shrink-0 cursor-pointer"
          >
            <Plus size={14} /> Add Event
          </button>
        </div>
      </div>
    </div>
  );
};

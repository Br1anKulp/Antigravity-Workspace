import React from 'react';
import { format, startOfMonth, addDays, eachDayOfInterval, isToday, parseISO } from 'date-fns';
import { Calendar, Plus, RefreshCw } from 'lucide-react';
import type { CalendarEvent } from '../../store/calendarStore';
import { useAuthStore } from '../../store/authStore';

interface ScheduleViewProps {
  selectedDate: Date;
  getFilteredEvents: (startDate: Date, endDate: Date) => CalendarEvent[];
  isEventOnDay: (event: CalendarEvent, day: Date) => boolean;
  isEventPassed: (event: CalendarEvent) => boolean;
  openCreateModal: (date: Date) => void;
  openEditModal: (event: CalendarEvent) => void;
}

const ScheduleViewComponent = ({
  selectedDate,
  getFilteredEvents,
  isEventOnDay,
  isEventPassed,
  openCreateModal,
  openEditModal
}: ScheduleViewProps) => {
  const { user } = useAuthStore();
  const startDate = startOfMonth(selectedDate);
  const endDate = addDays(startDate, 90);
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const expanded = getFilteredEvents(startDate, endDate);

  // Filter only those days that have events scheduled
  const dayWithEvents = days.map(day => {
    const dayEvents = expanded.filter(e => isEventOnDay(e, day));
    return { day, events: dayEvents };
  }).filter(d => d.events.length > 0);

  if (dayWithEvents.length === 0) {
    return (
      <div className="bg-white dark:bg-brand-900 rounded-3xl border border-slate-200 dark:border-brand-800 p-8 text-center flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 shadow-sm animate-in fade-in duration-200 min-h-[300px]">
        <Calendar size={48} className="text-slate-300 dark:text-slate-700 mb-3 stroke-[1.5]" />
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No upcoming events</h3>
        <p className="text-xs opacity-70 mt-1">There are no events scheduled for the next 3 months.</p>
        <button
          onClick={() => openCreateModal(selectedDate)}
          className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-slate-100 rounded-xl text-xs font-bold shadow-md transition-all shrink-0 cursor-pointer"
        >
          <Plus size={14} /> Add Event
        </button>
      </div>
    );
  }

  // Group days by Month + Year for sticky/section headers
  const groups: { monthStr: string; items: typeof dayWithEvents }[] = [];
  dayWithEvents.forEach(item => {
    const monthStr = format(item.day, 'MMMM yyyy');
    let g = groups.find(x => x.monthStr === monthStr);
    if (!g) {
      g = { monthStr, items: [] };
      groups.push(g);
    }
    g.items.push(item);
  });

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1 no-scrollbar animate-in fade-in duration-200">
      {groups.map(group => (
        <div key={group.monthStr} className="space-y-3">
          {/* Sticky Month Section Separator */}
          <div className="sticky top-0 bg-slate-50/90 dark:bg-brand-955/90 backdrop-blur-sm py-2 px-4 z-10 rounded-xl border border-slate-200/50 dark:border-brand-850/50 shadow-sm flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
              {group.monthStr}
            </span>
          </div>

          <div className="space-y-2">
            {group.items.map(({ day, events: dayEvents }) => {
              const isDayToday = isToday(day);
              return (
                <div 
                  key={day.toString()}
                  className={`flex items-start gap-4 p-3 rounded-2xl border transition-all ${
                    isDayToday 
                      ? 'bg-indigo-50/10 dark:bg-indigo-950/10 border-indigo-200 dark:border-indigo-900/60' 
                      : 'bg-white dark:bg-brand-900 border-slate-100 dark:border-brand-850 hover:border-slate-250 dark:hover:border-brand-750'
                  }`}
                >
                  {/* Date label column */}
                  <div className="flex flex-col items-center justify-center w-12 shrink-0">
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider ${
                      isDayToday ? 'text-indigo-650 dark:text-indigo-400 font-black' : 'text-slate-400 dark:text-slate-500'
                    }`}>
                      {format(day, 'E')}
                    </span>
                    <span className={`text-base font-black w-8 h-8 flex items-center justify-center rounded-full mt-0.5 ${
                      isDayToday 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'text-slate-700 dark:text-slate-300'
                    }`}>
                      {format(day, 'd')}
                    </span>
                  </div>

                  {/* Events detailed row stack */}
                  <div className="flex-1 space-y-2 min-w-0">
                    {dayEvents.map(e => (
                      <div
                        key={e.id}
                        onClick={() => openEditModal(e)}
                        className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-brand-950/20 border border-slate-100 dark:border-brand-850 rounded-xl hover:border-slate-300 dark:hover:border-brand-700 transition-all cursor-pointer group/item"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span 
                            className="w-1.5 h-7 rounded-full shrink-0" 
                            style={{ backgroundColor: e.color }}
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className={`text-sm font-bold truncate group-hover/item:text-indigo-600 dark:group-hover/item:text-indigo-400 transition-colors ${
                              isEventPassed(e) ? 'line-through text-slate-405 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'
                            }`}>
                              {e.title}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              <span className="font-semibold text-slate-750 dark:text-slate-300">
                                {e.allDay ? 'All Day' : format(parseISO(e.start), 'h:mm a')}
                              </span>
                              {e.notes && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                                  <span className="truncate max-w-[200px]">{e.notes}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {e.recurring && e.recurring.frequency !== 'none' && (
                            <RefreshCw size={12} className="text-slate-400 dark:text-slate-500 animate-spin-slow" />
                          )}
                          {(() => {
                            const isMine = e.assignee === 'both' ||
                              (e.creatorId === user?.uid && e.assignee === 'self') ||
                              (e.creatorId !== user?.uid && e.assignee === 'partner');
                            const isBoth = e.assignee === 'both';
                            return (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
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
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export const ScheduleView = React.memo(ScheduleViewComponent);
ScheduleView.displayName = 'ScheduleView';


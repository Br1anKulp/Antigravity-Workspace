import React from 'react';
import { 
  format, 
  addDays, 
  addMonths,
  subMonths,
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday, 
  parseISO,
  isSameDay
} from 'date-fns';
import { RefreshCw, Clock } from 'lucide-react';
import type { CalendarEvent } from '../../store/calendarStore';
import { useAuthStore } from '../../store/authStore';

interface CalendarGridProps {
  activeView: 'Day' | '4-Day' | '2-Week' | 'Month' | 'Schedule';
  selectedDate: Date;
  getFilteredEvents: (startDate: Date, endDate: Date) => CalendarEvent[];
  isEventOnDay: (event: CalendarEvent, day: Date) => boolean;
  isEventPassed: (event: CalendarEvent) => boolean;
  openCreateModal: (date: Date, hourStr?: string) => void;
  openEditModal: (event: CalendarEvent) => void;
  setSelectedDate: (date: Date) => void;
  setShowDayDetailModal: (visible: boolean) => void;
  onEventDrop?: (eventId: string, targetDate: Date) => void;
}

const CalendarGridComponent = ({
  activeView,
  selectedDate,
  getFilteredEvents,
  isEventOnDay,
  isEventPassed,
  openCreateModal,
  openEditModal,
  setSelectedDate,
  setShowDayDetailModal,
  onEventDrop
}: CalendarGridProps) => {
  const user = useAuthStore(state => state.user);
  const theme = useAuthStore(state => state.theme);
  const isDarkMode = theme === 'dark';

  const getEventColors = (baseColor: string) => {
    let hex = baseColor.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;

    // Calculate relative luminance (WCAG formula) to pick white or black text
    const toLinear = (c: number) => {
      const n = c / 255;
      return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
    };
    const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    const textColor = luminance > 0.35 ? '#000000' : '#ffffff';

    return {
      bg: baseColor,
      border: baseColor,
      text: textColor
    };
  };

  const [touchStartX, setTouchStartX] = React.useState<number | null>(null);
  const [touchStartY, setTouchStartY] = React.useState<number | null>(null);

  const renderMonthView = () => {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const expanded = getFilteredEvents(startDate, endDate);

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    const handleTouchStart = (e: React.TouchEvent) => {
      setTouchStartX(e.touches[0].clientX);
      setTouchStartY(e.touches[0].clientY);
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
      if (touchStartX === null || touchStartY === null) return;
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;

      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;

      // Ensure horizontal swipe is dominant over vertical scroll
      if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX < 0) {
          // Swiped left -> Next Month
          setSelectedDate(addMonths(selectedDate, 1));
        } else {
          // Swiped right -> Previous Month
          setSelectedDate(subMonths(selectedDate, 1));
        }
      }

      setTouchStartX(null);
      setTouchStartY(null);
    };

    return (
      <div 
        className="flex flex-col gap-4"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="bg-white dark:bg-brand-900 rounded-3xl border border-slate-200 dark:border-brand-800 overflow-hidden shadow-sm flex flex-col animate-in fade-in duration-200">
          {/* Day header row */}
          <div className="grid grid-cols-7 border-b border-slate-100 dark:border-brand-850 text-center py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {dayLabels.map(l => <div key={l}>{l}</div>)}
          </div>
          
          {/* Days Grid */}
          <div className="flex flex-col flex-1 divide-y divide-slate-200 dark:divide-brand-800">
            {weeks.map((week, weekIdx) => {
              const weekEvents = expanded.filter(e => week.some(day => isEventOnDay(e, day)));
              
              // Track allocation algorithm
              const sortedWeekEvents = [...weekEvents].sort((a, b) => {
                const aStart = parseISO(a.start);
                const aEnd = parseISO(a.end);
                const bStart = parseISO(b.start);
                const bEnd = parseISO(b.end);
                const aLen = aEnd.getTime() - aStart.getTime();
                const bLen = bEnd.getTime() - bStart.getTime();
                
                if (a.allDay && !b.allDay) return -1;
                if (!a.allDay && b.allDay) return 1;
                if (aLen !== bLen) return bLen - aLen;
                return aStart.getTime() - bStart.getTime();
              });

              const tracks: CalendarEvent[][] = [];
              const eventToTrack = new Map<string, number>();

              sortedWeekEvents.forEach(event => {
                const eventDays = week.map((day, idx) => ({ day, idx })).filter(({ day }) => isEventOnDay(event, day));
                if (eventDays.length === 0) return;
                const startIdx = eventDays[0].idx;
                const endIdx = eventDays[eventDays.length - 1].idx;

                const instanceId = event.id + '_' + event.start;
                let trackIdx = 0;
                while (true) {
                  if (!tracks[trackIdx]) {
                    tracks[trackIdx] = [];
                  }
                  const hasOverlap = tracks[trackIdx].some(existingEvent => {
                    const existingDays = week.map((day, idx) => ({ day, idx })).filter(({ day }) => isEventOnDay(existingEvent, day));
                    const existingStart = existingDays[0].idx;
                    const existingEnd = existingDays[existingDays.length - 1].idx;
                    return Math.max(startIdx, existingStart) <= Math.min(endIdx, existingEnd);
                  });

                  if (!hasOverlap) {
                    tracks[trackIdx].push(event);
                    eventToTrack.set(instanceId, trackIdx);
                    break;
                  }
                  trackIdx++;
                }
              });

              // Calculate hidden events count per day
              const hiddenCounts = Array(7).fill(0);
              week.forEach((day, dayIdx) => {
                const dayEvents = weekEvents.filter(e => isEventOnDay(e, day));
                dayEvents.forEach(e => {
                  const trackIdx = eventToTrack.get(e.id + '_' + e.start);
                  if (trackIdx !== undefined && trackIdx >= 3) {
                    hiddenCounts[dayIdx]++;
                  }
                });
              });

              return (
                <div key={weekIdx} className="relative min-h-[100px] sm:min-h-[120px] md:min-h-[140px] flex-1 flex flex-col">
                  {/* Background grid */}
                  <div className="absolute inset-0 grid grid-cols-7">
                    {week.map((day) => {
                      const isCurrentMonth = isSameMonth(day, selectedDate);
                      return (
                        <div
                          key={day.toString()}
                          onClick={() => {
                            setSelectedDate(day);
                            setShowDayDetailModal(true);
                          }}
                          onDoubleClick={() => openCreateModal(day)}
                          onDragOver={(evt) => evt.preventDefault()}
                          onDrop={(evt) => {
                            evt.preventDefault();
                            const eventId = evt.dataTransfer.getData('text/plain');
                            if (eventId && onEventDrop) {
                              onEventDrop(eventId, day);
                            }
                          }}
                          className={`flex p-1 sm:p-1.5 md:p-2.5 min-h-[100px] sm:min-h-[120px] md:min-h-[140px] hover:bg-slate-50/50 dark:hover:bg-brand-850/10 cursor-pointer flex-col transition-colors ${
                            !isCurrentMonth ? 'bg-slate-50/20 dark:bg-brand-950/5 text-slate-400 dark:text-slate-600 opacity-60' : 'bg-white dark:bg-brand-900'
                          } ${isToday(day) ? 'bg-indigo-50/20 dark:bg-indigo-950/10' : ''} ${
                            isSameDay(day, selectedDate)
                              ? 'ring-2 ring-inset ring-indigo-500/40 bg-indigo-50/10 dark:bg-indigo-950/10'
                              : ''
                          }`}
                        >
                          <div className="flex justify-start mb-1 sm:mb-1.5">
                            <span className={`text-[9px] sm:text-[10px] md:text-[11px] font-black rounded-full w-4.5 h-4.5 sm:w-5 sm:h-5 md:w-6 md:h-6 flex items-center justify-center transition-all ${
                              isToday(day) 
                                ? 'bg-indigo-650 text-white shadow-sm font-extrabold scale-105' 
                                : isSameDay(day, selectedDate)
                                ? 'text-indigo-650 dark:text-indigo-400 font-black'
                                : 'text-slate-650 dark:text-slate-350'
                            }`}>
                              {format(day, 'd')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Foreground Events grid overlay */}
                  <div className="grid absolute inset-0 pt-5.5 sm:pt-7 md:pt-9 pb-1 gap-y-0.5 md:gap-y-1 px-0.5 md:px-1.5 pointer-events-none grid-cols-7 w-full h-full">
                    {sortedWeekEvents.map(e => {
                      const trackIdx = eventToTrack.get(e.id + '_' + e.start);
                      if (trackIdx === undefined || trackIdx >= 3) return null;

                      const eventDays = week.map((day, idx) => ({ day, idx })).filter(({ day }) => isEventOnDay(e, day));
                      if (eventDays.length === 0) return null;
                      const startIdx = eventDays[0].idx;
                      const endIdx = eventDays[eventDays.length - 1].idx;

                      return (
                        <div
                          key={e.id + '_' + e.start + '-' + weekIdx}
                          onClick={(evt) => {
                            evt.stopPropagation();
                            setSelectedDate(week[startIdx]);
                            openEditModal(e);
                          }}
                          draggable
                          onDragStart={(evt) => {
                            evt.stopPropagation();
                            evt.dataTransfer.setData('text/plain', e.id);
                          }}
                          className={`px-1.5 py-0 rounded-md text-[9px] sm:text-[10px] font-bold truncate transition-all hover:scale-[0.98] flex items-center justify-between gap-1 shadow-2xs cursor-grab active:cursor-grabbing hover:brightness-95 duration-150 pointer-events-auto h-4 sm:h-5 leading-none ${isEventPassed(e) ? 'opacity-40' : ''}`}
                          style={{ 
                            gridColumnStart: startIdx + 1,
                            gridColumnEnd: endIdx + 2,
                            gridRowStart: trackIdx + 1,
                            gridRowEnd: trackIdx + 2,
                            backgroundColor: getEventColors(e.color).bg,
                            color: getEventColors(e.color).text
                          }}
                          title={e.title}
                        >
                          <div className="flex items-center gap-1 min-w-0 font-bold truncate">
                            <span className={isEventPassed(e) ? 'line-through' : ''}>{e.title}</span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Hidden counts block */}
                    {hiddenCounts.map((count, dayIdx) => {
                      if (count === 0) return null;
                      return (
                        <div
                          key={`hidden-${dayIdx}`}
                          onClick={(evt) => {
                            evt.stopPropagation();
                            setSelectedDate(week[dayIdx]);
                            setShowDayDetailModal(true);
                          }}
                          className="px-2 py-0.5 rounded-md text-[9px] font-extrabold text-indigo-650 bg-indigo-50 dark:text-indigo-300 dark:bg-indigo-950/40 text-center border border-indigo-200/20 cursor-pointer pointer-events-auto"
                          style={{
                            gridColumnStart: dayIdx + 1,
                            gridRowStart: 4,
                            gridRowEnd: 5
                          }}
                        >
                          + {count} more
                        </div>
                      );
                    })}
                  </div>

                  {/* Grid line overlay — rendered on top of events so lines are always visible */}
                  <div
                    className="absolute inset-0 grid grid-cols-7 pointer-events-none"
                    style={{
                      zIndex: 10,
                      borderTop: `1px solid ${isDarkMode ? '#262626' : '#e2e8f0'}`,
                      borderLeft: `1px solid ${isDarkMode ? '#262626' : '#e2e8f0'}`
                    }}
                  >
                    {week.map((_, i) => (
                      <div
                        key={i}
                        style={{
                          borderRight: `1px solid ${isDarkMode ? '#262626' : '#e2e8f0'}`,
                          borderBottom: `1px solid ${isDarkMode ? '#262626' : '#e2e8f0'}`
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };


  // List grid view (2-Week)
  const renderTwoWeekView = () => {
    const startDate = startOfWeek(selectedDate);
    const endDate = addDays(startDate, 13);
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const expanded = getFilteredEvents(startDate, endDate);

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return (
      <div className="flex flex-col gap-4">
        <div className="bg-white dark:bg-brand-900 rounded-3xl border border-slate-200 dark:border-brand-800 overflow-hidden shadow-sm flex flex-col animate-in fade-in duration-200">
          {/* Day header row */}
          <div className="grid grid-cols-7 border-b border-slate-100 dark:border-brand-850 text-center py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {dayLabels.map(l => <div key={l}>{l}</div>)}
          </div>
          
          {/* Days Grid */}
          <div className="flex flex-col flex-1 divide-y divide-slate-200 dark:divide-brand-800">
            {weeks.map((week, weekIdx) => {
              const weekEvents = expanded.filter(e => week.some(day => isEventOnDay(e, day)));
              
              // Track allocation algorithm
              const sortedWeekEvents = [...weekEvents].sort((a, b) => {
                const aStart = parseISO(a.start);
                const aEnd = parseISO(a.end);
                const bStart = parseISO(b.start);
                const bEnd = parseISO(b.end);
                const aLen = aEnd.getTime() - aStart.getTime();
                const bLen = bEnd.getTime() - bStart.getTime();
                
                if (a.allDay && !b.allDay) return -1;
                if (!a.allDay && b.allDay) return 1;
                if (aLen !== bLen) return bLen - aLen;
                return aStart.getTime() - bStart.getTime();
              });

              const tracks: CalendarEvent[][] = [];
              const eventToTrack = new Map<string, number>();

              sortedWeekEvents.forEach(event => {
                const eventDays = week.map((day, idx) => ({ day, idx })).filter(({ day }) => isEventOnDay(event, day));
                if (eventDays.length === 0) return;
                const startIdx = eventDays[0].idx;
                const endIdx = eventDays[eventDays.length - 1].idx;

                const instanceId = event.id + '_' + event.start;
                let trackIdx = 0;
                while (true) {
                  if (!tracks[trackIdx]) {
                    tracks[trackIdx] = [];
                  }
                  const hasOverlap = tracks[trackIdx].some(existingEvent => {
                    const existingDays = week.map((day, idx) => ({ day, idx })).filter(({ day }) => isEventOnDay(existingEvent, day));
                    const existingStart = existingDays[0].idx;
                    const existingEnd = existingDays[existingDays.length - 1].idx;
                    return Math.max(startIdx, existingStart) <= Math.min(endIdx, existingEnd);
                  });

                  if (!hasOverlap) {
                    tracks[trackIdx].push(event);
                    eventToTrack.set(instanceId, trackIdx);
                    break;
                  }
                  trackIdx++;
                }
              });

              // Calculate hidden events count per day
              const hiddenCounts = Array(7).fill(0);
              week.forEach((day, dayIdx) => {
                const dayEvents = weekEvents.filter(e => isEventOnDay(e, day));
                dayEvents.forEach(e => {
                  const trackIdx = eventToTrack.get(e.id + '_' + e.start);
                  if (trackIdx !== undefined && trackIdx >= 3) {
                    hiddenCounts[dayIdx]++;
                  }
                });
              });

              return (
                <div key={weekIdx} className="relative min-h-[260px] md:min-h-[280px] flex-1 flex flex-col">
                  {/* Background grid */}
                  <div className="absolute inset-0 grid grid-cols-7">
                    {week.map((day) => {
                      const isCurrentMonth = isSameMonth(day, selectedDate);
                      return (
                        <div
                          key={day.toString()}
                          onClick={() => {
                            setSelectedDate(day);
                            setShowDayDetailModal(true);
                          }}
                          onDoubleClick={() => openCreateModal(day)}
                          onDragOver={(evt) => evt.preventDefault()}
                          onDrop={(evt) => {
                            evt.preventDefault();
                            const eventId = evt.dataTransfer.getData('text/plain');
                            if (eventId && onEventDrop) {
                              onEventDrop(eventId, day);
                            }
                          }}
                          className={`flex p-1.5 md:p-2.5 min-h-[260px] md:min-h-[280px] hover:bg-slate-50/50 dark:hover:bg-brand-850/10 cursor-pointer flex-col transition-colors ${
                            !isCurrentMonth ? 'bg-slate-50/20 dark:bg-brand-950/5 text-slate-400 dark:text-slate-600 opacity-60' : 'bg-white dark:bg-brand-900'
                          } ${isToday(day) ? 'bg-indigo-50/20 dark:bg-indigo-950/10' : ''} ${
                            isSameDay(day, selectedDate)
                              ? 'ring-2 ring-inset ring-indigo-500/40 bg-indigo-50/10 dark:bg-indigo-950/10'
                              : ''
                          }`}
                        >
                          <div className="flex justify-start mb-1.5">
                            <span className={`text-[10px] md:text-[11px] font-black rounded-full w-5 h-5 md:w-6 md:h-6 flex items-center justify-center transition-all ${
                              isToday(day) 
                                ? 'bg-indigo-650 text-white shadow-sm font-extrabold scale-105' 
                                : isSameDay(day, selectedDate)
                                ? 'text-indigo-650 dark:text-indigo-400 font-black'
                                : 'text-slate-650 dark:text-slate-350'
                            }`}>
                              {format(day, 'd')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Foreground Events grid overlay (responsive spacing/grid) */}
                  <div className="grid absolute inset-0 pt-7 md:pt-9 pb-1 gap-y-0.5 md:gap-y-1.5 px-0.5 md:px-1.5 pointer-events-none grid-cols-7 w-full h-full">
                    {sortedWeekEvents.map(e => {
                      const trackIdx = eventToTrack.get(e.id + '_' + e.start);
                      if (trackIdx === undefined || trackIdx >= 3) return null;

                      const eventDays = week.map((day, idx) => ({ day, idx })).filter(({ day }) => isEventOnDay(e, day));
                      if (eventDays.length === 0) return null;
                      const startIdx = eventDays[0].idx;
                      const endIdx = eventDays[eventDays.length - 1].idx;

                      return (
                        <div
                          key={e.id + '_' + e.start + '-' + weekIdx}
                          onClick={(evt) => {
                            evt.stopPropagation();
                            setSelectedDate(week[startIdx]);
                            openEditModal(e);
                          }}
                          draggable
                          onDragStart={(evt) => {
                            evt.stopPropagation();
                            evt.dataTransfer.setData('text/plain', e.id);
                          }}
                          className={`px-1 md:px-2 py-0.5 md:py-1 rounded-md text-[7px] md:text-[10px] font-black truncate transition-all hover:scale-[0.98] flex items-center justify-between gap-1 shadow-sm cursor-grab active:cursor-grabbing hover:brightness-90 duration-150 pointer-events-auto ${isEventPassed(e) ? 'opacity-40' : ''}`}
                          style={{ 
                            gridColumnStart: startIdx + 1,
                            gridColumnEnd: endIdx + 2,
                            gridRowStart: trackIdx + 1,
                            gridRowEnd: trackIdx + 2,
                            backgroundColor: getEventColors(e.color).bg,
                            color: getEventColors(e.color).text
                          }}
                          title={e.title}
                        >
                          <div className="flex items-center gap-1 min-w-0 font-medium">
                            <span className={isEventPassed(e) ? 'line-through' : ''}>{e.title}</span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Hidden counts block */}
                    {hiddenCounts.map((count, dayIdx) => {
                      if (count === 0) return null;
                      return (
                        <div
                          key={`hidden-${dayIdx}`}
                          onClick={(evt) => {
                            evt.stopPropagation();
                            setSelectedDate(week[dayIdx]);
                            setShowDayDetailModal(true);
                          }}
                          className="px-2 py-0.5 rounded-md text-[9px] font-extrabold text-indigo-650 bg-indigo-50 dark:text-indigo-300 dark:bg-indigo-950/40 text-center border border-indigo-200/20 cursor-pointer pointer-events-auto"
                          style={{
                            gridColumnStart: dayIdx + 1,
                            gridRowStart: 4,
                            gridRowEnd: 5
                          }}
                        >
                          + {count} more
                        </div>
                      );
                    })}
                  </div>

                  {/* Grid line overlay — rendered on top of events so lines are always visible */}
                  <div
                    className="absolute inset-0 grid grid-cols-7 pointer-events-none"
                    style={{
                      zIndex: 10,
                      borderTop: `1px solid ${isDarkMode ? '#262626' : '#e2e8f0'}`,
                      borderLeft: `1px solid ${isDarkMode ? '#262626' : '#e2e8f0'}`
                    }}
                  >
                    {week.map((_, i) => (
                      <div
                        key={i}
                        style={{
                          borderRight: `1px solid ${isDarkMode ? '#262626' : '#e2e8f0'}`,
                          borderBottom: `1px solid ${isDarkMode ? '#262626' : '#e2e8f0'}`
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Grid of day blocks (4-Day, 8-Day)
  const renderDayBlocksView = (daysCount: number) => {
    const startDate = selectedDate;
    const endDate = addDays(startDate, daysCount - 1);
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const expanded = getFilteredEvents(startDate, endDate);

    // Track allocation algorithm for all events in this range
    const sortedEvents = [...expanded].sort((a, b) => {
      const aStart = parseISO(a.start);
      const aEnd = parseISO(a.end);
      const bStart = parseISO(b.start);
      const bEnd = parseISO(b.end);
      const aLen = aEnd.getTime() - aStart.getTime();
      const bLen = bEnd.getTime() - bStart.getTime();
      
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      if (aLen !== bLen) return bLen - aLen;
      return aStart.getTime() - bStart.getTime();
    });

    const tracks: CalendarEvent[][] = [];
    const eventToTrack = new Map<string, number>();

    sortedEvents.forEach(event => {
      const eventDays = days.map((day, idx) => ({ day, idx })).filter(({ day }) => isEventOnDay(event, day));
      if (eventDays.length === 0) return;
      const startIdx = eventDays[0].idx;
      const endIdx = eventDays[eventDays.length - 1].idx;

      const instanceId = event.id + '_' + event.start;
      let trackIdx = 0;
      while (true) {
        if (!tracks[trackIdx]) {
          tracks[trackIdx] = [];
        }
        const hasOverlap = tracks[trackIdx].some(existingEvent => {
          const existingDays = days.map((day, idx) => ({ day, idx })).filter(({ day }) => isEventOnDay(existingEvent, day));
          const existingStart = existingDays[0].idx;
          const existingEnd = existingDays[existingDays.length - 1].idx;
          return Math.max(startIdx, existingStart) <= Math.min(endIdx, existingEnd);
        });

        if (!hasOverlap) {
          tracks[trackIdx].push(event);
          eventToTrack.set(instanceId, trackIdx);
          break;
        }
        trackIdx++;
      }
    });

    // Calculate hidden events count per day
    const hiddenCounts = Array(daysCount).fill(0);
    days.forEach((day, dayIdx) => {
      const dayEvents = expanded.filter(e => isEventOnDay(e, day));
      dayEvents.forEach(e => {
        const trackIdx = eventToTrack.get(e.id + '_' + e.start);
        if (trackIdx !== undefined && trackIdx >= 4) {
          hiddenCounts[dayIdx]++;
        }
      });
    });

    return (
      <div className="bg-white dark:bg-brand-900 rounded-3xl border border-slate-200 dark:border-brand-800 overflow-hidden shadow-sm flex flex-col animate-in fade-in duration-200">
        {/* Day header row */}
        <div className="grid border-b border-slate-100 dark:border-brand-850 text-center py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500"
          style={{ gridTemplateColumns: `repeat(${daysCount}, minmax(0, 1fr))` }}
        >
          {days.map(day => (
            <div key={day.toString()} className="flex flex-col items-center">
              <span>{format(day, 'E')}</span>
            </div>
          ))}
        </div>

        {/* Days Grid Content */}
        <div className="relative min-h-[220px] flex flex-col">
          {/* Background grid */}
          <div className="absolute inset-0 grid border-t border-l border-slate-200 dark:border-brand-800" style={{ gridTemplateColumns: `repeat(${daysCount}, minmax(0, 1fr))` }}>
            {days.map((day) => {
              return (
                <div
                  key={day.toString()}
                  onClick={() => {
                    setSelectedDate(day);
                    setShowDayDetailModal(true);
                  }}
                  onDoubleClick={() => openCreateModal(day)}
                  onDragOver={(evt) => evt.preventDefault()}
                  onDrop={(evt) => {
                    evt.preventDefault();
                    const eventId = evt.dataTransfer.getData('text/plain');
                    if (eventId && onEventDrop) {
                      onEventDrop(eventId, day);
                    }
                  }}
                  className={`flex border-r border-b border-slate-200 dark:border-brand-800 p-1.5 md:p-2.5 min-h-[120px] hover:bg-slate-50/50 dark:hover:bg-brand-850/10 cursor-pointer flex-col transition-colors bg-white dark:bg-brand-900 ${
                    isToday(day) ? 'bg-indigo-50/20 dark:bg-indigo-950/10' : ''
                  } ${
                    isSameDay(day, selectedDate)
                      ? 'ring-2 ring-inset ring-indigo-500/40 bg-indigo-50/10 dark:bg-indigo-950/10'
                      : ''
                  }`}
                >
                  <div className="flex justify-start mb-1.5">
                    <span className={`text-[10px] md:text-[11px] font-black rounded-full w-5 h-5 md:w-6 md:h-6 flex items-center justify-center transition-all ${
                      isToday(day) 
                        ? 'bg-indigo-650 text-white shadow-sm font-extrabold scale-105' 
                        : isSameDay(day, selectedDate)
                        ? 'text-indigo-650 dark:text-indigo-400 font-black'
                        : 'text-slate-650 dark:text-slate-350'
                    }`}>
                      {format(day, 'd')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Foreground Events grid overlay (responsive spacing/grid) */}
          <div className="grid absolute inset-0 pt-7 md:pt-9 pb-1 gap-y-0.5 md:gap-y-1.5 px-0.5 md:px-1.5 pointer-events-none w-full h-full"
            style={{ gridTemplateColumns: `repeat(${daysCount}, minmax(0, 1fr))` }}
          >
            {sortedEvents.map(e => {
              const trackIdx = eventToTrack.get(e.id + '_' + e.start);
              if (trackIdx === undefined || trackIdx >= 4) return null;

              const eventDays = days.map((day, idx) => ({ day, idx })).filter(({ day }) => isEventOnDay(e, day));
              if (eventDays.length === 0) return null;
              const startIdx = eventDays[0].idx;
              const endIdx = eventDays[eventDays.length - 1].idx;

              return (
                <div
                  key={e.id + '_' + e.start}
                  onClick={(evt) => {
                    evt.stopPropagation();
                    setSelectedDate(days[startIdx]);
                    openEditModal(e);
                  }}
                  draggable
                  onDragStart={(evt) => {
                    evt.stopPropagation();
                    evt.dataTransfer.setData('text/plain', e.id);
                  }}
                  className={`px-1.5 py-0 rounded-md text-[9px] sm:text-[10px] font-bold truncate transition-all hover:scale-[0.98] flex items-center justify-between gap-1 shadow-2xs cursor-grab active:cursor-grabbing hover:brightness-95 duration-150 pointer-events-auto h-4 sm:h-5 leading-none ${isEventPassed(e) ? 'opacity-40' : ''}`}
                  style={{ 
                    gridColumnStart: startIdx + 1,
                    gridColumnEnd: endIdx + 2,
                    gridRowStart: trackIdx + 1,
                    gridRowEnd: trackIdx + 2,
                    backgroundColor: getEventColors(e.color).bg,
                    color: getEventColors(e.color).text
                  }}
                  title={e.title}
                >
                  <div className="flex items-center gap-0.5 md:gap-1 min-w-0">
                    {e.recurring && e.recurring.frequency !== 'none' && <RefreshCw className="animate-spin-slow shrink-0 w-1.5 h-1.5 md:w-2 md:h-2" />}
                    <span className={isEventPassed(e) ? 'line-through' : ''}>{e.title}</span>
                  </div>
                  <span className="hidden sm:inline text-[8px] font-bold shrink-0 opacity-70">
                    {e.assignee === 'both' ? '👥' : e.creatorId === user?.uid ? 'Me' : 'Partner'}
                  </span>
                </div>
              );
            })}

            {/* Hidden counts block */}
            {hiddenCounts.map((count, dayIdx) => {
              if (count === 0) return null;
              return (
                <div
                  key={`hidden-${dayIdx}`}
                  onClick={(evt) => {
                    evt.stopPropagation();
                    setSelectedDate(days[dayIdx]);
                    setShowDayDetailModal(true);
                  }}
                  className="px-2 py-0.5 rounded-md text-[9px] font-extrabold text-indigo-650 bg-indigo-50 dark:text-indigo-300 dark:bg-indigo-950/40 text-center border border-indigo-200/20 cursor-pointer pointer-events-auto"
                  style={{
                    gridColumnStart: dayIdx + 1,
                    gridRowStart: 5,
                    gridRowEnd: 6
                  }}
                >
                  + {count} more
                </div>
              );
            })}
          </div>

          {/* Grid line overlay — rendered on top of events so lines are always visible */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 10,
              display: 'grid',
              gridTemplateColumns: `repeat(${daysCount}, minmax(0, 1fr))`,
              borderTop: `1px solid ${isDarkMode ? '#262626' : '#e2e8f0'}`,
              borderLeft: `1px solid ${isDarkMode ? '#262626' : '#e2e8f0'}`
            }}
          >
            {days.map((_, i) => (
              <div
                key={i}
                style={{
                  borderRight: `1px solid ${isDarkMode ? '#262626' : '#e2e8f0'}`,
                  borderBottom: `1px solid ${isDarkMode ? '#262626' : '#e2e8f0'}`
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Hourly grid views (Day)
  const renderHourlyView = (daysCount: number) => {
    const startDay = selectedDate;
    const days = Array.from({ length: daysCount }).map((_, i) => addDays(startDay, i));
    const startRange = days[0];
    const endRange = days[days.length - 1];
    
    // Expand events in this range
    const expanded = getFilteredEvents(startRange, addDays(endRange, 1));
    const hours = Array.from({ length: 15 }).map((_, i) => i + 7); // 7am to 9pm

    // Track allocation for all-day events
    const allDayEvents = expanded.filter(e => e.allDay);
    const sortedAllDay = [...allDayEvents].sort((a, b) => {
      const aStart = parseISO(a.start);
      const aEnd = parseISO(a.end);
      const bStart = parseISO(b.start);
      const bEnd = parseISO(b.end);
      return (bEnd.getTime() - bStart.getTime()) - (aEnd.getTime() - aStart.getTime());
    });

    const allDayTracks: CalendarEvent[][] = [];
    const allDayEventToTrack = new Map<string, number>();
    sortedAllDay.forEach(event => {
      const eventDays = days.map((day, idx) => ({ day, idx })).filter(({ day }) => isEventOnDay(event, day));
      if (eventDays.length === 0) return;
      const startIdx = eventDays[0].idx;
      const endIdx = eventDays[eventDays.length - 1].idx;

      const instanceId = event.id + '_' + event.start;
      let trackIdx = 0;
      while (true) {
        if (!allDayTracks[trackIdx]) {
          allDayTracks[trackIdx] = [];
        }
        const hasOverlap = allDayTracks[trackIdx].some(existingEvent => {
          const existingDays = days.map((day, idx) => ({ day, idx })).filter(({ day }) => isEventOnDay(existingEvent, day));
          const existingStart = existingDays[0].idx;
          const existingEnd = existingDays[existingDays.length - 1].idx;
          return Math.max(startIdx, existingStart) <= Math.min(endIdx, existingEnd);
        });

        if (!hasOverlap) {
          allDayTracks[trackIdx].push(event);
          allDayEventToTrack.set(instanceId, trackIdx);
          break;
        }
        trackIdx++;
      }
    });

    return (
      <div className="bg-white dark:bg-brand-900 rounded-3xl border border-slate-200 dark:border-brand-800 overflow-hidden shadow-sm flex flex-col h-[650px] animate-in fade-in duration-200">
        
        {/* Calendar top columns */}
        <div className="grid border-b border-slate-200 dark:border-brand-800 bg-slate-50/50 dark:bg-brand-950/20 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 sticky top-0 z-10"
          style={{ gridTemplateColumns: `80px repeat(${daysCount}, minmax(0, 1fr))` }}
        >
          <div>Time</div>
          {days.map(d => (
            <div 
              key={d.toString()} 
              onClick={() => {
                setSelectedDate(d);
                setShowDayDetailModal(true);
              }}
              className={`cursor-pointer hover:underline ${isToday(d) ? 'text-indigo-650 dark:text-indigo-400 font-bold' : ''}`}
            >
              {format(d, 'E d')}
            </div>
          ))}
        </div>

        {/* All-Day Events row */}
        <div className="grid border-b border-slate-100 dark:border-brand-850 bg-slate-50/20 py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400"
          style={{ gridTemplateColumns: `80px 1fr` }}
        >
          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center justify-center border-r border-slate-100 dark:border-brand-850">
            All Day
          </div>
          
          <div className="relative flex-1">
            {/* Background day columns */}
            <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${daysCount}, minmax(0, 1fr))` }}>
              {days.map((d) => (
                <div key={d.toString()} className="border-r border-slate-100 dark:border-brand-850 last:border-r-0 h-full" />
              ))}
            </div>

            {/* Foreground Overlay Grid for continuous events */}
            <div className="relative grid p-1 gap-y-1 w-full h-full pointer-events-none" style={{ gridTemplateColumns: `repeat(${daysCount}, minmax(0, 1fr))` }}>
              {sortedAllDay.map(e => {
                const trackIdx = allDayEventToTrack.get(e.id + '_' + e.start);
                if (trackIdx === undefined) return null;
                
                const eventDays = days.map((day, idx) => ({ day, idx })).filter(({ day }) => isEventOnDay(e, day));
                if (eventDays.length === 0) return null;
                const startIdx = eventDays[0].idx;
                const endIdx = eventDays[eventDays.length - 1].idx;

                return (
                  <div
                    key={e.id + '_' + e.start}
                    onClick={(evt) => {
                      evt.stopPropagation();
                      openEditModal(e);
                    }}
                    className={`rounded-lg p-1.5 text-[10px] font-bold shadow-sm truncate hover:brightness-90 transition-all text-left cursor-pointer pointer-events-auto ${isEventPassed(e) ? 'opacity-40' : ''}`}
                    style={{
                      gridColumnStart: startIdx + 1,
                      gridColumnEnd: endIdx + 2,
                      gridRowStart: trackIdx + 1,
                      gridRowEnd: trackIdx + 2,
                      backgroundColor: e.color,
                      color: getEventColors(e.color).text
                    }}
                    title={e.title}
                  >
                    <span className={isEventPassed(e) ? 'line-through' : ''}>{e.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Calendar hourly scrollable area */}
        <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-slate-100 dark:divide-brand-850">
          {hours.map(h => {
            const timeStr = `${h.toString().padStart(2, '0')}:00`;
            return (
              <div 
                key={h}
                className="grid"
                style={{ 
                  gridTemplateColumns: `80px repeat(${daysCount}, minmax(0, 1fr))`,
                  minHeight: '60px'
                }}
              >
                {/* Time cell */}
                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold flex items-center justify-center border-r border-slate-100 dark:border-brand-850 bg-slate-50/10">
                  {format(new Date(`2000-01-01T${timeStr}`), 'h a')}
                </div>

                {/* Days cells for the current hour */}
                {days.map(d => {
                  const dayEvents = expanded.filter(e => {
                    const eventStart = parseISO(e.start);
                    return !e.allDay && isSameDay(eventStart, d) && eventStart.getHours() === h;
                  });

                  return (
                    <div
                      key={d.toString()}
                      onClick={() => openCreateModal(d, timeStr)}
                      className="border-r border-slate-100 dark:border-brand-850 p-1 relative hover:bg-slate-50/40 dark:hover:bg-brand-850/10 transition-colors cursor-pointer group"
                    >
                      {dayEvents.map(e => (
                        <div
                          key={e.id}
                          onClick={(evt) => {
                            evt.stopPropagation();
                            openEditModal(e);
                          }}
                          className={`absolute inset-1 rounded-xl p-1.5 text-xs font-extrabold shadow-sm overflow-hidden flex flex-col justify-between ${isEventPassed(e) ? 'opacity-40' : ''}`}
                          style={{ backgroundColor: e.color, color: getEventColors(e.color).text }}
                        >
                          <div className={`truncate leading-tight ${isEventPassed(e) ? 'line-through' : ''}`}>{e.title}</div>
                          <div className="flex items-center gap-1 text-[9px] opacity-90 mt-0.5">
                            <Clock size={10} />
                            <span>{e.duration}m</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}

              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (activeView === 'Month') return renderMonthView();
  if (activeView === '2-Week') return renderTwoWeekView();
  if (activeView === 'Day') return renderHourlyView(1);
  if (activeView === '4-Day') return renderDayBlocksView(7);
  return null;
};

export const CalendarGrid = React.memo(CalendarGridComponent);
CalendarGrid.displayName = 'CalendarGrid';


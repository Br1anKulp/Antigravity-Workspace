import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sun, 
  Sunset, 
  Calendar, 
  CheckSquare, 
  ShoppingCart, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  ArrowRight
} from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { useAuthStore } from '../../store/authStore';
import { useCalendarStore } from '../../store/calendarStore';
import type { CalendarEvent } from '../../store/calendarStore';
import { useTasksStore } from '../../store/tasksStore';
import { useListsStore } from '../../store/listsStore';
import { useMilestonesStore, calculateCountdown } from '../../store/milestonesStore';
import { MilestonesModal } from '../Milestones/MilestonesModal';
import { hapticLight, hapticSuccess } from '../../utils/haptics';

interface TodayBriefingProps {
  onOpenEventModal?: (event: CalendarEvent) => void;
  onNavigateTab?: (tab: string) => void;
}

export const TodayBriefing: React.FC<TodayBriefingProps> = ({ 
  onOpenEventModal,
  onNavigateTab 
}) => {
  const { user } = useAuthStore();
  const { getExpandedEvents } = useCalendarStore();
  const { tasks, toggleComplete } = useTasksStore();
  const { items: groceryItems } = useListsStore();
  const { milestones } = useMilestonesStore();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('slate_briefing_collapsed') === 'true';
  });

  const [showMilestonesModal, setShowMilestonesModal] = useState(false);

  useEffect(() => {
    localStorage.setItem('slate_briefing_collapsed', collapsed ? 'true' : 'false');
  }, [collapsed]);

  const toggleCollapsed = () => {
    hapticLight();
    setCollapsed(prev => !prev);
  };

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => format(today, 'yyyy-MM-dd'), [today]);

  // Determine greeting based on current hour
  const currentHour = today.getHours();
  const greeting = useMemo(() => {
    if (currentHour < 12) return { text: 'Good morning', icon: Sun, color: 'text-amber-500' };
    if (currentHour < 17) return { text: 'Good afternoon', icon: Sun, color: 'text-amber-500' };
    return { text: 'Good evening', icon: Sunset, color: 'text-indigo-400' };
  }, [currentHour]);

  // Today's events
  const todayEvents = useMemo(() => {
    const dayStart = startOfDay(today);
    const dayEnd = endOfDay(today);
    const expanded = getExpandedEvents(dayStart, dayEnd);

    // Deduplicate identical events
    const seen = new Set<string>();
    const result: CalendarEvent[] = [];

    for (const e of expanded) {
      const key = `${e.title}_${e.start.slice(0, 10)}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(e);
      }
    }

    return result.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [getExpandedEvents, today]);

  // Tasks due today or overdue
  const pendingTodayTasks = useMemo(() => {
    return tasks.filter(t => {
      if (t.completed) return false;
      if (!t.dueDate) return false;
      const due = t.dueDate.slice(0, 10);
      return due <= todayStr;
    }).slice(0, 4); // Max 4 for compact briefing
  }, [tasks, todayStr]);

  // Pending grocery items
  const pendingGroceries = useMemo(() => {
    return groceryItems.filter(i => !i.completed);
  }, [groceryItems]);

  // Pinned milestone (Retirement by default or top pinned)
  const pinnedMilestone = useMemo(() => {
    const pinned = milestones.filter(m => m.pinned);
    if (pinned.length > 0) return pinned[0];
    return milestones[0] || null;
  }, [milestones]);

  const countdown = useMemo(() => {
    return pinnedMilestone ? calculateCountdown(pinnedMilestone.targetDate, today) : null;
  }, [pinnedMilestone, today]);

  const handleTaskToggle = async (taskId: string) => {
    hapticSuccess();
    await toggleComplete(taskId);
  };

  return (
    <>
      <div className="w-full bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-slate-50/70 dark:from-brand-900/80 dark:via-brand-900/50 dark:to-brand-950/80 rounded-3xl border border-indigo-100/80 dark:border-brand-800/80 p-3 sm:p-4 shadow-2xs backdrop-blur-xs transition-all duration-300">
        
        {/* Header / Summary Ticker Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-1.5 rounded-xl bg-white dark:bg-brand-850 shadow-2xs shrink-0 ${greeting.color}`}>
              <greeting.icon size={18} />
            </div>
            
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-white truncate">
                  {greeting.text}, {user?.name || 'Brian'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 dark:bg-brand-800 text-slate-500 dark:text-slate-300 shadow-2xs">
                  {format(today, 'EEEE, MMM d')}
                </span>
              </div>

              {/* Ticker subtitle when collapsed */}
              {collapsed && (
                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                  {pinnedMilestone && countdown && (
                    <span 
                      onClick={() => setShowMilestonesModal(true)}
                      className="cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 font-bold flex items-center gap-1"
                    >
                      {pinnedMilestone.emoji} {countdown.days}d to {pinnedMilestone.title}
                    </span>
                  )}
                  <span>•</span>
                  <span>{todayEvents.length} event{todayEvents.length === 1 ? '' : 's'}</span>
                  {pendingTodayTasks.length > 0 && (
                    <>
                      <span>•</span>
                      <span>{pendingTodayTasks.length} task{pendingTodayTasks.length === 1 ? '' : 's'}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {pinnedMilestone && countdown && !collapsed && (
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setShowMilestonesModal(true);
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-black transition-all cursor-pointer"
                title="View shared countdowns & milestones"
              >
                <span>{pinnedMilestone.emoji}</span>
                <span>{pinnedMilestone.title}:</span>
                <span className="underline decoration-emerald-500/50">{countdown.days} days</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleCollapsed}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-white dark:hover:bg-brand-800 transition-colors cursor-pointer"
              aria-label={collapsed ? 'Expand briefing' : 'Collapse briefing'}
            >
              {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </button>
          </div>
        </div>

        {/* Expanded Content Panels */}
        {!collapsed && (
          <div className="mt-3.5 pt-3 border-t border-indigo-100/60 dark:border-brand-800/60 grid grid-cols-1 md:grid-cols-3 gap-3">
            
            {/* 1. Today's Agenda */}
            <div className="p-3 rounded-2xl bg-white/80 dark:bg-brand-900/70 border border-slate-200/60 dark:border-brand-850 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Calendar size={12} className="text-indigo-500" /> Today's Schedule
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 dark:bg-brand-800 dark:text-indigo-400">
                    {todayEvents.length}
                  </span>
                </div>

                {todayEvents.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
                    No scheduled events today. Enjoy the open day!
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto no-scrollbar">
                    {todayEvents.map(e => {
                      const startTime = e.allDay ? 'All Day' : format(parseISO(e.start), 'h:mm a');
                      const isBrian = e.assignee === 'self' || e.creatorName?.toLowerCase().includes('brian');
                      const isChelsea = e.assignee === 'partner' || e.creatorName?.toLowerCase().includes('chelsea');
                      
                      return (
                        <div
                          key={e.id}
                          onClick={() => onOpenEventModal?.(e)}
                          className="flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-brand-800/60 transition-colors cursor-pointer text-xs"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span 
                              className="w-2 h-2 rounded-full shrink-0" 
                              style={{ backgroundColor: e.color || '#6366f1' }} 
                            />
                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                              {e.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 text-[10px] font-semibold text-slate-400">
                            <span>{startTime}</span>
                            <span>{isBrian ? '⚡' : isChelsea ? '🌸' : '👥'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 2. Tasks Due Today */}
            <div className="p-3 rounded-2xl bg-white/80 dark:bg-brand-900/70 border border-slate-200/60 dark:border-brand-850 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <CheckSquare size={12} className="text-emerald-500" /> Focus Tasks
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 dark:bg-brand-800 dark:text-emerald-400">
                    {pendingTodayTasks.length}
                  </span>
                </div>

                {pendingTodayTasks.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
                    All caught up! No urgent tasks due today.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto no-scrollbar">
                    {pendingTodayTasks.map(t => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-brand-800/60 transition-colors text-xs"
                      >
                        <label className="flex items-center gap-2 min-w-0 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={t.completed}
                            onChange={() => handleTaskToggle(t.id)}
                            className="rounded text-emerald-600 focus:ring-emerald-500/20 shrink-0"
                          />
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                            {t.title}
                          </span>
                        </label>
                        {t.priority === 'urgent' && (
                          <span className="text-[9px] font-black uppercase px-1 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400">
                            Urgent
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Retirement & Shared Milestones Card */}
            <div className="p-3 rounded-2xl bg-gradient-to-br from-white/90 to-emerald-50/40 dark:from-brand-900/80 dark:to-emerald-950/20 border border-emerald-500/20 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Sparkles size={12} /> Milestone Ticker
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setShowMilestonesModal(true);
                    }}
                    className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    View All
                  </button>
                </div>

                {pinnedMilestone && countdown ? (
                  <div 
                    onClick={() => {
                      hapticLight();
                      setShowMilestonesModal(true);
                    }}
                    className="cursor-pointer group py-1"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl group-hover:scale-110 transition-transform">
                        {pinnedMilestone.emoji}
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                          {pinnedMilestone.title}
                        </h4>
                        <p className="text-[10px] font-semibold text-slate-400">
                          March 1, 2029
                        </p>
                      </div>
                    </div>

                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                        {countdown.days}
                      </span>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        days left ({countdown.weeks} weeks)
                      </span>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowMilestonesModal(true)}
                    className="w-full text-center py-4 text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
                  >
                    Set a retirement or countdown goal
                  </button>
                )}
              </div>

              {/* Quick Grocery List Footer Chip */}
              {pendingGroceries.length > 0 && (
                <div 
                  onClick={() => onNavigateTab?.('lists')}
                  className="mt-2 pt-2 border-t border-emerald-500/10 flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 cursor-pointer"
                >
                  <span className="flex items-center gap-1">
                    <ShoppingCart size={11} className="text-indigo-500" />
                    {pendingGroceries.length} grocery item{pendingGroceries.length === 1 ? '' : 's'} to get
                  </span>
                  <ArrowRight size={11} />
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* Shared Milestones Modal */}
      <MilestonesModal
        isOpen={showMilestonesModal}
        onClose={() => setShowMilestonesModal(false)}
      />
    </>
  );
};

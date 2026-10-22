import React from 'react';
import { 
  type MilestoneItem, 
  calculateCountdown, 
  useMilestonesStore 
} from '../../store/milestonesStore';
import { Pin, Trash2, Calendar, Sparkles } from 'lucide-react';
import { hapticLight } from '../../utils/haptics';

interface MilestoneCountdownCardProps {
  milestone: MilestoneItem;
  onEdit?: (milestone: MilestoneItem) => void;
  compact?: boolean;
}

export const MilestoneCountdownCard: React.FC<MilestoneCountdownCardProps> = ({
  milestone,
  onEdit,
  compact = false
}) => {
  const { togglePinMilestone, deleteMilestone } = useMilestonesStore();
  const countdown = calculateCountdown(milestone.targetDate);

  const formattedDate = React.useMemo(() => {
    try {
      const [year, month, day] = milestone.targetDate.split('T')[0].split('-').map(Number);
      const d = new Date(year, (month || 1) - 1, day || 1);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return milestone.targetDate;
    }
  }, [milestone.targetDate]);

  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    hapticLight();
    togglePinMilestone(milestone.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete milestone "${milestone.title}"?`)) {
      hapticLight();
      deleteMilestone(milestone.id);
    }
  };

  if (compact) {
    return (
      <div 
        onClick={() => onEdit?.(milestone)}
        className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/70 dark:bg-brand-900/60 border border-slate-200/80 dark:border-brand-800 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xl shrink-0 p-1.5 rounded-xl bg-slate-100 dark:bg-brand-850">
            {milestone.emoji || '🎯'}
          </span>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
              {milestone.title}
            </h4>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate">
              {formattedDate}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
              {countdown.isToday ? 'Today! 🎉' : `${countdown.days}d`}
            </span>
            <span className="block text-[9px] font-bold text-slate-400">
              {countdown.weeks}w
            </span>
          </div>
          {milestone.pinned && (
            <Pin size={12} className="text-amber-500 fill-amber-500 shrink-0" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`relative overflow-hidden rounded-3xl p-4 sm:p-5 border transition-all duration-300 ${
        milestone.pinned
          ? 'bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border-emerald-500/30 dark:border-emerald-500/20 shadow-xs'
          : 'bg-white dark:bg-brand-900 border-slate-200/80 dark:border-brand-800/80 shadow-2xs'
      }`}
    >
      {/* Top Banner Row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xl sm:text-3xl p-2 rounded-2xl bg-slate-100 dark:bg-brand-850 shrink-0 shadow-2xs">
            {milestone.emoji || '🎯'}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                {milestone.title}
              </h3>
              {milestone.category === 'retirement' && (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <Sparkles size={10} /> Milestone
                </span>
              )}
            </div>
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
              <Calendar size={11} /> {formattedDate}
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleTogglePin}
            title={milestone.pinned ? 'Unpin milestone' : 'Pin milestone'}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              milestone.pinned
                ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-brand-800'
            }`}
          >
            <Pin size={15} className={milestone.pinned ? 'fill-amber-500' : ''} />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            title="Delete milestone"
            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {milestone.description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">
          {milestone.description}
        </p>
      )}

      {/* Countdown Digits Grid */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-brand-850">
        <div className="text-center p-2 rounded-2xl bg-slate-50 dark:bg-brand-950/60 border border-slate-100 dark:border-brand-850">
          <span className="block text-lg sm:text-xl font-black text-slate-900 dark:text-white">
            {countdown.isToday ? '🎉' : countdown.days}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Days
          </span>
        </div>

        <div className="text-center p-2 rounded-2xl bg-slate-50 dark:bg-brand-950/60 border border-slate-100 dark:border-brand-850">
          <span className="block text-lg sm:text-xl font-black text-slate-900 dark:text-white">
            {countdown.weeks}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Weeks
          </span>
        </div>

        <div className="text-center p-2 rounded-2xl bg-slate-50 dark:bg-brand-950/60 border border-slate-100 dark:border-brand-850">
          <span className="block text-lg sm:text-xl font-black text-slate-900 dark:text-white">
            {countdown.months}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Months
          </span>
        </div>
      </div>
    </div>
  );
};

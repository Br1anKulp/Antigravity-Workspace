import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Pin, Sparkles, Target } from 'lucide-react';
import { useMilestonesStore } from '../../store/milestonesStore';
import type { MilestoneItem } from '../../store/milestonesStore';
import { MilestoneCountdownCard } from './MilestoneCountdownCard';
import { useModalBackHandler } from '../../utils/modalHistory';
import { hapticLight, hapticSuccess } from '../../utils/haptics';

interface MilestonesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMOJI_OPTIONS = ['🏝️', '🎂', '💍', '✈️', '🎓', '🏡', '👶', '🚗', '🥂', '🎯', '🚀', '⭐'];

export const MilestonesModal: React.FC<MilestonesModalProps> = ({ isOpen, onClose }) => {
  const { milestones, addMilestone } = useMilestonesStore();
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [emoji, setEmoji] = useState('🎯');
  const [color, setColor] = useState('#10b981');
  const [pinned, setPinned] = useState(false);
  const [category, setCategory] = useState<MilestoneItem['category']>('goal');

  // Intercept Android Back button/gesture to dismiss cleanly
  useModalBackHandler(isOpen, onClose, 'milestones-modal');

  if (!isOpen) return null;

  const handleResetForm = () => {
    setTitle('');
    setDescription('');
    setTargetDate('');
    setEmoji('🎯');
    setColor('#10b981');
    setPinned(false);
    setCategory('goal');
    setIsCreating(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !targetDate) return;

    await addMilestone({
      title: title.trim(),
      description: description.trim() || undefined,
      targetDate,
      emoji,
      color,
      pinned,
      category
    });

    hapticSuccess();
    handleResetForm();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg max-h-[90vh] bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-brand-850 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-2xs">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Milestones & Countdowns
              </h2>
              <p className="text-[11px] font-semibold text-slate-400">
                Shared life goals, anniversaries & celebrations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {!isCreating && (
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setIsCreating(true);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                <Plus size={14} /> New
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                hapticLight();
                onClose();
              }}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-brand-800 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {isCreating ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-brand-850">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Create Milestone
                </h3>
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hawaii Vacation, 10th Anniversary..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                    Target Date
                  </label>
                  <input
                    type="date"
                    required
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="goal">Goal</option>
                    <option value="retirement">Retirement</option>
                    <option value="anniversary">Anniversary</option>
                    <option value="vacation">Vacation</option>
                    <option value="birthday">Birthday</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Emoji Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                  Emoji Icon
                </label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEmoji(e)}
                      className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all cursor-pointer ${
                        emoji === e
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 scale-105'
                          : 'bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 hover:bg-slate-100'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pin to Dashboard Toggle */}
              <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-brand-950/60 border border-slate-200/80 dark:border-brand-850 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Pin size={15} className={pinned ? 'text-amber-500 fill-amber-500' : 'text-slate-400'} />
                  <div>
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                      Pin to Dashboard
                    </span>
                    <span className="block text-[10px] text-slate-400">
                      Feature countdown directly in Morning Briefing
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500/20"
                />
              </label>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-black transition-all shadow-sm cursor-pointer"
              >
                Save Milestone
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              {milestones.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Target size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-bold">No milestones yet</p>
                  <p className="text-[11px] text-slate-500">Tap "New" to create your first shared countdown.</p>
                </div>
              ) : (
                milestones.map((m) => (
                  <MilestoneCountdownCard key={m.id} milestone={m} />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

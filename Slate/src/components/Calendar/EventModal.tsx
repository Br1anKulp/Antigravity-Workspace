import React, { useState, useMemo } from 'react';
import { format, parseISO, addWeeks, endOfDay } from 'date-fns';
import { Trash2 } from 'lucide-react';
import type { CalendarEvent } from '../../store/calendarStore';
import { useModalBackHandler } from '../../utils/modalHistory';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEvent: CalendarEvent | null;
  selectedDate: Date;
  defaultColor?: string;
  onSave: (data: Partial<CalendarEvent>) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  selectedEvent,
  selectedDate,
  defaultColor = '#3b82f6',
  onSave,
  onDelete
}) => {
  const startObj = selectedEvent ? parseISO(selectedEvent.start) : selectedDate;
  const endObj = selectedEvent ? parseISO(selectedEvent.end) : selectedDate;

  // Form Fields State
  const [title, setTitle] = useState(selectedEvent ? selectedEvent.title : '');
  const [allDay, setAllDay] = useState(selectedEvent ? !!selectedEvent.allDay : false);
  const [startDateStr, setStartDateStr] = useState(format(startObj, 'yyyy-MM-dd'));
  const [endDateStr, setEndDateStr] = useState(format(endObj, 'yyyy-MM-dd'));
  const [startTimeStr, setStartTimeStr] = useState(selectedEvent ? format(startObj, 'HH:mm') : '09:00');
  const [endTimeStr, setEndTimeStr] = useState(selectedEvent ? format(endObj, 'HH:mm') : '10:00');
  const [color, setColor] = useState(selectedEvent ? selectedEvent.color : defaultColor);
  const [assignee, setAssignee] = useState<'self' | 'partner' | 'both'>(selectedEvent ? selectedEvent.assignee : 'both');
  const [notes, setNotes] = useState(selectedEvent?.notes || '');
  const [recFreq, setRecFreq] = useState<'none' | 'daily' | 'weekly' | 'monthly'>(selectedEvent?.recurring?.frequency || 'none');
  const [recInterval, setRecInterval] = useState(selectedEvent?.recurring?.interval || 1);

  // Recurrence End Options
  const initialEndType = selectedEvent?.recurring?.endType
    ? selectedEvent.recurring.endType
    : selectedEvent?.recurring?.until
    ? 'date'
    : 'never';
  const [recEndType, setRecEndType] = useState<'never' | 'date' | 'weeks'>(initialEndType);
  const [recEndWeeks, setRecEndWeeks] = useState<number>(selectedEvent?.recurring?.endWeeks || 4);
  const [recEndDate, setRecEndDate] = useState<string>(
    selectedEvent?.recurring?.until
      ? format(parseISO(selectedEvent.recurring.until), 'yyyy-MM-dd')
      : format(addWeeks(startObj, 4), 'yyyy-MM-dd')
  );

  // Intercept Android hardware Back button / gesture when modal is open
  useModalBackHandler(isOpen, onClose, 'event-modal');

  // Dynamic preview date when ending after number of weeks
  const computedWeeksEndDate = useMemo(() => {
    try {
      const baseDate = parseISO(startDateStr);
      if (isNaN(baseDate.getTime())) return null;
      const targetDate = addWeeks(baseDate, Math.max(1, recEndWeeks));
      return format(targetDate, 'EEE, MMM d, yyyy');
    } catch {
      return null;
    }
  }, [startDateStr, recEndWeeks]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const startISO = allDay
      ? new Date(`${startDateStr}T00:00:00`).toISOString()
      : new Date(`${startDateStr}T${startTimeStr}:00`).toISOString();
    const endISO = allDay
      ? new Date(`${endDateStr}T23:59:59.999`).toISOString()
      : new Date(`${endDateStr}T${endTimeStr}:00`).toISOString();

    const startMs = new Date(startISO).getTime();
    const endMs = new Date(endISO).getTime();
    const computedDuration = Math.max(0, Math.round((endMs - startMs) / (1000 * 60)));

    let computedUntil: string | undefined = undefined;
    if (recFreq !== 'none') {
      if (recEndType === 'date' && recEndDate) {
        computedUntil = endOfDay(parseISO(recEndDate)).toISOString();
      } else if (recEndType === 'weeks') {
        const weeksCount = Math.max(1, recEndWeeks);
        const baseDate = parseISO(startDateStr);
        computedUntil = endOfDay(addWeeks(baseDate, weeksCount)).toISOString();
      }
    }

    onSave({
      title,
      start: startISO,
      end: endISO,
      duration: computedDuration,
      allDay,
      color,
      assignee,
      notes,
      recurring: recFreq !== 'none' ? {
        frequency: recFreq,
        interval: recInterval,
        endType: recEndType,
        endWeeks: recEndType === 'weeks' ? recEndWeeks : undefined,
        until: computedUntil
      } : { frequency: 'none', interval: 1 }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-3xl p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto no-scrollbar">
        <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 text-slate-800 dark:text-slate-100">
          {selectedEvent ? '✏️ Edit Calendar Event' : '📅 Add Calendar Event'}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-450 mb-1">Title</label>
            <input
              type="text"
              required
              placeholder="Event name"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-sm focus:outline-none text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              id="allDay"
              checked={allDay}
              onChange={e => setAllDay(e.target.checked)}
              className="rounded text-indigo-650 focus:ring-indigo-500/20 cursor-pointer"
            />
            <label htmlFor="allDay" className="text-xs font-bold text-slate-600 dark:text-slate-350 cursor-pointer select-none">
              All Day Event
            </label>
          </div>

          {/* Start Date / End Date / Time Pickers */}
          {allDay ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-450 mb-1">Start Date</label>
                <input
                  type="date"
                  required
                  value={startDateStr}
                  onChange={e => {
                    setStartDateStr(e.target.value);
                    if (!endDateStr || e.target.value > endDateStr) {
                      setEndDateStr(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-xs focus:outline-none text-slate-900 dark:text-slate-100 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-450 mb-1">End Date</label>
                <input
                  type="date"
                  required
                  value={endDateStr}
                  min={startDateStr}
                  onChange={e => setEndDateStr(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-xs focus:outline-none text-slate-900 dark:text-slate-100 cursor-pointer"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-450 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDateStr}
                    onChange={e => {
                      setStartDateStr(e.target.value);
                      if (!endDateStr || e.target.value > endDateStr) {
                        setEndDateStr(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-xs focus:outline-none text-slate-900 dark:text-slate-100 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-450 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={startTimeStr}
                    onChange={e => setStartTimeStr(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-xs focus:outline-none text-slate-900 dark:text-slate-100 cursor-pointer"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-450 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={endDateStr}
                    min={startDateStr}
                    onChange={e => setEndDateStr(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-xs focus:outline-none text-slate-900 dark:text-slate-100 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-450 mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={endTimeStr}
                    onChange={e => setEndTimeStr(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-xs focus:outline-none text-slate-900 dark:text-slate-100 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Assignee / Colors */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-450 mb-1">Assign To</label>
              <select
                value={assignee}
                onChange={e => setAssignee(e.target.value as 'self' | 'partner' | 'both')}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-xs focus:outline-none text-slate-900 dark:text-slate-100 cursor-pointer"
              >
                <option value="both">Both of Us</option>
                <option value="self">Me Only</option>
                <option value="partner">Partner Only</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-450 mb-1">Color Theme</label>
              <div className="flex gap-2 items-center h-9">
                {['#3b82f6', '#ec4899', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#64748b'].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-5.5 h-5.5 rounded-full border-2 transition-all cursor-pointer ${
                      color === c ? 'border-slate-800 dark:border-white scale-110 shadow-sm' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  ></button>
                ))}
              </div>
            </div>
          </div>

          {/* Recurrence Setup */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="recFreq" className="block text-xs font-semibold text-slate-400 mb-1">Recurring Event</label>
                <select
                  id="recFreq"
                  value={recFreq}
                  onChange={e => setRecFreq(e.target.value as 'none' | 'daily' | 'weekly' | 'monthly')}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-xs focus:outline-none text-slate-900 dark:text-slate-100 cursor-pointer"
                >
                  <option value="none">No Recurrence</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              {recFreq !== 'none' && (
                <div>
                  <label htmlFor="recInterval" className="block text-xs font-semibold text-slate-400 mb-1">Every (Interval)</label>
                  <input
                    id="recInterval"
                    type="number"
                    min={1}
                    value={recInterval}
                    onChange={e => setRecInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-xs focus:outline-none text-slate-900 dark:text-slate-100"
                  />
                </div>
              )}
            </div>

            {/* Recurrence End Options */}
            {recFreq !== 'none' && (
              <div className="p-3 bg-slate-50/80 dark:bg-brand-950/60 border border-slate-200/80 dark:border-brand-800/80 rounded-2xl space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="recEndType" className="block text-xs font-semibold text-slate-400 mb-1">Ends</label>
                    <select
                      id="recEndType"
                      value={recEndType}
                      onChange={e => setRecEndType(e.target.value as 'never' | 'date' | 'weeks')}
                      className="w-full px-3 py-2 bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-xl text-xs focus:outline-none text-slate-900 dark:text-slate-100 cursor-pointer"
                    >
                      <option value="never">Never (Ongoing)</option>
                      <option value="date">On Specific Date</option>
                      <option value="weeks">After Number of Weeks</option>
                    </select>
                  </div>

                  {recEndType === 'date' && (
                    <div>
                      <label htmlFor="recEndDate" className="block text-xs font-semibold text-slate-400 mb-1">End Date</label>
                      <input
                        id="recEndDate"
                        type="date"
                        min={startDateStr}
                        value={recEndDate}
                        onChange={e => setRecEndDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-xl text-xs focus:outline-none text-slate-900 dark:text-slate-100 cursor-pointer"
                      />
                    </div>
                  )}

                  {recEndType === 'weeks' && (
                    <div>
                      <label htmlFor="recEndWeeks" className="block text-xs font-semibold text-slate-400 mb-1">Number of Weeks</label>
                      <input
                        id="recEndWeeks"
                        type="number"
                        min={1}
                        max={104}
                        value={recEndWeeks}
                        onChange={e => setRecEndWeeks(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-full px-3 py-2 bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-xl text-xs focus:outline-none text-slate-900 dark:text-slate-100"
                      />
                      {computedWeeksEndDate && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-1">
                          Repeats until <span className="font-bold text-indigo-600 dark:text-indigo-400">{computedWeeksEndDate}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Notes</label>
            <textarea
              rows={2}
              placeholder="Extra details..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-sm focus:outline-none text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20"
            ></textarea>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-2">
            {selectedEvent ? (
              <button
                type="button"
                onClick={onDelete}
                className="flex items-center gap-1.5 px-3 py-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <Trash2 size={14} /> Delete
              </button>
            ) : (
              <div></div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-brand-850 rounded-xl text-xs font-bold border border-slate-200 dark:border-brand-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-slate-100 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};

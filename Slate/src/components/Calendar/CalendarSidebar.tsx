import React, { useState } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday 
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

interface CalendarSidebarProps {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  openCreateModal: (date: Date) => void;
}

export const CalendarSidebar: React.FC<CalendarSidebarProps> = ({
  selectedDate,
  setSelectedDate,
  openCreateModal
}) => {
  const [pickerDate, setPickerDate] = useState<Date>(selectedDate);

  const monthStart = startOfMonth(pickerDate);
  const monthEnd = endOfMonth(pickerDate);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="w-full lg:w-64 flex flex-col gap-6 shrink-0">
      {/* Primary Action Button */}
      <button
        onClick={() => openCreateModal(selectedDate)}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-2xl font-extrabold text-xs shadow-sm transition-all cursor-pointer"
      >
        <Plus size={16} />
        <span>Create Event</span>
      </button>

      {/* Mini Calendar Picker Card */}
      <div className="bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-2xl p-4 shadow-2xs">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
            {format(pickerDate, 'MMMM yyyy')}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setPickerDate(subMonths(pickerDate, 1))}
              className="p-1 hover:bg-slate-100 dark:hover:bg-brand-850 rounded-lg text-slate-500 cursor-pointer"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setPickerDate(addMonths(pickerDate, 1))}
              className="p-1 hover:bg-slate-100 dark:hover:bg-brand-850 rounded-lg text-slate-500 cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Day Header */}
        <div className="grid grid-cols-7 text-center mb-1 text-[10px] font-bold text-slate-400">
          {dayLabels.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-y-1 text-center">
          {days.map((day) => {
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, pickerDate);
            const isDayToday = isToday(day);

            return (
              <button
                key={day.toString()}
                onClick={() => {
                  setSelectedDate(day);
                  setPickerDate(day);
                }}
                className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center text-[11px] font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs scale-105'
                    : isDayToday
                    ? 'bg-indigo-50 text-indigo-650 dark:bg-indigo-950/50 dark:text-indigo-400'
                    : isCurrentMonth
                    ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-brand-850'
                    : 'text-slate-300 dark:text-slate-700'
                }`}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

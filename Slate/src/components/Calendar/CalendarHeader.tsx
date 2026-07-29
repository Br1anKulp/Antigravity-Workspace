import React, { useState } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

interface CalendarHeaderProps {
  selectedDate: Date;
  handlePrev: () => void;
  handleNext: () => void;
  handleToday: () => void;
  openCreateModal: (date: Date) => void;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  selectedDate,
  handlePrev,
  handleNext,
  handleToday,
  openCreateModal
}) => {
  const partner = useAuthStore(state => state.partner);
  const [isPartnerActive, setIsPartnerActive] = useState(false);

  React.useEffect(() => {
    const checkActive = () => {
      if (!partner || !partner.lastActive) {
        setIsPartnerActive(false);
        return;
      }
      const lastActiveDate = new Date(partner.lastActive);
      setIsPartnerActive(Date.now() - lastActiveDate.getTime() < 3 * 60 * 1000);
    };

    checkActive();
    const interval = setInterval(checkActive, 30 * 1000);
    return () => clearInterval(interval);
  }, [partner]);



  return (
    <div className="flex flex-col gap-4">
      {/* Top Main Navigation Bar */}
      <div className="bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 transition-colors">
        
        {/* Date Title, Stepper, and Add Event Button Row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 w-full">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-100 dark:bg-brand-850 rounded-xl text-slate-700 dark:text-slate-200 shrink-0">
              <CalendarIcon size={18} />
            </div>
            <h1 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
              {format(selectedDate, 'MMMM')} <span className="font-light text-slate-400 dark:text-slate-500">{format(selectedDate, 'yyyy')}</span>
              {partner && (
                <div 
                  className="relative w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] select-none cursor-help shadow-sm shrink-0"
                  style={{ backgroundColor: partner.avatarColor }}
                  title={`${partner.name} is ${isPartnerActive ? 'active' : 'inactive'}`}
                >
                  {partner.avatarEmoji || '👤'}
                  {isPartnerActive && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border-2 border-white dark:border-brand-900 animate-pulse" />
                  )}
                </div>
              )}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Prev / Today / Next Stepper */}
            <div className="flex items-center border border-slate-200 dark:border-brand-800 rounded-xl overflow-hidden shadow-xs bg-slate-50/50 dark:bg-brand-950">
              <button 
                onClick={handlePrev} 
                aria-label="Previous Period"
                className="p-1.5 sm:p-2 hover:bg-slate-100 dark:hover:bg-brand-850 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={handleToday} 
                className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-brand-850 border-x border-slate-200 dark:border-brand-800 transition-colors cursor-pointer"
              >
                Today
              </button>
              <button 
                onClick={handleNext} 
                aria-label="Next Period"
                className="p-1.5 sm:p-2 hover:bg-slate-100 dark:hover:bg-brand-850 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Primary Action + Add Event Button right beside selector */}
            <button
              onClick={() => openCreateModal(selectedDate)}
              className="flex items-center gap-1 px-3 sm:px-4 py-1.5 sm:py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer shrink-0"
            >
              <Plus size={15} />
              <span>Event</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

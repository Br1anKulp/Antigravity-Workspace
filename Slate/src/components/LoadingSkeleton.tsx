import React from 'react';

interface BaseSkeletonProps {
  className?: string;
}

export const SkeletonText: React.FC<BaseSkeletonProps & { lines?: number }> = ({
  className = '',
  lines = 3
}) => {
  return (
    <div className={`space-y-2 animate-pulse ${className}`}>
      {Array.from({ length: lines }).map((_, idx) => (
        <div
          key={idx}
          className="h-3 bg-slate-200 dark:bg-brand-850 rounded-full"
          style={{ width: idx === lines - 1 && lines > 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
};

export const SkeletonCircle: React.FC<BaseSkeletonProps & { size?: number }> = ({
  className = '',
  size = 40
}) => {
  return (
    <div
      className={`bg-slate-200 dark:bg-brand-850 rounded-full animate-pulse ${className}`}
      style={{ width: size, height: size }}
    />
  );
};

export const SkeletonCard: React.FC<BaseSkeletonProps> = ({ className = '' }) => {
  return (
    <div className={`bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-3xl p-6 space-y-4 animate-pulse ${className}`}>
      <div className="flex items-center gap-3">
        <SkeletonCircle size={40} />
        <div className="space-y-1.5 flex-1">
          <div className="h-4 bg-slate-200 dark:bg-brand-850 rounded-full w-1/3" />
          <div className="h-3 bg-slate-200 dark:bg-brand-850 rounded-full w-1/4" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
};

export const SkeletonList: React.FC<BaseSkeletonProps & { rows?: number }> = ({
  className = '',
  rows = 4
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, idx) => (
        <div 
          key={idx} 
          className="flex items-center justify-between p-4 bg-white dark:bg-brand-900 border border-slate-100 dark:border-brand-850/60 rounded-2xl animate-pulse shadow-sm"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <SkeletonCircle size={18} className="shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3.5 bg-slate-200 dark:bg-brand-850 rounded-full w-2/5" />
              <div className="h-2.5 bg-slate-100 dark:bg-brand-850/50 rounded-full w-1/4" />
            </div>
          </div>
          <div className="h-5 bg-slate-100 dark:bg-brand-850 rounded-full w-12 shrink-0 ml-4" />
        </div>
      ))}
    </div>
  );
};

export const SkeletonCalendar: React.FC<BaseSkeletonProps> = ({ className = '' }) => {
  return (
    <div className={`space-y-4 bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-3xl p-6 shadow-sm animate-pulse ${className}`}>
      {/* Calendar Header Row */}
      <div className="grid grid-cols-7 gap-2 pb-4 border-b border-slate-100 dark:border-brand-850/40">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-3 bg-slate-200 dark:bg-brand-850 rounded-full w-1/2 mx-auto" />
        ))}
      </div>
      {/* 5 Weeks grid */}
      <div className="grid grid-cols-7 gap-2.5">
        {Array.from({ length: 35 }).map((_, i) => (
          <div 
            key={i} 
            className="aspect-[4/3] md:aspect-square bg-slate-50 dark:bg-brand-950/25 rounded-2xl p-2 border border-slate-100/40 dark:border-brand-850/20 flex flex-col justify-between"
          >
            <div className="h-4 bg-slate-200 dark:bg-brand-850 rounded-full w-4" />
            {i % 4 === 1 && (
              <div className="h-4 bg-indigo-100 dark:bg-indigo-950/30 border border-indigo-200/20 rounded-md w-full" />
            )}
            {i % 6 === 3 && (
              <div className="h-4 bg-pink-100 dark:bg-pink-950/30 border border-pink-200/20 rounded-md w-full" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export const SkeletonKanban: React.FC<BaseSkeletonProps> = ({ className = '' }) => {
  return (
    <div className={`flex gap-4 overflow-x-auto pb-4 items-start animate-pulse ${className}`}>
      {Array.from({ length: 3 }).map((_, colIdx) => (
        <div 
          key={colIdx} 
          className="w-[88vw] md:w-96 bg-slate-100/60 dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-3xl p-4.5 flex flex-col gap-4 shrink-0"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 bg-slate-200 dark:bg-brand-850 rounded-full w-1/3" />
            <div className="h-5 bg-slate-200 dark:bg-brand-850 rounded-full w-8" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: colIdx === 0 ? 2 : 1 }).map((_, cardIdx) => (
              <div 
                key={cardIdx} 
                className="bg-white dark:bg-brand-950 border border-slate-200 dark:border-brand-800 p-4.5 rounded-2xl flex flex-col gap-3 shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="h-3.5 bg-slate-200 dark:bg-brand-850 rounded-full w-2/3" />
                  <div className="h-3 bg-slate-150 dark:bg-brand-900 rounded-full w-10" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-2.5 bg-slate-100 dark:bg-brand-850/50 rounded-full w-full" />
                  <div className="h-2.5 bg-slate-100 dark:bg-brand-850/50 rounded-full w-5/6" />
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-50 dark:border-brand-900">
                  <div className="h-3 bg-slate-100 dark:bg-brand-850 rounded-full w-1/3" />
                  <SkeletonCircle size={16} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export const LoadingSkeleton: React.FC<BaseSkeletonProps & { type?: 'text' | 'card' | 'circle' | 'list' | 'calendar' | 'kanban'; rows?: number }> = ({
  className = '',
  type = 'card',
  rows
}) => {
  if (type === 'text') return <SkeletonText className={className} />;
  if (type === 'circle') return <SkeletonCircle className={className} />;
  if (type === 'list') return <SkeletonList className={className} rows={rows} />;
  if (type === 'calendar') return <SkeletonCalendar className={className} />;
  if (type === 'kanban') return <SkeletonKanban className={className} />;
  return <SkeletonCard className={className} />;
};

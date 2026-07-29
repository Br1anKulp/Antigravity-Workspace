import React from 'react';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = React.memo(({
  icon,
  title,
  description,
  action
}) => {
  return (
    <div className="bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-3xl p-12 text-center shadow-sm animate-in fade-in duration-300">
      <div className="w-16 h-16 bg-slate-50 dark:bg-brand-950 rounded-2xl flex items-center justify-center text-slate-400 mx-auto mb-4 border border-slate-150 dark:border-brand-850 shadow-inner">
        {icon}
      </div>
      <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200 mb-1.5">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-450 max-w-sm mx-auto leading-relaxed mb-6">
        {description}
      </p>
      {action && <div className="flex justify-center">{action}</div>}
    </div>
  );
});

EmptyState.displayName = 'EmptyState';

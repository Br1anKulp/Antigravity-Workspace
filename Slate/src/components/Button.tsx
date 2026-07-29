import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-bold transition-all duration-200 select-none active:scale-95 disabled:scale-100 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-slate-100 shadow-md hover:shadow-lg',
    secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-brand-800 dark:text-slate-100 dark:hover:bg-brand-700 shadow-sm',
    outline: 'border border-slate-200 text-slate-800 hover:bg-slate-50 dark:border-brand-800 dark:text-slate-200 dark:hover:bg-brand-900/50',
    danger: 'bg-rose-500 text-white hover:bg-rose-600 shadow-md shadow-rose-500/10 hover:shadow-rose-500/20',
    ghost: 'text-slate-650 hover:bg-slate-100/60 dark:text-slate-350 dark:hover:bg-brand-850/50'
  };

  const sizes = {
    sm: 'px-3 py-1.5 rounded-lg text-xs gap-1.5',
    md: 'px-4.5 py-2.5 rounded-xl text-sm gap-2',
    lg: 'px-6 py-3.5 rounded-2xl text-base gap-2.5'
  };

  const currentStyles = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`;

  return (
    <button
      disabled={disabled || loading}
      className={currentStyles}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      ) : (
        icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>
      )}
      
      {children}
      
      {!loading && icon && iconPosition === 'right' && (
        <span className="shrink-0">{icon}</span>
      )}
    </button>
  );
};

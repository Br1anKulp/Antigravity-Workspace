import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Mail, Lock, ShieldAlert, Sparkles } from 'lucide-react';
import { isMockMode } from '../firebase/config';

export const LoginView: React.FC = () => {
  const { signIn, signInWithGoogle, error, loading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const accessDenied = !!error && error.includes('Access Denied');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    await signIn(email, password, rememberMe);
  };

  const handleGoogleSignIn = async () => {
    await signInWithGoogle();
  };

  const handleQuickMockLogin = async (mockEmail: string) => {
    setEmail(mockEmail);
    setPassword('password123');
    await signIn(mockEmail, 'password123', true);
  };

  if (accessDenied && error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-brand-950 p-4">
        <div className="w-full max-w-md bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-3xl p-8 shadow-xl text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/30 rounded-2xl flex items-center justify-center text-rose-500 mx-auto mb-6 shadow-inner">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-2xl font-bold mb-2">Access Restricted</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 px-2">
            This Slate workspace is private and limited to two pre-authorized users. The email address you signed in with is not whitelisted.
          </p>
          
          <div className="bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-300 text-xs py-3 px-4 rounded-xl font-medium border border-rose-100 dark:border-rose-950 mb-6">
            {error}
          </div>

          <button
            onClick={() => {
              useAuthStore.setState({ error: null });
            }}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-brand-950 dark:hover:bg-slate-100 text-white font-semibold rounded-xl text-sm transition-all duration-200 shadow-md"
          >
            Try Another Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-brand-950 p-4">
      <div className="w-full max-w-md bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-3xl p-8 shadow-xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Subtle top brand decoration */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

        {/* Title details */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg">
            S
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            Welcome to Slate
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
            Private workspace for couples.
          </p>
        </div>

        {error && !error.includes('Access Denied') && (
          <div className="mb-6 p-4 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-sm rounded-xl border border-rose-100 dark:border-rose-950 font-medium text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
              <input
                type="email"
                id="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all"
              />
            </div>
          </div>

          {!isMockMode && (
            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                <input
                  type="password"
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between py-1 text-xs">
            <label className="flex items-center gap-2 text-slate-500 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-350 dark:border-brand-800 text-indigo-600 focus:ring-indigo-500/30"
              />
              Remember me
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-brand-950 dark:hover:bg-slate-100 text-white font-semibold rounded-xl text-sm transition-all duration-200 shadow-md flex items-center justify-center gap-2"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {!isMockMode && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-brand-800"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-brand-900 px-3 text-slate-400 dark:text-slate-500">Or continue with</span>
              </div>
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3.5 border border-slate-200 dark:border-brand-800 hover:bg-slate-50 dark:hover:bg-brand-850 font-semibold rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-3"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google Account
            </button>
          </>
        )}

        {isMockMode && (
          <div className="mt-8 border-t border-slate-100 dark:border-brand-800 pt-6">
            <div className="flex items-center gap-1.5 justify-center mb-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Sparkles size={14} className="text-indigo-500" />
              <span>Quick Mock Login Selection</span>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <button
                type="button"
                onClick={() => handleQuickMockLogin('brian.k.kulp@gmail.com')}
                className="py-2.5 px-3 bg-blue-50/50 hover:bg-blue-50 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 border border-blue-100 dark:border-blue-950 rounded-xl text-left transition-all"
              >
                <div className="font-bold text-blue-600 dark:text-blue-400 text-xs">⚡ Brian</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">brian.k.kulp@gmail...</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickMockLogin('familynflowers@protonmail.com')}
                className="py-2.5 px-3 bg-pink-50/50 hover:bg-pink-50 dark:bg-pink-950/20 dark:hover:bg-pink-950/40 border border-pink-100 dark:border-pink-950 rounded-xl text-left transition-all"
              >
                <div className="font-bold text-pink-600 dark:text-pink-400 text-xs">🌸 Flower</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">familynflowers@proto...</div>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

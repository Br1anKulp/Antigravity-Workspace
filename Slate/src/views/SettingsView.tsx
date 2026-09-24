
import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useCalendarStore } from '../store/calendarStore';
import { useTasksStore } from '../store/tasksStore';
import { useNotesStore } from '../store/notesStore';
import { 
  User, 
  Bell, 
  Download, 
  Info, 
  Heart, 
  Check, 
  Database,
  Calendar,
  Sparkles,
  Trash2
} from 'lucide-react';
import { isMockMode } from '../firebase/config';
import { ConfirmDialog } from '../components/ConfirmDialog';

export const SettingsView: React.FC = () => {
  const { user, partner, updateProfile, theme } = useAuthStore();
  const { events, deduplicateEvents, purgeIcalEvents } = useCalendarStore();
  const { tasks } = useTasksStore();
  const { notes } = useNotesStore();

  const [name, setName] = useState(user?.name || '');
  const [avatarEmoji, setAvatarEmoji] = useState(user?.avatarEmoji || '👤');
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor || '#3b82f6');
  const [calDefault, setCalDefault] = useState(user?.calendarDefaultView || 'Month');
  
  const [showSavedMsg, setShowSavedMsg] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string | null }>({
    type: 'idle',
    message: null
  });

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const closeConfirmDialog = React.useCallback(() => {
    setConfirmConfig({
      isOpen: false,
      title: '',
      message: '',
      onConfirm: () => {}
    });
  }, []);

  const handleDeduplicateEvents = async () => {
    setImportStatus({ type: 'loading', message: 'Reconciling shared calendar events...' });
    try {
      const res = await deduplicateEvents();
      setImportStatus({ 
        type: 'success', 
        message: res.deletedCount > 0
          ? `Cleaned up ${res.deletedCount} duplicate event(s)! Calendar is synchronized.`
          : 'No duplicate events found. Calendar is fully clean!'
      });
      setTimeout(() => setImportStatus({ type: 'idle', message: null }), 4000);
    } catch (err) {
      console.error(err);
      setImportStatus({ type: 'error', message: err instanceof Error ? err.message : 'Deduplication failed.' });
    }
  };

  const handlePurgeIcal = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Purge iCal Feeds (MVBC)',
      message: 'Are you sure you want to permanently delete all leftover iCal feed events (such as MVBC and external links) from the database? Your personal and shared family events will not be affected.',
      onConfirm: async () => {
        closeConfirmDialog();
        setImportStatus({ type: 'loading', message: 'Purging iCal feed events...' });
        try {
          const res = await purgeIcalEvents();
          setImportStatus({
            type: 'success',
            message: res.purgedCount > 0
              ? `Successfully purged ${res.purgedCount} iCal event(s)! All outside feeds removed.`
              : 'No leftover iCal events found in the database.'
          });
          setTimeout(() => setImportStatus({ type: 'idle', message: null }), 4000);
        } catch (err) {
          console.error(err);
          setImportStatus({ type: 'error', message: err instanceof Error ? err.message : 'Purge failed.' });
        }
      }
    });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      name,
      avatarEmoji,
      avatarColor,
      calendarDefaultView: calDefault
    });
    
    setShowSavedMsg(true);
    setTimeout(() => setShowSavedMsg(false), 2000);
  };

  const handleTogglePref = async (key: string, val: boolean) => {
    if (!user) return;
    const currentPrefs = user.notificationPreferences || {};
    await updateProfile({
      notificationPreferences: {
        ...currentPrefs,
        [key]: val
      }
    });
  };



  const handleExportData = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      user: { email: user?.email, name: user?.name },
      calendarEvents: events,
      tasks: tasks,
      notes: notes
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `slate-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const emojis = ['⚡', '🌸', '🦊', '🐨', '🐼', '🎨', '🚀', '🔮', '🧸', '🍪', '☕', '🐱'];
  const colors = ['#3b82f6', '#ec4899', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#14b8a6', '#64748b'];

  const prefs = user?.notificationPreferences || {
    cardAssigned: true,
    cardMoved: true,
    commentAdded: true,
    dueDateReminder: true,
    cardCompleted: true,
    wipLimitExceeded: true,
    chatMessage: true
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Profile Card */}
        <div className="bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-3xl p-6 shadow-sm flex flex-col gap-5">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <User size={14} /> My Profile
          </h3>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-sm focus:outline-none text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Avatar Emoji</label>
              <div className="flex flex-wrap gap-2">
                {emojis.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setAvatarEmoji(e)}
                    className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all cursor-pointer ${
                      avatarEmoji === e 
                        ? 'bg-slate-100 dark:bg-brand-800 border-2 border-slate-900 dark:border-white scale-105' 
                        : 'bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-850 hover:bg-slate-100'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Accent Color</label>
              <div className="flex flex-wrap gap-2">
                {colors.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAvatarColor(c)}
                    className="w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center cursor-pointer"
                    style={{ 
                      backgroundColor: c, 
                      borderColor: avatarColor === c ? (theme === 'dark' ? 'white' : 'black') : 'transparent' 
                    }}
                  >
                    {avatarColor === c && <Check size={12} className="text-white" />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Calendar Default View</label>
              <select
                value={calDefault}
                onChange={e => setCalDefault(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-xs font-semibold focus:outline-none text-slate-950 dark:text-slate-100"
              >
                <option value="Day">Day</option>
                <option value="4-Day">4-Day</option>
                <option value="2-Week">2-Week</option>
                <option value="Month">Month</option>
              </select>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-slate-100 text-white font-bold rounded-xl text-xs shadow cursor-pointer"
              >
                Save Profile
              </button>
              {showSavedMsg && (
                <span className="text-xs font-semibold text-green-500 flex items-center gap-1">
                  <Check size={14} /> Profile Saved!
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Partner Info & Notification Panel */}
        <div className="space-y-6">
          
          {/* Partner Display */}
          <div className="bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-3xl p-6 shadow-sm">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-4">
              <Heart size={14} className="text-rose-500 fill-rose-500" /> My Partner
            </h3>

            {partner ? (
              <div className="flex items-center gap-4 bg-slate-50 dark:bg-brand-950 p-4 rounded-2xl border border-slate-200 dark:border-brand-850">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-inner"
                  style={{ backgroundColor: partner.avatarColor }}
                >
                  {partner.avatarEmoji || '👤'}
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{partner.name}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{partner.email}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 bg-slate-50 dark:bg-brand-950 rounded-2xl border border-dashed border-slate-200 dark:border-brand-850">
                <span className="text-xs text-slate-400">Partner offline / has not set up profile</span>
              </div>
            )}
          </div>

          {/* Preferences */}
          <div className="bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Bell size={14} /> Notification Toggles
            </h3>

            <div className="space-y-3">
              {[
                { key: 'cardAssigned', label: 'Card assigned to you' },
                { key: 'cardMoved', label: 'Card moved columns' },
                { key: 'commentAdded', label: 'Comment posted' },
                { key: 'dueDateReminder', label: 'Due date approaching' },
                { key: 'cardCompleted', label: 'Card completed 🎉' },
                { key: 'wipLimitExceeded', label: 'WIP Limit warnings ⚠️' },
                { key: 'chatMessage', label: 'New chat message 💬' }
              ].map(pref => (
                <label key={pref.key} className="flex items-center justify-between cursor-pointer text-xs font-semibold py-1">
                  <span>{pref.label}</span>
                  <input
                    type="checkbox"
                    checked={!!(prefs as Record<string, boolean>)[pref.key]}
                    onChange={(e) => handleTogglePref(pref.key, e.target.checked)}
                    className="rounded text-indigo-650 focus:ring-indigo-500/20"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Backup & System Info Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Staged left column for Export & System Info */}
        <div className="space-y-6 md:col-span-1">
          {/* Export Data Box */}
          <div className="bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Database size={14} /> Backups & Export
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
              Download a full backup of all shared workspace records, including calendar events, note books, and task checklists, as a standard JSON file.
            </p>
            <button
              onClick={handleExportData}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-brand-850 dark:hover:bg-brand-800 rounded-xl text-xs font-bold transition-all shadow-sm w-full"
            >
              <Download size={14} /> Export Workspace JSON
            </button>
          </div>

          {/* System Details Box */}
          <div className="bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Info size={14} /> System Info
            </h3>
            <div className="space-y-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <div className="flex justify-between border-b border-slate-50 dark:border-brand-850 pb-1.5">
                <span>App Version</span>
                <span className="text-slate-700 dark:text-slate-200 font-extrabold">v1.0.0 (Slate)</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 dark:border-brand-850 pb-1.5">
                <span>Database Connection</span>
                <span className={isMockMode ? "text-amber-500" : "text-green-500"}>
                  {isMockMode ? "Local Mode (Mock Offline)" : "Live Cloud Firestore"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Whitelisted Accounts</span>
                <span className="text-slate-700 dark:text-slate-200 text-[10px]">2 Configured</span>
              </div>
            </div>
          </div>
        </div>

        {/* Shared Calendar Management */}
        <div className="bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between gap-4 md:col-span-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Calendar size={14} className="text-indigo-500" /> Shared Family Calendar
              </h3>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                Real-Time Sync Active
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Slate operates as a private, real-time shared calendar exclusively between you and Chelsea. Any event added, updated, or removed by either person syncs immediately across all devices without pulling in external feeds.
            </p>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-brand-850">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Calendar Maintenance
                </h4>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Reconcile cross-account entries and remove duplicate cards across devices.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDeduplicateEvents}
                  disabled={importStatus.type === 'loading'}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-650 hover:bg-indigo-550 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Sparkles size={14} />
                  {importStatus.type === 'loading' ? 'Reconciling...' : 'Clean Duplicate Events'}
                </button>
                <button
                  type="button"
                  onClick={handlePurgeIcal}
                  disabled={importStatus.type === 'loading'}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/30 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  Purge iCal Feeds (MVBC)
                </button>
              </div>
            </div>

            {importStatus.message && (
              <div className={`text-xs font-semibold py-2 px-3 rounded-xl border ${
                importStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                importStatus.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' :
                'bg-blue-500/10 border-blue-500/20 text-blue-500 animate-pulse'
              }`}>
                {importStatus.message}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        onClose={closeConfirmDialog}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
      />
    </div>
  );
};

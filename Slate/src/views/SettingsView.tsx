
import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useCalendarStore } from '../store/calendarStore';
import { CAL_PALETTE } from '../utils/constants';
import { useTasksStore } from '../store/tasksStore';
import { useNotesStore } from '../store/notesStore';
import { safeTokenStorage } from '../utils/storage';
import { 
  User, 
  Bell, 
  Download, 
  Info, 
  Heart, 
  Check, 
  Database,
  Calendar,
  Link,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { isMockMode } from '../firebase/config';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface StoredCalendar {
  id: string;
  summary?: string;
  color: string;
  selected?: boolean;
}

export const SettingsView: React.FC = () => {
  const { user, partner, updateProfile, theme, getGoogleCalendarToken } = useAuthStore();
  const { events, importGoogleEvents, clearGoogleEvents, deduplicateGoogleEvents } = useCalendarStore();
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

  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [discoveredCalendars, setDiscoveredCalendars] = useState<Array<{ id: string; summary: string; primary: boolean; selected: boolean; visibility: 'self' | 'both'; color: string }>>([]);
  const [showCalendarConfig, setShowCalendarConfig] = useState(false);
  const { googleCals } = useCalendarStore();
  const configuredCalendars = React.useMemo(() => {
    return user?.calendarConfigs && user.calendarConfigs.length > 0
      ? user.calendarConfigs.map(c => ({
          id: c.id,
          summary: c.summary,
          selected: c.selected,
          visibility: (c.visibility || 'both') as 'self' | 'both',
          color: c.color
        }))
      : googleCals.map(c => ({
          id: c.id,
          summary: c.summary,
          selected: c.visible,
          visibility: 'both' as const,
          color: c.color
        }));
  }, [user, googleCals]);

  const [icalUrl, setIcalUrl] = useState('');
  const [icalName, setIcalName] = useState('');
  const [icalColor, setIcalColor] = useState('#4f46e5');
  const [icalVisibility, setIcalVisibility] = useState<'both' | 'self'>('both');
  const [icalStatus, setIcalStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string | null }>({ type: 'idle', message: null });
  const [syncingFeeds, setSyncingFeeds] = useState<Record<string, boolean>>({});

  const handleSyncNow = async (cal: { id: string; summary: string; color: string; visibility: string }) => {
    setSyncingFeeds(prev => ({ ...prev, [cal.id]: true }));
    try {
      const { syncIcalFeed } = useCalendarStore.getState();
      const res = await syncIcalFeed(cal.id, cal.summary, cal.color, cal.visibility as 'both' | 'self');
      setIcalStatus({ type: 'success', message: `"${cal.summary}" synced! Updated ${res.imported} events.` });
    } catch (err) {
      setIcalStatus({ type: 'error', message: err instanceof Error ? err.message : 'Sync failed.' });
    } finally {
      setSyncingFeeds(prev => ({ ...prev, [cal.id]: false }));
    }
  };

  const handleSyncIcalFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!icalUrl) return;

    let cleanUrl = icalUrl.trim();
    if (cleanUrl.startsWith('webcal://')) {
      cleanUrl = 'https://' + cleanUrl.slice(9);
    }
    cleanUrl = cleanUrl.replace(/%40/gi, '@');

    setIcalStatus({ type: 'loading', message: 'Syncing live iCal feed...' });
    try {
      const feedName = icalName.trim() || 'Live Google iCal';
      const syncIcalFeed = useCalendarStore.getState().syncIcalFeed;
      const res = await syncIcalFeed(cleanUrl, feedName, icalColor, icalVisibility);

      const newCal = { id: cleanUrl, summary: feedName, selected: true, visibility: icalVisibility, color: icalColor };
      const updatedConfigured = [...configuredCalendars.filter(c => c.id !== cleanUrl), newCal];
      localStorage.setItem('slate_google_cals', JSON.stringify(updatedConfigured));
      if (user) {
        updateProfile({ calendarConfigs: updatedConfigured });
      }

      const activeCals = updatedConfigured
        .filter(c => c.selected)
        .map(c => ({ id: c.id, summary: c.summary, color: c.color, visible: true }));
      useCalendarStore.getState().setGoogleCals(activeCals);

      setIcalStatus({ type: 'success', message: `Live iCal synced! Imported/updated ${res.imported} events.` });
      setIcalUrl('');
      setIcalName('');
    } catch (err) {
      console.error(err);
      setIcalStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to fetch iCal feed.' });
    }
  };

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

  const partnerCals = React.useMemo(() => {
    if (!partner) return [];
    const partnerEvents = events.filter(e => !!e.googleEventId && e.creatorId === partner.uid);
    const calsMap = new Map<string, { id: string; summary: string; color: string; creatorName: string }>();
    partnerEvents.forEach(e => {
      const calId = e.googleCalendarId || e.color;
      if (!calsMap.has(calId)) {
        calsMap.set(calId, {
          id: calId,
          summary: e.googleCalendarName || (e.notes?.startsWith('Imported from Google Calendar') ? 'Google Calendar' : (e.notes || 'Google Calendar')),
          color: e.color,
          creatorName: partner.name
        });
      }
    });
    return Array.from(calsMap.values());
  }, [events, partner]);



  const handleConnectGoogle = async () => {
    setImportStatus({ type: 'loading', message: 'Authorizing with Google...' });
    try {
      const token = await getGoogleCalendarToken();
      if (!token) {
        setImportStatus({ type: 'error', message: 'Authorization cancelled or failed.' });
        return;
      }
      setGoogleToken(token);
      safeTokenStorage.setToken(token, user?.uid);
      localStorage.setItem('slate_google_token_expiry', (Date.now() + 3550 * 1000).toString());
      setImportStatus({ type: 'loading', message: 'Retrieving your calendars...' });

      let list: Array<{ id: string; summary: string; primary: boolean; selected: boolean; visibility: 'self' | 'both'; color: string }> = [];
      if (token === 'mock-google-token-xyz123') {
        list = [
          { id: 'primary', summary: '👤 Primary Calendar', primary: true, selected: true, visibility: 'both' as const, color: CAL_PALETTE[0] },
          { id: 'work-cal', summary: '💻 Work Projects', primary: false, selected: false, visibility: 'self' as const, color: CAL_PALETTE[1] },
          { id: 'family-cal', summary: '🥞 Family Brunch & Trips', primary: false, selected: false, visibility: 'both' as const, color: CAL_PALETTE[2] }
        ];
      } else {
        const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Failed to retrieve Google calendars list: ${response.status} ${response.statusText} - ${errText}`);
        }
        interface GoogleApiCalendarListEntry {
          id: string;
          summary: string;
          primary?: boolean;
        }
        const data = await response.json();
        list = ((data.items || []) as GoogleApiCalendarListEntry[]).map((item, idx: number) => ({
          id: item.id,
          summary: item.summary,
          primary: !!item.primary,
          selected: !!item.primary,
          visibility: item.primary ? ('both' as const) : ('self' as const),
          color: CAL_PALETTE[idx % CAL_PALETTE.length]
        }));
      }

      const savedConfig = localStorage.getItem('slate_google_cals');
      if (savedConfig) {
        try {
          const parsed = JSON.parse(savedConfig) as StoredCalendar[];
          list = list.map((item) => {
            const match = parsed.find((p) => p.id === item.id);
            if (match) {
              return { 
                ...item, 
                selected: !!match.selected, 
                visibility: match.selected ? item.visibility : 'self', 
                color: match.color || item.color,
                summary: match.summary || item.summary
              };
            }
            return item;
          });
        } catch (e) {
          console.warn('Error reading saved calendar config', e);
        }
      }

      setDiscoveredCalendars(list);
      setShowCalendarConfig(true);
      setImportStatus({ type: 'idle', message: null });
    } catch (err) {
      console.error(err);
      setImportStatus({ type: 'error', message: err instanceof Error ? err.message : 'Connection failed.' });
    }
  };

  const handleSyncCalendars = async () => {
    if (!googleToken) return;
    const targets = discoveredCalendars.filter(c => c.selected);
    if (targets.length === 0) {
      setImportStatus({ type: 'error', message: 'Please select at least one calendar to sync.' });
      return;
    }

    setImportStatus({ type: 'loading', message: 'Syncing chosen calendars...' });
    try {
      // Save current selection config (including chosen color and summary)
      const saveState = discoveredCalendars.map(c => ({ id: c.id, summary: c.summary, selected: c.selected, visibility: c.visibility, color: c.color }));
      localStorage.setItem('slate_google_cals', JSON.stringify(saveState));
      if (user) {
        updateProfile({ calendarConfigs: saveState });
      }

      // Instantly update sidebar googleCals state
      const activeCals = saveState
        .filter(c => c.selected)
        .map(c => ({ id: c.id, summary: c.summary, color: c.color, visible: true }));
      useCalendarStore.getState().setGoogleCals(activeCals);

      const result = await importGoogleEvents(googleToken, targets.map(t => ({ id: t.id, visibility: t.visibility, color: t.color, summary: t.summary })));
      localStorage.setItem('slate_last_google_sync', Date.now().toString());
      setImportStatus({
        type: 'success',
        message: `Import complete! Added ${result.imported} events (skipped ${result.skipped} duplicates).`
      });
      setShowCalendarConfig(false);
      setGoogleToken(null);
    } catch (err) {
      console.error(err);
      setImportStatus({ type: 'error', message: err instanceof Error ? err.message : 'Sync failed.' });
    }
  };

  const handleClearGoogleEvents = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Clear Google Calendar Events',
      message: "Are you sure you want to permanently delete your imported Google Calendar events from Slate? (This will not affect your partner's imported events).",
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setImportStatus({ type: 'loading', message: 'Removing Google events...' });
        try {
          await clearGoogleEvents();
          setImportStatus({ type: 'success', message: 'Your Google Calendar events successfully removed!' });
          setTimeout(() => setImportStatus({ type: 'idle', message: null }), 3500);
        } catch (err) {
          console.error(err);
          setImportStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to remove events.' });
        }
      }
    });
  };

  const handleDeduplicateEvents = async () => {
    setImportStatus({ type: 'loading', message: 'Cleaning duplicate calendar events...' });
    try {
      await deduplicateGoogleEvents();
      setImportStatus({ type: 'success', message: 'Calendar deduplicated successfully!' });
    } catch (err) {
      console.error(err);
      setImportStatus({ type: 'error', message: err instanceof Error ? err.message : 'Deduplication failed.' });
    }
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

        {/* Google Calendar Integration Box */}
        <div className="bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between gap-4 md:col-span-2">
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Calendar size={14} className="text-blue-500" /> Google Integration
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
              Connect your Google account to discover calendars, choose which ones to import, and configure private vs shared visibility.
            </p>
          </div>
          
          <div className="space-y-3">
            {!showCalendarConfig && (configuredCalendars.length > 0 || partnerCals.length > 0) && (
              <div className="border border-slate-200 dark:border-brand-800 rounded-2xl p-3 bg-slate-50/50 dark:bg-brand-950/20 space-y-2.5 max-h-[200px] overflow-y-auto no-scrollbar">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">Configured Calendars</span>
                
                {/* My Calendars */}
                {configuredCalendars.map((cal) => (
                  <div key={cal.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-brand-850 last:border-b-0 last:pb-0 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0 ring-1 ring-black/10"
                        style={{ backgroundColor: cal.color }}
                      />
                      <span className="font-semibold truncate text-slate-700 dark:text-slate-350">{cal.summary}</span>
                      <span className="text-[9px] px-1.5 py-0.2 bg-slate-100 dark:bg-brand-850 rounded text-slate-400 shrink-0 capitalize">
                        {cal.visibility === 'both' ? 'Shared' : 'Private'}
                      </span>
                      <span className="text-[8px] px-1 bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded shrink-0 font-extrabold">
                        By You
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {(cal.id.startsWith('http') || cal.id.includes('.ics')) && (
                        <button
                          type="button"
                          onClick={() => handleSyncNow(cal)}
                          disabled={syncingFeeds[cal.id]}
                          className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-950/70 disabled:opacity-50 transition-colors cursor-pointer"
                          title="Sync now"
                        >
                          <RefreshCw size={10} className={syncingFeeds[cal.id] ? 'animate-spin' : ''} />
                          {syncingFeeds[cal.id] ? 'Syncing...' : 'Sync Now'}
                        </button>
                      )}
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmConfig({
                          isOpen: true,
                          title: 'Delete Calendar Configuration',
                          message: `Are you sure you want to completely delete "${cal.summary}" and remove all of its events from Slate across all your devices?`,
                          onConfirm: async () => {
                            setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                            setImportStatus({ type: 'loading', message: `Removing ${cal.summary}...` });
                            try {
                              const { removeCalendarFeed } = useCalendarStore.getState();
                              await removeCalendarFeed(cal.id, cal.summary, cal.color);
                              setImportStatus({ type: 'success', message: `Successfully deleted "${cal.summary}" calendar!` });
                              setTimeout(() => setImportStatus({ type: 'idle', message: null }), 3500);
                            } catch (err) {
                              setImportStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to remove calendar.' });
                            }
                          }
                        });
                      }}
                      className="p-1 hover:text-rose-500 text-slate-400 dark:text-slate-500 transition-colors shrink-0"
                      title="Delete calendar configuration and events"
                    >
                      <Trash2 size={13} />
                    </button>
                    </div>
                  </div>
                ))}

                {/* Partner's Calendars */}
                {partnerCals.map((cal) => (
                  <div key={cal.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-brand-850 last:border-b-0 last:pb-0 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0 ring-1 ring-black/10"
                        style={{ backgroundColor: cal.color }}
                      />
                      <span className="font-semibold truncate text-slate-700 dark:text-slate-350">{cal.summary}</span>
                      <span className="text-[8px] px-1 bg-pink-100 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 rounded shrink-0 font-extrabold">
                        By {cal.creatorName}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmConfig({
                          isOpen: true,
                          title: 'Delete Partner Calendar Events',
                          message: `Are you sure you want to delete events for "${cal.summary}" imported by ${cal.creatorName}?`,
                          onConfirm: async () => {
                            setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                            setImportStatus({ type: 'loading', message: `Removing ${cal.summary} events...` });
                            try {
                              const { clearGoogleCalendarEvents } = useCalendarStore.getState();
                              await clearGoogleCalendarEvents(cal.id, cal.color, cal.summary);
                              setImportStatus({ type: 'success', message: `Successfully deleted "${cal.summary}" events!` });
                              setTimeout(() => setImportStatus({ type: 'idle', message: null }), 3500);
                            } catch (err) {
                              setImportStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to remove partner calendar events.' });
                            }
                          }
                        });
                      }}
                      className="p-1 hover:text-rose-500 text-slate-400 dark:text-slate-500 transition-colors shrink-0"
                      title={`Delete events imported by ${cal.creatorName}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {importStatus.message && (
              <div className={`text-xs font-semibold py-1.5 px-3 rounded-xl border ${
                importStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                importStatus.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' :
                'bg-blue-500/10 border-blue-500/20 text-blue-500 animate-pulse'
              }`}>
                {importStatus.message}
              </div>
            )}

            {showCalendarConfig && discoveredCalendars.length > 0 && (
              <div className="border border-slate-200 dark:border-brand-800 rounded-2xl p-3 bg-slate-50/50 dark:bg-brand-950/20 space-y-2.5 max-h-[240px] overflow-y-auto no-scrollbar">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">Select Calendars, Color & Visibility</span>
                {discoveredCalendars.map((cal, idx) => (
                  <div key={cal.id} className="text-xs py-1.5 border-b border-slate-100 dark:border-brand-850 last:border-b-0 last:pb-0 space-y-2">
                    {/* Row 1: Checkbox + name + specific trash can */}
                    <div className="flex items-center justify-between w-full gap-2">
                      <label className="flex items-center gap-2 cursor-pointer font-semibold flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={cal.selected}
                          onChange={e => {
                            const updated = [...discoveredCalendars];
                            updated[idx].selected = e.target.checked;
                            setDiscoveredCalendars(updated);
                          }}
                          className="rounded text-indigo-650 focus:ring-indigo-500/20 w-3.5 h-3.5 shrink-0"
                        />
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/10"
                          style={{ backgroundColor: cal.color }}
                        />
                        <input
                          type="text"
                          value={cal.summary}
                          onChange={e => {
                            const updated = [...discoveredCalendars];
                            updated[idx].summary = e.target.value;
                            setDiscoveredCalendars(updated);
                          }}
                          className="px-2 py-0.5 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-850 rounded text-xs font-semibold focus:outline-none w-full min-w-0"
                        />
                      </label>
                      
                      <button
                         type="button"
                         onClick={() => {
                           setConfirmConfig({
                             isOpen: true,
                             title: "Delete Calendar Events",
                             message: `Are you sure you want to permanently delete all imported events for "${cal.summary}" from Slate?`,
                             onConfirm: async () => {
                               setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                               setImportStatus({ type: "loading", message: `Removing ${cal.summary} events...` });
                               try {
                                 const { clearGoogleCalendarEvents } = useCalendarStore.getState();
                                 await clearGoogleCalendarEvents(cal.id, cal.color);
                                 setImportStatus({
                                   type: "success",
                                   message: `Successfully removed all events for "${cal.summary}"!`
                                 });
                                 setTimeout(() => setImportStatus({ type: 'idle', message: null }), 3500);
                               } catch (err) {
                                 setImportStatus({ type: "error", message: err instanceof Error ? err.message : "Failed to remove calendar events." });
                               }
                             }
                           });
                         }}
                         className="p-1 hover:text-rose-500 text-slate-400 dark:text-slate-500 transition-colors shrink-0"
                         title={`Delete synced events for ${cal.summary}`}
                       >
                         <Trash2 size={13} />
                       </button>
                     </div>

                     {/* Row 2: Color picker + visibility (only when selected) */}
                     {cal.selected && (
                       <div className="flex flex-col gap-2 pl-5">
                         <div className="grid grid-cols-10 gap-1">
                           {CAL_PALETTE.map(c => (
                             <button
                               key={c}
                               type="button"
                               onClick={() => {
                                 const updated = [...discoveredCalendars];
                                 updated[idx].color = c;
                                 setDiscoveredCalendars(updated);
                               }}
                               className="w-4 h-4 rounded-full transition-all shrink-0 cursor-pointer"
                               style={{
                                 backgroundColor: c,
                                 boxShadow: cal.color === c ? `0 0 0 2px white, 0 0 0 3.5px ${c}` : "none",
                                 transform: cal.color === c ? "scale(1.2)" : "scale(1)"
                               }}
                               title={c}
                             />
                           ))}
                         </div>
                         <select
                            value={cal.visibility}
                            onChange={e => {
                              const updated = [...discoveredCalendars];
                               updated[idx].visibility = e.target.value as 'self' | 'both';
                              setDiscoveredCalendars(updated);
                            }}
                            className="px-2 py-1 bg-white dark:bg-brand-950 border border-slate-250 dark:border-brand-800 rounded-lg text-[10px] font-bold focus:outline-none shrink-0 text-slate-900 dark:text-slate-100"
                         >
                           <option value="both">Shared (Both)</option>
                           <option value="self">Private (Me)</option>
                         </select>
                       </div>
                     )}
                   </div>
                 ))}
               </div>
             )}
            {importStatus.message && (
              <div className={`text-xs font-semibold py-1.5 px-3 rounded-xl border ${
                importStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                importStatus.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' :
                'bg-blue-500/10 border-blue-500/20 text-blue-500 animate-pulse'
              }`}>
                {importStatus.message}
              </div>
            )}

            {showCalendarConfig && discoveredCalendars.length > 0 && (
              <div className="border border-slate-200 dark:border-brand-800 rounded-2xl p-3 bg-slate-50/50 dark:bg-brand-950/20 space-y-2.5 max-h-[240px] overflow-y-auto no-scrollbar">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">Select Calendars, Color & Visibility</span>
                {discoveredCalendars.map((cal, idx) => (
                  <div key={cal.id} className="text-xs py-1.5 border-b border-slate-100 dark:border-brand-850 last:border-b-0 last:pb-0 space-y-2">
                    {/* Row 1: Checkbox + name + specific trash can */}
                    <div className="flex items-center justify-between w-full gap-2">
                      <label className="flex items-center gap-2 cursor-pointer font-semibold flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={cal.selected}
                          onChange={e => {
                            const updated = [...discoveredCalendars];
                            updated[idx].selected = e.target.checked;
                            setDiscoveredCalendars(updated);
                          }}
                          className="rounded text-indigo-650 focus:ring-indigo-500/20 w-3.5 h-3.5 shrink-0"
                        />
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/10"
                          style={{ backgroundColor: cal.color }}
                        />
                        <input
                          type="text"
                          value={cal.summary}
                          onChange={e => {
                            const updated = [...discoveredCalendars];
                            updated[idx].summary = e.target.value;
                            setDiscoveredCalendars(updated);
                          }}
                          className="px-2 py-0.5 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-850 rounded text-xs font-semibold focus:outline-none w-full min-w-0"
                        />
                      </label>
                      
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmConfig({
                            isOpen: true,
                            title: 'Delete Calendar Events',
                            message: `Are you sure you want to permanently delete all imported events for "${cal.summary}" from Slate?`,
                            onConfirm: async () => {
                              setImportStatus({ type: 'loading', message: `Removing ${cal.summary} events...` });
                              try {
                                const { clearGoogleCalendarEvents } = useCalendarStore.getState();
                                await clearGoogleCalendarEvents(cal.id, cal.color);
                                setImportStatus({
                                  type: 'success',
                                  message: `Successfully removed all events for "${cal.summary}"!`
                                });
                              } catch (err) {
                                setImportStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to remove calendar events.' });
                              }
                            }
                          });
                        }}
                        className="p-1 hover:text-rose-500 text-slate-400 dark:text-slate-500 transition-colors shrink-0"
                        title={`Delete synced events for ${cal.summary}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Row 2: Color picker + visibility (only when selected) */}
                    {cal.selected && (
                      <div className="flex flex-col gap-2 pl-5">
                        <div className="grid grid-cols-10 gap-1">
                          {CAL_PALETTE.map(c => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => {
                                const updated = [...discoveredCalendars];
                                updated[idx].color = c;
                                setDiscoveredCalendars(updated);
                              }}
                              className="w-4 h-4 rounded-full transition-all shrink-0 cursor-pointer"
                              style={{
                                backgroundColor: c,
                                boxShadow: cal.color === c ? `0 0 0 2px white, 0 0 0 3.5px ${c}` : 'none',
                                transform: cal.color === c ? 'scale(1.2)' : 'scale(1)'
                              }}
                              title={c}
                            />
                          ))}
                        </div>

                        {/* Visibility dropdown */}
                        <select
                           value={cal.visibility}
                           onChange={e => {
                             const updated = [...discoveredCalendars];
                             updated[idx].visibility = e.target.value as 'self' | 'both';
                             setDiscoveredCalendars(updated);
                           }}
                           className="px-2 py-1 bg-white dark:bg-brand-950 border border-slate-250 dark:border-brand-800 rounded-lg text-[10px] font-bold focus:outline-none shrink-0 text-slate-900 dark:text-slate-100"
                        >
                          <option value="both">Shared (Both)</option>
                          <option value="self">Private (Me)</option>
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {showCalendarConfig ? (
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCalendarConfig(false)}
                  className="flex-1 py-2 border border-slate-250 dark:border-brand-800 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-brand-850 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSyncCalendars}
                  disabled={importStatus.type === 'loading'}
                  className="flex-1 py-2 bg-indigo-650 hover:bg-indigo-550 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                >
                  Confirm & Sync
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  disabled={importStatus.type === 'loading'}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-650 hover:bg-indigo-550 disabled:bg-slate-200 dark:disabled:bg-brand-850 text-white disabled:text-slate-400 rounded-xl text-xs font-bold transition-all shadow-sm w-full cursor-pointer"
                >
                  <RefreshCw size={14} className={importStatus.type === 'loading' ? 'animate-spin' : ''} />
                  {importStatus.type === 'loading' ? 'Connecting...' : 'Connect Google Calendar'}
                </button>
                {events.some(e => !!e.googleEventId) && (
                  <div className="flex gap-2 w-full">
                    <button
                      type="button"
                      onClick={handleClearGoogleEvents}
                      disabled={importStatus.type === 'loading'}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-rose-200 hover:border-rose-300 dark:border-rose-900/30 dark:hover:border-rose-900/60 text-rose-500 rounded-xl text-[11px] font-bold transition-all shadow-sm bg-transparent cursor-pointer"
                    >
                      Clear Google Events
                    </button>
                    <button
                      type="button"
                      onClick={handleDeduplicateEvents}
                      disabled={importStatus.type === 'loading'}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-250 hover:border-slate-350 dark:border-brand-800 dark:hover:border-brand-700 text-slate-650 dark:text-slate-400 rounded-xl text-[11px] font-bold transition-all shadow-sm bg-transparent cursor-pointer"
                    >
                      Clean Duplicates
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Live iCal (.ics) Address Feed Box */}
          <div className="border-t border-slate-150 dark:border-brand-850 pt-4 mt-2">
            <form onSubmit={handleSyncIcalFeed} className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Link size={13} className="text-emerald-500" /> Live iCal (.ics) Link Auto-Sync (Public or Secret)
                </h4>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                  Auto-Updates
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                Paste any <strong>Public</strong> or <strong>Secret</strong> iCal URL (<code className="text-[10px] text-indigo-500">https://...basic.ics</code> or <code className="text-[10px] text-indigo-500">webcal://...</code>). Slate auto-refreshes all active feeds every minute and on every tab focus.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="https://.../basic.ics or webcal://..."
                  value={icalUrl}
                  onChange={e => setIcalUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-slate-100"
                  required
                />
                <input
                  type="text"
                  placeholder="Calendar Label (e.g. My Live Google Cal)"
                  value={icalName}
                  onChange={e => setIcalName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400">Color:</span>
                    <div className="grid grid-cols-10 gap-1">
                      {CAL_PALETTE.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setIcalColor(c)}
                          className="w-4 h-4 rounded-full border border-black/10 dark:border-white/10 transition-transform cursor-pointer"
                          style={{
                            backgroundColor: c,
                            transform: icalColor === c ? 'scale(1.3)' : 'scale(1)',
                            boxShadow: icalColor === c ? `0 0 0 2px white, 0 0 0 3px ${c}` : undefined
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <select
                    value={icalVisibility}
                    onChange={e => setIcalVisibility(e.target.value as 'both' | 'self')}
                    className="px-2 py-1 bg-white dark:bg-brand-950 border border-slate-250 dark:border-brand-800 rounded-lg text-[10px] font-bold text-slate-700 dark:text-slate-200"
                  >
                    <option value="both">Shared (Both)</option>
                    <option value="self">Private (Me)</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={icalStatus.type === 'loading' || !icalUrl}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-550 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  {icalStatus.type === 'loading' ? 'Syncing...' : 'Add Live iCal Feed'}
                </button>
              </div>
              {icalStatus.message && (
                <p className={`text-[11px] font-semibold ${icalStatus.type === 'error' ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {icalStatus.message}
                </p>
              )}
            </form>
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

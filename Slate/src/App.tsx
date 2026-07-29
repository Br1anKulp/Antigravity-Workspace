import { useEffect, useState, lazy, Suspense } from 'react';
import { useAuthStore } from './store/authStore';
import { useCalendarStore } from './store/calendarStore';
import { useTasksStore } from './store/tasksStore';
import { useNotesStore } from './store/notesStore';
import { useKanbanStore } from './store/kanbanStore';
import { useNotificationStore } from './store/notificationStore';
import { useChatStore } from './store/chatStore';
import { useListsStore } from './store/listsStore';

import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { AppLayout } from './layouts/AppLayout';
import { LoginView } from './views/LoginView';

// Lazy load each view to split bundle chunks
const CalendarView = lazy(() => import('./views/CalendarView').then(m => ({ default: m.CalendarView })));
const TasksView = lazy(() => import('./views/TasksView').then(m => ({ default: m.TasksView })));
const NotesView = lazy(() => import('./views/NotesView').then(m => ({ default: m.NotesView })));
const KanbanView = lazy(() => import('./views/KanbanView').then(m => ({ default: m.KanbanView })));
const ChatView = lazy(() => import('./views/ChatView').then(m => ({ default: m.ChatView })));
const SettingsView = lazy(() => import('./views/SettingsView').then(m => ({ default: m.SettingsView })));
const ListsView = lazy(() => import('./views/ListsView').then(m => ({ default: m.ListsView })));

function App() {
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const initAuth = useAuthStore((s) => s.init);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const subscribeNotifications = useNotificationStore((s) => s.subscribeNotifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const subscribeEvents = useCalendarStore((s) => s.subscribeEvents);
  const setActiveView = useCalendarStore((s) => s.setActiveView);

  const subscribeTasks = useTasksStore((s) => s.subscribeTasks);

  const subscribeNotes = useNotesStore((s) => s.subscribeNotes);
  const lastDeletedNote = useNotesStore((s) => s.lastDeletedNote);
  const undoDelete = useNotesStore((s) => s.undoDelete);
  const clearLastDeletedNote = useNotesStore((s) => s.clearLastDeletedNote);

  const subscribeKanban = useKanbanStore((s) => s.subscribeKanban);
  const subscribeMessages = useChatStore((s) => s.subscribeMessages);
  const subscribeLists = useListsStore((s) => s.subscribeItems);

  const [currentTab, setCurrentTab] = useState<string>(() => {
    return localStorage.getItem('slate_active_tab') || 'calendar';
  });

  // Automatically clear lastDeletedNote after 10 seconds
  useEffect(() => {
    if (lastDeletedNote) {
      const timer = setTimeout(() => {
        clearLastDeletedNote();
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [lastDeletedNote, clearLastDeletedNote]);

  // Persist current tab selection to survive refreshes
  useEffect(() => {
    localStorage.setItem('slate_active_tab', currentTab);
  }, [currentTab]);

  // Initialize Auth state
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const { uid } = user || {};

  // Update PWA Home Screen Badge
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
      if (unreadCount > 0) {
        navigator.setAppBadge(unreadCount).catch(err => {
          console.warn('Failed to set app badge:', err);
        });
      } else {
        navigator.clearAppBadge().catch(err => {
          console.warn('Failed to clear app badge:', err);
        });
      }
    }
  }, [unreadCount]);

  // Load default calendar view preference upon login or change
  useEffect(() => {
    if (uid && user?.calendarDefaultView) {
      setActiveView(user.calendarDefaultView as 'Day' | '4-Day' | '2-Week' | 'Month' | 'Schedule');
    }
  }, [uid, user?.calendarDefaultView, setActiveView]);

  // Subscribe to real-time updates when logged in
  useEffect(() => {
    if (!uid || !updateProfile) return;

    // Presence heartbeat
    const updateActiveTime = () => {
      if (document.visibilityState === 'visible') {
        updateProfile({ lastActive: new Date().toISOString() }).catch(err => {
          console.error('Failed to update presence timestamp:', err);
        });
      }
    };

    // Update presence immediately on load and set up 45-second heartbeat
    updateActiveTime();
    const presenceInterval = setInterval(updateActiveTime, 45000);

    // Background auto-sync for live iCal (.ics) feeds
    const syncAllIcalFeeds = async () => {
      const saved = localStorage.getItem('slate_google_cals');
      if (!saved) return;
      try {
        const parsed = JSON.parse(saved);
        const icalFeeds = parsed.filter((c: { selected?: boolean; id?: string; summary?: string; color?: string; visibility?: 'self' | 'both' }) => c.selected && c.id && (c.id.startsWith('http') || c.id.includes('.ics')));
        await Promise.all(
          icalFeeds.map((feed: { id: string; summary?: string; color?: string; visibility?: 'self' | 'both' }) =>
            useCalendarStore.getState().syncIcalFeed(feed.id, feed.summary || 'Live iCal', feed.color || '#4f46e5', feed.visibility || 'both').catch(console.error)
          )
        );
      } catch (e) {
        console.warn('iCal auto-sync check error:', e);
      }
    };

    syncAllIcalFeeds();
    const icalInterval = setInterval(syncAllIcalFeeds, 60000); // 1 minute auto-sync

    // Also sync iCal feeds whenever the tab regains focus/visibility
    const syncOnVisibility = () => {
      if (document.visibilityState === 'visible') syncAllIcalFeeds();
    };
    window.addEventListener('visibilitychange', syncOnVisibility);
    window.addEventListener('focus', syncAllIcalFeeds);

    // Update presence on visibility or focus changes
    window.addEventListener('visibilitychange', updateActiveTime);
    window.addEventListener('focus', updateActiveTime);

    // Subscriptions
    const unsubNotifications = subscribeNotifications(uid);
    const unsubEvents = subscribeEvents();
    const unsubTasks = subscribeTasks();
    const unsubNotes = subscribeNotes();
    const unsubKanban = subscribeKanban();
    const unsubMessages = subscribeMessages();
    const unsubLists = subscribeLists();

    return () => {
      clearInterval(presenceInterval);
      clearInterval(icalInterval);
      window.removeEventListener('visibilitychange', syncOnVisibility);
      window.removeEventListener('focus', syncAllIcalFeeds);
      window.removeEventListener('visibilitychange', updateActiveTime);
      window.removeEventListener('focus', updateActiveTime);
      unsubNotifications();
      unsubEvents();
      unsubTasks();
      unsubNotes();
      unsubKanban();
      unsubMessages();
      unsubLists();
    };
  }, [uid, updateProfile, subscribeNotifications, subscribeEvents, subscribeTasks, subscribeNotes, subscribeKanban, subscribeMessages, subscribeLists]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-brand-950 text-slate-450">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <span className="text-xs font-bold tracking-widest uppercase">Opening Slate Workspace...</span>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <>
      <AppLayout currentTab={currentTab} setCurrentTab={setCurrentTab}>
        {currentTab === 'calendar' && (
          <ErrorBoundary fallbackTitle="Calendar failed to load">
            <Suspense fallback={<LoadingSkeleton type="calendar" />}>
              <CalendarView />
            </Suspense>
          </ErrorBoundary>
        )}
        {currentTab === 'tasks' && (
          <ErrorBoundary fallbackTitle="Tasks checklist failed to load">
            <Suspense fallback={<LoadingSkeleton type="list" />}>
              <TasksView />
            </Suspense>
          </ErrorBoundary>
        )}
        {currentTab === 'lists' && (
          <ErrorBoundary fallbackTitle="Shared lists failed to load">
            <Suspense fallback={<LoadingSkeleton type="list" />}>
              <ListsView />
            </Suspense>
          </ErrorBoundary>
        )}
        {currentTab === 'notes' && (
          <ErrorBoundary fallbackTitle="Shared notes failed to load">
            <Suspense fallback={<LoadingSkeleton type="list" rows={3} />}>
              <NotesView />
            </Suspense>
          </ErrorBoundary>
        )}
        {currentTab === 'kanban' && (
          <ErrorBoundary fallbackTitle="Kanban board failed to load">
            <Suspense fallback={<LoadingSkeleton type="kanban" />}>
              <KanbanView />
            </Suspense>
          </ErrorBoundary>
        )}
        {currentTab === 'chat' && (
          <ErrorBoundary fallbackTitle="Shared chat failed to load">
            <Suspense fallback={<LoadingSkeleton type="card" />}>
              <ChatView />
            </Suspense>
          </ErrorBoundary>
        )}
        {currentTab === 'settings' && (
          <ErrorBoundary fallbackTitle="Settings failed to load">
            <Suspense fallback={<LoadingSkeleton type="card" />}>
              <SettingsView />
            </Suspense>
          </ErrorBoundary>
        )}
      </AppLayout>

      {/* Global Notes Undo Delete Toast */}
      {lastDeletedNote && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white dark:bg-white dark:text-black px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 transition-all duration-300">
          <span className="text-xs font-bold">Deleted note "{lastDeletedNote.title || 'Untitled Note'}"</span>
          <button
            onClick={async () => {
              await undoDelete();
            }}
            className="text-xs font-black uppercase tracking-wider text-indigo-400 dark:text-indigo-650 hover:underline px-2 py-1 rounded cursor-pointer"
          >
            Undo
          </button>
          <button
            onClick={() => clearLastDeletedNote()}
            className="text-xs font-bold text-slate-400 dark:text-slate-550 hover:text-white dark:hover:text-black px-1.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}

export default App;

import { create } from 'zustand';
import { dbService } from '../firebase/db';
import { addDays, addWeeks, addMonths, parseISO, format } from 'date-fns';
import { useAuthStore } from './authStore';
import { useNotificationStore } from './notificationStore';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO String
  end: string;   // ISO String
  duration: number; // in minutes
  color: string; // hex or tailwind class
  notes?: string;
  assignee: 'self' | 'partner' | 'both';
  creatorId: string;
  creatorName: string;
  googleEventId?: string;
  googleCalendarId?: string;
  googleCalendarName?: string;
  allDay?: boolean;
  recurring?: {
    frequency: 'none' | 'daily' | 'weekly' | 'monthly';
    interval: number; // every X days/weeks/months
    until?: string; // ISO date string
  };
}

export const isIcalEvent = (e: CalendarEvent): boolean => {
  const calId = (e.googleCalendarId || '').toLowerCase();
  const calName = (e.googleCalendarName || '').toLowerCase();
  const notes = (e.notes || '').toLowerCase();
  const title = (e.title || '').toLowerCase();

  return (
    notes.includes('live ical feed') ||
    notes.includes('mvbc') ||
    notes.includes('.ics') ||
    notes.includes('webcal') ||
    calName.includes('mvbc') ||
    calName.includes('ical') ||
    calName.startsWith('http') ||
    calName.startsWith('webcal') ||
    calId.startsWith('http') ||
    calId.startsWith('webcal') ||
    calId.includes('.ics') ||
    calId.includes('mvbc') ||
    calId.includes('churchcenter') ||
    title.includes('mvbc') ||
    title.includes('live ical feed')
  );
};

interface CalendarState {
  events: CalendarEvent[];
  loading: boolean;
  selectedDate: Date;
  activeView: 'Day' | '4-Day' | '2-Week' | 'Month' | 'Schedule';
  showCreateEventModal: boolean;
  setShowCreateEventModal: (open: boolean) => void;
  showGoogleEvents: boolean;
  googleCals: Array<{ id: string; summary: string; color: string; visible: boolean }>;
  subscribeEvents: () => () => void;
  setSelectedDate: (date: Date) => void;
  setActiveView: (view: 'Day' | '4-Day' | '2-Week' | 'Month' | 'Schedule') => void;
  setShowGoogleEvents: (show: boolean) => void;
  setGoogleCals: (cals: Array<{ id: string; summary: string; color: string; visible: boolean }>) => void;
  toggleCalendarVisibility: (color: string) => void;
  syncGoogleCalsFromEvents: (googleEvents: CalendarEvent[]) => void;
  addEvent: (event: Omit<CalendarEvent, 'id' | 'creatorId' | 'creatorName' | 'googleEventId'>) => Promise<void>;
  updateEvent: (id: string, data: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  getExpandedEvents: (startDate: Date, endDate: Date) => CalendarEvent[];
  importGoogleEvents: (
    accessToken: string,
    calendarConfigs: Array<{ id: string; visibility: 'self' | 'both'; color?: string; summary?: string }>
  ) => Promise<{ imported: number; skipped: number }>;
  syncIcalFeed: (
    feedUrl: string,
    feedName: string,
    color: string,
    visibility: 'self' | 'both'
  ) => Promise<{ imported: number }>;
  clearGoogleEvents: () => Promise<void>;
  clearGoogleCalendarEvents: (calendarId: string, color?: string, calendarName?: string) => Promise<void>;
  purgeIcalEvents: () => Promise<{ purgedCount: number }>;
  updateCalendarColor: (calendarId: string, newColor: string) => Promise<void>;
  removeCalendarFeed: (calendarId: string, summary?: string, color?: string) => Promise<void>;
  deduplicateEvents: () => Promise<{ deletedCount: number }>;
  deduplicateGoogleEvents: () => Promise<void>;
}

interface StoredCalendar {
  id: string;
  summary?: string;
  color: string;
  selected?: boolean;
}

const persistCalendarConfigs = (cals: Array<{ id: string; summary: string; color: string; visible: boolean }>) => {
  const mapped = cals.map(u => ({
    id: u.id,
    summary: u.summary,
    color: u.color,
    selected: u.visible
  }));
  const currentSaved = localStorage.getItem('slate_google_cals');
  const newJson = JSON.stringify(mapped);
  if (currentSaved === newJson) {
    return; // Avoid unnecessary Firestore profile writes and re-render cascades
  }
  localStorage.setItem('slate_google_cals', newJson);
  
  const authStore = useAuthStore.getState();
  if (authStore.user) {
    authStore.updateProfile({ calendarConfigs: mapped });
  }
};

export const useCalendarStore = create<CalendarState>((set, get) => {
  const getInitialGoogleCals = () => {
    const authStore = useAuthStore.getState();
    const userConfigs = authStore.user?.calendarConfigs;
    const legacyIds = ['primary', 'work-cal', 'family-cal', 'Primary Calendar', 'Work Projects', 'Family Brunch & Trips'];
    
    const result = [
      { id: 'brian-slate', summary: "Brian's Slate", color: '#3b82f6', visible: true },
      { id: 'chelsea-slate', summary: "Chelsea's Slate", color: '#ec4899', visible: true }
    ];

    const sourceConfigs = userConfigs && userConfigs.length > 0
      ? userConfigs
      : (() => {
          const saved = localStorage.getItem('slate_google_cals');
          if (saved) {
            try { return JSON.parse(saved) as StoredCalendar[]; } catch { /* ignore parse error */ }
          }
          return [];
        })();

    const filteredSource = sourceConfigs.filter(c => {
      if (legacyIds.includes(c.id) || legacyIds.includes(c.summary || '')) return false;
      const check = `${c.id} ${c.summary || ''}`.toLowerCase();
      if (check.includes('mvbc') || check.includes('ical') || check.includes('.ics') || check.includes('webcal') || check.includes('http:') || check.includes('https:')) return false;
      return true;
    });
    filteredSource.forEach(c => {
      const idx = result.findIndex(r => r.id === c.id);
      if (idx !== -1) {
        result[idx] = {
          ...result[idx],
          summary: c.summary || result[idx].summary,
          color: c.color || result[idx].color,
          visible: c.selected !== false
        };
      } else {
        result.push({
          id: c.id,
          summary: c.summary || c.id,
          color: c.color || '#3b82f6',
          visible: c.selected !== false
        });
      }
    });

    const mappedStorage = result.map(r => ({ id: r.id, summary: r.summary, color: r.color, selected: r.visible }));
    localStorage.setItem('slate_google_cals', JSON.stringify(mappedStorage));

    return result;
  };

  return {
    events: [],
    loading: true,
    selectedDate: new Date(),
    activeView: 'Month',
    showCreateEventModal: false,
    setShowCreateEventModal: (open) => set({ showCreateEventModal: open }),
    showGoogleEvents: true,
    googleCals: getInitialGoogleCals(),

    setShowGoogleEvents: (show) => set({ showGoogleEvents: show }),
    setGoogleCals: (cals) => {
      set({ googleCals: cals });
      persistCalendarConfigs(cals);
    },
    toggleCalendarVisibility: (id) => {
      set((state) => {
        const updated = state.googleCals.map(c => c.id === id ? { ...c, visible: !c.visible } : c);
        persistCalendarConfigs(updated);
        return { googleCals: updated };
      });
    },
    updateCalendarColor: async (calendarId, newColor) => {
      let updatedCals: Array<{ id: string; summary: string; color: string; visible: boolean }> = [];
      set((state) => {
        updatedCals = state.googleCals.map(c => c.id === calendarId ? { ...c, color: newColor } : c);
        persistCalendarConfigs(updatedCals);
        return { googleCals: updatedCals };
      });

      // Update color for all events belonging to this calendar in the database/store
      const relevantEvents = get().events.filter(e => e.googleCalendarId === calendarId);
      for (const e of relevantEvents) {
        await get().updateEvent(e.id, { color: newColor });
      }
    },
    removeCalendarFeed: async (calendarId: string, summary?: string, color?: string) => {
      // 1. Instantly remove from local state and update Firestore user profile (Optimistic UI)
      set((state) => {
        const updated = state.googleCals.filter(c => c.id !== calendarId && (!summary || c.summary !== summary));
        persistCalendarConfigs(updated);
        return { googleCals: updated };
      });

      // 2. Clear associated events from Firestore database in parallel
      await get().clearGoogleCalendarEvents(calendarId, color, summary);
    },
    syncGoogleCalsFromEvents: (googleEvents) => {
      const authStore = useAuthStore.getState();
      const userConfigs = authStore.user?.calendarConfigs;
      const saved = localStorage.getItem('slate_google_cals');
      let savedCals: StoredCalendar[] = [];
      if (userConfigs && userConfigs.length > 0) {
        savedCals = userConfigs;
      } else if (saved) {
        try {
          savedCals = JSON.parse(saved) as StoredCalendar[];
        } catch {
          // Empty catch
        }
      }

      set(state => {
        let changed = false;
        // Start from existing googleCals
        const updated = state.googleCals.map(c => {
          const sample = googleEvents.find(e => e.googleCalendarId === c.id || e.color === c.color);
          if (sample && sample.googleCalendarName && sample.googleCalendarName !== c.summary && (!c.summary || c.summary.startsWith('http') || c.summary === 'Imported Calendar')) {
            changed = true;
            return { ...c, summary: sample.googleCalendarName };
          }
          return c;
        });

        // Only add a calendar if it is explicitly in userConfigs / savedCals and not an external feed
        savedCals.forEach(sc => {
          if (!sc.id) return;
          const check = `${sc.id} ${sc.summary || ''}`.toLowerCase();
          if (check.includes('mvbc') || check.includes('ical') || check.includes('.ics') || check.includes('webcal') || check.includes('http:') || check.includes('https:')) return;
          const exists = updated.some(u => u.id === sc.id);
          if (!exists) {
            updated.push({
              id: sc.id,
              summary: sc.summary || sc.id,
              color: sc.color || '#3b82f6',
              visible: sc.selected !== false
            });
            changed = true;
          }
        });

        if (changed) {
          persistCalendarConfigs(updated);
        }

        return changed ? { googleCals: updated } : {};
      });
    },

    subscribeEvents: () => {
      set({ loading: true });
      return dbService.subscribe<CalendarEvent>('events', 
        (items) => {
          set({ events: items, loading: false });
        },
        undefined,
        () => {
          set({ loading: false });
        }
      );
    },

    setSelectedDate: (date) => set({ selectedDate: date }),
    setActiveView: (view) => set({ activeView: view }),

    addEvent: async (eventData) => {
    const authStore = useAuthStore.getState();
    const notificationStore = useNotificationStore.getState();
    const user = authStore.user;
    if (!user) return;

    const newEvent = {
      ...eventData,
      creatorId: user.uid,
      creatorName: user.name
    };

    const added = await dbService.add<Omit<CalendarEvent, 'id'>>('events', newEvent);

    // Notify partner
    if (eventData.assignee !== 'self' && authStore.partner) {
      await notificationStore.addNotification({
        recipientId: authStore.partner.uid,
        senderId: user.uid,
        senderName: user.name,
        title: '📅 New Event Created',
        description: `${user.name} created event "${eventData.title}" and assigned it to ${eventData.assignee === 'both' ? 'both of you' : 'you'}.`,
        type: 'cardAssigned',
        relatedId: added.id,
        relatedType: 'event'
      });
    }
  },

  updateEvent: async (id, data) => {
    const event = get().events.find(e => e.id === id);
    if (!event) return;

    const updated = { ...event, ...data };
    await dbService.set('events', id, updated);

    // Notify partner
    const authStore = useAuthStore.getState();
    const notificationStore = useNotificationStore.getState();
    const user = authStore.user;
    if (user && authStore.partner && event.assignee !== 'self') {
      await notificationStore.addNotification({
        recipientId: authStore.partner.uid,
        senderId: user.uid,
        senderName: user.name,
        title: '📅 Event Updated',
        description: `${user.name} updated the event "${event.title}".`,
        type: 'cardMoved',
        relatedId: id,
        relatedType: 'event'
      });
    }
  },

  deleteEvent: async (id) => {
    const { events } = get();
    const event = events.find(e => e.id === id);

    // Find all identical duplicates of this event (by id, googleEventId, or normalized title + day)
    const idsToDelete = [id];
    if (event) {
      const normTitle = (event.title || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const eventStart = new Date(event.start);
      const eventDay = isNaN(eventStart.getTime()) ? (event.start || '').slice(0, 10) : format(eventStart, 'yyyy-MM-dd');

      events.forEach(e => {
        if (e.id === id) return;
        // Same googleEventId -> duplicate
        if (event.googleEventId && e.googleEventId && e.googleEventId === event.googleEventId) {
          idsToDelete.push(e.id);
          return;
        }
        // Same normalized title and day date -> duplicate
        const eNormTitle = (e.title || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const eStart = new Date(e.start);
        const eDay = isNaN(eStart.getTime()) ? (e.start || '').slice(0, 10) : format(eStart, 'yyyy-MM-dd');
        if (normTitle && eNormTitle === normTitle && eventDay && eDay === eventDay) {
          idsToDelete.push(e.id);
        }
      });
    }

    // 1. Instantly update in-memory state so it immediately vanishes (optimistic UI)
    const deleteSet = new Set(idsToDelete);
    set(state => ({
      events: state.events.filter(e => !deleteSet.has(e.id))
    }));

    // 2. Perform atomic batch delete in Firestore
    await dbService.batchDelete('events', idsToDelete);

    // Notify partner
    const authStore = useAuthStore.getState();
    const notificationStore = useNotificationStore.getState();
    const user = authStore.user;
    if (user && event && authStore.partner && event.assignee !== 'self') {
      await notificationStore.addNotification({
        recipientId: authStore.partner.uid,
        senderId: user.uid,
        senderName: user.name,
        title: '🗑 Event Deleted',
        description: `${user.name} removed the event "${event.title}".`,
        type: 'system'
      });
    }
  },

  // Expanded recurring events for grid mapping
  getExpandedEvents: (startDate, endDate) => {
    const { events } = get();
    const expanded: CalendarEvent[] = [];

    events.forEach(event => {
      const start = parseISO(event.start);
      const end = parseISO(event.end);
      
      // If event doesn't recur or is single
      if (!event.recurring || event.recurring.frequency === 'none') {
        if (start <= endDate && end >= startDate) {
          expanded.push(event);
        }
        return;
      }

      // Handle recurring events expansion
      const freq = event.recurring.frequency;
      const interval = event.recurring.interval || 1;
      const until = event.recurring.until ? parseISO(event.recurring.until) : endDate;
      
      let currentStart = start;
      let currentEnd = end;
      let iterations = 0;
      
      // Limit iterations to prevent infinite loops (max 365)
      while (currentStart <= until && currentStart <= endDate && iterations < 365) {
        if (currentStart <= endDate && currentEnd >= startDate) {
          expanded.push({
            ...event,
            start: currentStart.toISOString(),
            end: currentEnd.toISOString()
          });
        }
        
        if (freq === 'daily') {
          currentStart = addDays(currentStart, interval);
          currentEnd = addDays(currentEnd, interval);
        } else if (freq === 'weekly') {
          currentStart = addWeeks(currentStart, interval);
          currentEnd = addWeeks(currentEnd, interval);
        } else if (freq === 'monthly') {
          currentStart = addMonths(currentStart, interval);
          currentEnd = addMonths(currentEnd, interval);
        }
        
        iterations++;
      }
    });

    // Sort events: allDay first, then chronologically by start time
    expanded.sort((a, b) => {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      return a.start.localeCompare(b.start);
    });

    return expanded;
  },

  // Legacy external stubs maintained for backwards compatibility
  importGoogleEvents: async () => {
    return { imported: 0, skipped: 0 };
  },

  syncIcalFeed: async () => {
    return { imported: 0 };
  },

  clearGoogleEvents: async () => {
    const authStore = useAuthStore.getState();
    const user = authStore.user;
    if (!user) return;

    const legacyEvents = get().events.filter(e => !!e.googleEventId && e.creatorId === user.uid);
    const ids = legacyEvents.map(e => e.id);
    const idSet = new Set(ids);
    set(state => ({ events: state.events.filter(e => !idSet.has(e.id)) }));
    await dbService.batchDelete('events', ids);
  },

  clearGoogleCalendarEvents: async (calendarId, color, calendarName) => {
    const targetId = calendarId ? calendarId.trim().toLowerCase() : '';
    const targetName = calendarName ? calendarName.trim().toLowerCase() : '';

    const matchedEvents = get().events.filter(e => {
      const eCalId = (e.googleCalendarId || '').trim().toLowerCase();
      const eCalName = (e.googleCalendarName || '').trim().toLowerCase();
      const eNotes = (e.notes || '').toLowerCase();

      if (targetId && (eCalId === targetId || eCalId.includes(targetId) || targetId.includes(eCalId))) return true;
      if (targetName && (eCalName === targetName || eCalName.includes(targetName) || eNotes.includes(targetName))) return true;
      if (color && e.color === color) return true;
      return false;
    });

    const matchedIds = matchedEvents.map(e => e.id);
    const idSet = new Set(matchedIds);
    set(state => ({
      events: state.events.filter(e => !idSet.has(e.id))
    }));

    await dbService.batchDelete('events', matchedIds);
  },

  purgeIcalEvents: async () => {
    const { events } = get();
    const icalEvents = events.filter(isIcalEvent);
    if (icalEvents.length === 0) {
      return { purgedCount: 0 };
    }

    const icalIds = icalEvents.map(e => e.id);
    const idSet = new Set(icalIds);

    // 1. Instantly remove from local store (optimistic UI)
    set(state => ({
      events: state.events.filter(e => !idSet.has(e.id))
    }));

    // 2. Perform atomic batch deletion from Firestore
    await dbService.batchDelete('events', icalIds);

    return { purgedCount: icalIds.length };
  },

  deduplicateEvents: async () => {
    const { events } = get();
    const uniqueEvents = new Map<string, CalendarEvent>();
    const toDelete: string[] = [];
    const toUpdate: CalendarEvent[] = [];

    // Prioritize keeping shared events ('both') or events with longer notes
    const sorted = [...events].sort((a, b) => {
      if (a.assignee === 'both' && b.assignee !== 'both') return -1;
      if (a.assignee !== 'both' && b.assignee === 'both') return 1;
      return (b.notes?.length || 0) - (a.notes?.length || 0);
    });

    sorted.forEach(e => {
      const normTitle = (e.title || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const startDate = new Date(e.start);
      const dateKey = isNaN(startDate.getTime())
        ? (e.start || '').slice(0, 10)
        : format(startDate, 'yyyy-MM-dd');

      // Deduplicate by normalized title and date day
      const key = `${normTitle}_${dateKey}`;
      const gKey = e.googleEventId ? `gid_${e.googleEventId}` : null;
      const existingKey = gKey && uniqueEvents.has(gKey) ? gKey : (uniqueEvents.has(key) ? key : null);

      if (existingKey) {
        const kept = uniqueEvents.get(existingKey)!;
        toDelete.push(e.id);

        let modified = false;
        // Upgrade to shared if duplicate has shared visibility
        if (e.assignee === 'both' && kept.assignee !== 'both') {
          kept.assignee = 'both';
          modified = true;
        }
        // If kept event is missing notes but duplicate has notes, copy notes
        if (!kept.notes && e.notes) {
          kept.notes = e.notes;
          modified = true;
        }
        if (modified && !toUpdate.some(u => u.id === kept.id)) {
          toUpdate.push(kept);
        }
      } else {
        uniqueEvents.set(key, { ...e });
        if (gKey) {
          uniqueEvents.set(gKey, { ...e });
        }
      }
    });

    if (toDelete.length === 0 && toUpdate.length === 0) {
      return { deletedCount: 0 };
    }

    // 1. Instantly update in-memory state
    const deleteSet = new Set(toDelete);
    set(state => ({
      events: state.events
        .filter(e => !deleteSet.has(e.id))
        .map(e => {
          const updated = toUpdate.find(u => u.id === e.id);
          return updated || e;
        })
    }));

    // 2. Perform batched updates to Firestore
    for (const item of toUpdate) {
      await dbService.set('events', item.id, item).catch(err => console.error("Failed to update merged event:", item.id, err));
    }

    // 3. Perform batched atomic deletes from Firestore
    await dbService.batchDelete('events', toDelete);

    return { deletedCount: toDelete.length };
  },

  deduplicateGoogleEvents: async () => {
    await get().deduplicateEvents();
  }
}});

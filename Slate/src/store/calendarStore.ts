import { create } from 'zustand';
import { dbService } from '../firebase/db';
import { addDays, addWeeks, addMonths, parseISO } from 'date-fns';
import { useAuthStore } from './authStore';
import { useNotificationStore } from './notificationStore';
import { parseIcalData } from '../utils/icalParser';

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
  clearGoogleCalendarEvents: (calendarId: string, color?: string) => Promise<void>;
  updateCalendarColor: (calendarId: string, newColor: string) => Promise<void>;
  removeCalendarFeed: (calendarId: string) => Promise<void>;
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
  localStorage.setItem('slate_google_cals', JSON.stringify(mapped));
  
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

    const filteredSource = sourceConfigs.filter(c => !legacyIds.includes(c.id) && !legacyIds.includes(c.summary || ''));
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
    removeCalendarFeed: async (calendarId: string) => {
      // 1. Instantly remove from local state and update Firestore user profile (Optimistic UI)
      set((state) => {
        const updated = state.googleCals.filter(c => c.id !== calendarId);
        persistCalendarConfigs(updated);
        return { googleCals: updated };
      });

      // 2. Clear associated events from Firestore database in parallel
      await get().clearGoogleCalendarEvents(calendarId);
    },
    syncGoogleCalsFromEvents: (googleEvents) => {
      const uniqueCalIds = Array.from(new Set(googleEvents.map(e => e.googleCalendarId || e.color).filter(Boolean)));
      const saved = localStorage.getItem('slate_google_cals');
      let savedCals: StoredCalendar[] = [];
      if (saved) {
        try {
          savedCals = JSON.parse(saved) as StoredCalendar[];
        } catch {
          // Empty catch
        }
      }

      set(state => {
        const updated = [...state.googleCals];
        let changed = false;
        
        uniqueCalIds.forEach(calId => {
          const match = savedCals.find((sc) => sc.id === calId || sc.color === calId);
          if (saved) {
            if (!match || !match.selected) {
              return;
            }
          }

          const existingIndex = updated.findIndex(c => c.id === calId || c.color === calId);
          const sampleEvent = googleEvents.find(e => e.googleCalendarId === calId || e.color === calId);
          const fallbackName = sampleEvent?.googleCalendarName || 'Imported Calendar';

          if (existingIndex === -1) {
            const customName = (match && match.summary) ? match.summary : fallbackName;
            const calColor = match ? match.color : (calId.startsWith('#') ? calId : '#3b82f6');
            updated.push({
              id: match?.id || calId,
              summary: customName,
              color: calColor,
              visible: true
            });
            changed = true;
          } else {
            const currentItem = updated[existingIndex];
            const newSummary = (match && match.summary) ? match.summary : (sampleEvent?.googleCalendarName || currentItem.summary);
            const newColor = (match && match.color) ? match.color : currentItem.color;
            const newId = match ? match.id : currentItem.id;
            
            if (currentItem.summary !== newSummary || currentItem.color !== newColor || currentItem.id !== newId) {
              updated[existingIndex] = {
                ...currentItem,
                id: newId,
                summary: newSummary,
                color: newColor
              };
              changed = true;
            }
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
    const event = get().events.find(e => e.id === id);
    await dbService.delete('events', id);

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

  importGoogleEvents: async (accessToken, calendarConfigs) => {
    const authStore = useAuthStore.getState();
    const user = authStore.user;
    if (!user) throw new Error('Unauthenticated');

    const now = new Date();
    let imported = 0;
    let skipped = 0;

    const existingEvents = get().events;
    const palette = ['#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#3b82f6', '#ec4899', '#64748b'];

    for (let i = 0; i < calendarConfigs.length; i++) {
      const config = calendarConfigs[i];
      const calColor = config.color || palette[i % palette.length];
      let calName = config.summary || (config.id === 'primary' ? 'Primary Calendar' : config.id === 'work-cal' ? 'Work Projects' : config.id === 'family-cal' ? 'Family Brunch' : config.id);
      let googleEvents = [];

      try {
        if (accessToken === 'mock-google-token-xyz123') {
          if (config.id === 'primary') {
            googleEvents = [
              {
                id: 'google-mock-1',
                summary: '✈️ Anniversary Trip Planning',
                description: 'Discuss flights and hotel booking options.',
                start: { dateTime: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 14, 0).toISOString() },
                end: { dateTime: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 15, 30).toISOString() }
              },
              {
                id: 'google-mock-2',
                summary: '🍣 Romantic Dinner Date',
                description: 'Reservation at Sushi House.',
                start: { dateTime: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 4, 19, 0).toISOString() },
                end: { dateTime: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 4, 21, 0).toISOString() }
              }
            ];
          } else if (config.id === 'work-cal') {
            googleEvents = [
              {
                id: 'google-mock-work-1',
                summary: '💻 React & Vite Dev Sync',
                description: 'Discuss Slate project frontend refinements.',
                start: { dateTime: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0).toISOString() },
                end: { dateTime: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 11, 0).toISOString() }
              }
            ];
          } else if (config.id === 'family-cal') {
            googleEvents = [
              {
                id: 'google-mock-fam-1',
                summary: '🥞 Sunday Family Brunch',
                description: 'Gathering at grandma\'s house.',
                start: { dateTime: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5, 11, 0).toISOString() },
                end: { dateTime: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5, 13, 0).toISOString() }
              }
            ];
          }
        } else {
          // Query window: from 1 month ago to 2 months in the future
          const timeMin = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString();
          const timeMax = new Date(now.getFullYear(), now.getMonth() + 2, now.getDate()).toISOString();

          const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
              config.id
            )}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(
              timeMax
            )}&singleEvents=true&maxResults=250`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`
              }
            }
          );

          if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Failed to fetch calendar ${config.id}: ${response.statusText} - ${errBody}`);
          }

          const data = await response.json();
          googleEvents = data.items || [];
          if (data.summary && (!config.summary || config.summary === config.id)) {
            calName = data.summary;
          }
        }

        const activeGoogleEventIds = new Set<string>();

        for (const item of googleEvents) {
          activeGoogleEventIds.add(item.id);
          const startStr = item.start.dateTime || item.start.date;
          const endStr = item.end.dateTime || item.end.date;
          if (!startStr || !endStr) continue;

          const isAllDayEvent = !item.start.dateTime;
          let startDate: Date;
          let endDate: Date;

          if (isAllDayEvent) {
            startDate = new Date(`${item.start.date}T00:00:00`);
            endDate = new Date(new Date(`${item.end.date}T00:00:00`).getTime() - 1000);
          } else {
            startDate = new Date(startStr);
            endDate = new Date(endStr);
          }

          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) continue;

          const startISO = startDate.toISOString();
          const endISO = endDate.toISOString();
          const duration = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
          const titleText = item.summary || 'Untitled Google Event';
          const notesText = item.description || 'Imported from Google Calendar';

          // Check if event already exists by googleEventId
          const existingEvent = existingEvents.find(e => e.googleEventId === item.id);

          if (existingEvent) {
            // Check if updates are needed
            const startChanged = existingEvent.start !== startISO;
            const endChanged = existingEvent.end !== endISO;
            const titleChanged = existingEvent.title !== titleText;
            const notesChanged = (existingEvent.notes || '') !== notesText;
            const nameChanged = existingEvent.googleCalendarName !== calName;

            if (startChanged || endChanged || titleChanged || notesChanged || nameChanged) {
              await dbService.set('events', existingEvent.id, {
                ...existingEvent,
                title: titleText,
                start: startISO,
                end: endISO,
                duration,
                allDay: isAllDayEvent,
                notes: notesText,
                googleCalendarName: calName
              });
              imported++;
            } else {
              skipped++;
            }
          } else {
            // Check if there is an existing event matching by title and time to associate
            const overlapEvent = existingEvents.find(e => e.title === titleText && e.start === startISO);
            if (overlapEvent) {
              await dbService.set('events', overlapEvent.id, {
                ...overlapEvent,
                googleEventId: item.id,
                googleCalendarId: config.id,
                googleCalendarName: calName
              });
              skipped++;
            } else {
              // Add new event
              const newEvent = {
                title: titleText,
                start: startISO,
                end: endISO,
                duration,
                allDay: isAllDayEvent,
                color: calColor,
                notes: notesText,
                assignee: config.visibility,
                googleEventId: item.id,
                googleCalendarId: config.id,
                googleCalendarName: calName,
                creatorId: user.uid,
                creatorName: user.name
              };
              await dbService.add('events', newEvent);
              imported++;
            }
          }
        }

        // Deletion handling: Remove events in Slate that were deleted from Google Calendar
        const staleEvents = existingEvents.filter(
          e => e.googleCalendarId === config.id && e.creatorId === user.uid && e.googleEventId && !activeGoogleEventIds.has(e.googleEventId)
        );
        for (const se of staleEvents) {
          await dbService.delete('events', se.id);
        }

      } catch (err) {
        console.error(`Error importing events for calendar ${config.id}:`, err);
      }
    }

    await get().deduplicateGoogleEvents();
    return { imported, skipped };
  },

  syncIcalFeed: async (feedUrl, feedName, color, visibility) => {
    const authStore = useAuthStore.getState();
    const user = authStore.user;
    if (!user) throw new Error('Unauthenticated');

    let targetUrl = feedUrl.trim();
    if (targetUrl.startsWith('webcal://')) {
      targetUrl = 'https://' + targetUrl.slice(9);
    }
    targetUrl = targetUrl.replace(/%40/gi, '@');

    let icalText = '';
    let success = false;
    let lastErrReason = '';

    // Step 1: Cloud Function fetcher (Server-to-server, bypasses browser CORS)
    try {
      const cfUrl = `https://us-central1-kulpslate.cloudfunctions.net/fetchIcal?url=${encodeURIComponent(targetUrl)}`;
      const cfResp = await fetch(cfUrl);
      if (cfResp.ok) {
        const text = await cfResp.text();
        if (text && text.includes('BEGIN:VCALENDAR')) {
          icalText = text;
          success = true;
        } else {
          lastErrReason = 'Response did not contain valid VCALENDAR data';
        }
      } else {
        const errBody = await cfResp.text();
        lastErrReason = `HTTP ${cfResp.status}: ${errBody}`;
      }
    } catch (err) {
      lastErrReason = err instanceof Error ? err.message : String(err);
    }

    // Step 2: Direct client fetch
    if (!success) {
      try {
        const resp = await fetch(targetUrl);
        if (resp.ok) {
          const text = await resp.text();
          if (text && text.includes('BEGIN:VCALENDAR')) {
            icalText = text;
            success = true;
          }
        }
      } catch {
        // Direct fetch blocked by CORS
      }
    }

    // Step 3: Fallback CORS proxies
    if (!success) {
      const fallbackProxies = [
        (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
        (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
        (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
      ];

      for (const getProxyUrl of fallbackProxies) {
        try {
          const pUrl = getProxyUrl(targetUrl);
          const pResp = await fetch(pUrl);
          if (pResp.ok) {
            const text = await pResp.text();
            if (text && text.includes('BEGIN:VCALENDAR')) {
              icalText = text;
              success = true;
              break;
            }
          }
        } catch {
          // Continue to next proxy
        }
      }
    }

    if (!success || !icalText || !icalText.includes('BEGIN:VCALENDAR')) {
      throw new Error(`Could not fetch iCal feed (${lastErrReason || 'Verification failed'}).`);
    }

    const parsedEvents = parseIcalData(icalText);
    const existingEvents = get().events;
    let imported = 0;

    const writeTasks: Array<() => Promise<void>> = [];

    for (const item of parsedEvents) {
      const startISO = item.start.toISOString();
      const endISO = item.end.toISOString();
      const duration = Math.round((item.end.getTime() - item.start.getTime()) / (1000 * 60));
      const existing = existingEvents.find(e => e.googleEventId === item.uid);

      if (!existing) {
        const newEvt = {
          title: item.summary || 'Untitled Event',
          start: startISO,
          end: endISO,
          duration: duration > 0 ? duration : 60,
          allDay: item.allDay,
          color: color || '#4f46e5',
          notes: item.description || `Live iCal feed: ${feedName}`,
          assignee: visibility || 'both',
          googleEventId: item.uid,
          googleCalendarId: feedUrl,
          googleCalendarName: feedName,
          creatorId: user.uid,
          creatorName: user.name
        };
        writeTasks.push(async () => {
          await dbService.add('events', newEvt);
        });
        imported++;
      } else {
        if (existing.title !== item.summary || existing.start !== startISO || existing.end !== endISO) {
          writeTasks.push(async () => {
            await dbService.set('events', existing.id, {
              ...existing,
              title: item.summary,
              start: startISO,
              end: endISO,
              duration: duration > 0 ? duration : 60,
              allDay: item.allDay
            });
          });
          imported++;
        }
      }
    }

    const CHUNK_SIZE = 25;
    for (let i = 0; i < writeTasks.length; i += CHUNK_SIZE) {
      const chunk = writeTasks.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map(fn => fn().catch(err => console.error('iCal event write error:', err))));
    }

    await get().deduplicateGoogleEvents();
    return { imported };
  },

  clearGoogleEvents: async () => {
    const authStore = useAuthStore.getState();
    const user = authStore.user;
    if (!user) return;

    const googleEvents = get().events.filter(e => !!e.googleEventId && e.creatorId === user.uid);
    const CHUNK_SIZE = 25;
    for (let i = 0; i < googleEvents.length; i += CHUNK_SIZE) {
      const chunk = googleEvents.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map(e => dbService.delete('events', e.id).catch(() => {})));
    }
  },

  clearGoogleCalendarEvents: async (calendarId, color) => {
    const googleEvents = get().events.filter(e => 
      !!e.googleEventId && (e.googleCalendarId === calendarId || (!!color && e.color === color))
    );
    const CHUNK_SIZE = 25;
    for (let i = 0; i < googleEvents.length; i += CHUNK_SIZE) {
      const chunk = googleEvents.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map(e => dbService.delete('events', e.id).catch(() => {})));
    }
  },

  deduplicateGoogleEvents: async () => {
    const { events } = get();
    const uniqueEvents = new Map<string, CalendarEvent>();
    const toDelete: string[] = [];

    const sorted = [...events].sort((a, b) => {
      if (a.googleEventId && !b.googleEventId) return -1;
      if (!a.googleEventId && b.googleEventId) return 1;
      return 0;
    });

    sorted.forEach(e => {
      const key = e.googleEventId ? `${e.googleEventId}_${e.start}` : `${e.title}_${e.start}`;
      if (uniqueEvents.has(key)) {
        toDelete.push(e.id);
      } else {
        uniqueEvents.set(key, e);
      }
    });

    const CHUNK_SIZE = 25;
    for (let i = 0; i < toDelete.length; i += CHUNK_SIZE) {
      const chunk = toDelete.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map(id => dbService.delete('events', id).catch(err => console.error("Failed to delete duplicate event:", id, err))));
    }
  }
}});

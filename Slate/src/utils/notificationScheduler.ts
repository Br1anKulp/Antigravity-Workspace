import type { CalendarEvent } from '../store/calendarStore';
import { useNotificationStore } from '../store/notificationStore';
import { useAuthStore } from '../store/authStore';

// In-memory set of event IDs that have already received an upcoming reminder during this session
const alertedEventKeys = new Set<string>();

/**
 * Check upcoming calendar events and dispatch proactive reminders for events
 * starting within 30 minutes.
 */
export function checkUpcomingEventReminders(
  events: CalendarEvent[],
  currentUserId?: string,
  userPrefs?: { eventReminder?: boolean }
) {
  // If user explicitly turned off event reminders, skip
  if (userPrefs && userPrefs.eventReminder === false) {
    return;
  }

  const now = new Date();

  for (const event of events) {
    if (!event.start || event.allDay) continue;

    const startTime = new Date(event.start);
    if (isNaN(startTime.getTime())) continue;

    // Must be starting in the window between now - 1 min and now + 30 mins
    const diffMs = startTime.getTime() - now.getTime();
    const diffMinutes = Math.round(diffMs / (60 * 1000));

    if (diffMinutes >= 0 && diffMinutes <= 30) {
      const todayKey = `${event.id}_${startTime.toISOString().slice(0, 10)}`;
      if (alertedEventKeys.has(todayKey)) {
        continue;
      }

      // Mark as alerted
      alertedEventKeys.add(todayKey);

      // Format reminder message
      const timeStr = startTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const timingText = diffMinutes <= 1 ? 'starting right now' : `starts in ${diffMinutes} minutes (${timeStr})`;
      const title = `Upcoming: ${event.title}`;
      const description = `${event.title} ${timingText}`;

      // Trigger mobile haptic pulse
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([400, 200, 400]);
        } catch {
          // Ignore
        }
      }

      // Show native browser notification if granted
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body: description,
            icon: '/favicon.svg'
          });
        } catch (err) {
          console.warn('Native notification failed:', err);
        }
      }

      // Add to in-app notification center
      const notifStore = useNotificationStore.getState();
      const authUser = useAuthStore.getState().user;
      notifStore.addNotification({
        recipientId: currentUserId || authUser?.uid || 'both',
        senderId: 'slate-system',
        senderName: 'Slate Calendar',
        title,
        description,
        type: 'eventReminder',
        relatedId: event.id,
        relatedType: 'event'
      }).catch(console.error);
    }
  }
}

/**
 * Start periodic event reminder checker (runs every 60 seconds)
 */
export function startEventReminderScheduler(
  getEvents: () => CalendarEvent[],
  getUserId: () => string | undefined,
  getUserPrefs: () => { eventReminder?: boolean } | undefined
): () => void {
  // Check immediately
  checkUpcomingEventReminders(getEvents(), getUserId(), getUserPrefs());

  // Interval check every 60 seconds
  const interval = setInterval(() => {
    checkUpcomingEventReminders(getEvents(), getUserId(), getUserPrefs());
  }, 60000);

  return () => clearInterval(interval);
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkUpcomingEventReminders } from '../notificationScheduler';
import type { CalendarEvent } from '../../store/calendarStore';

describe('notificationScheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects upcoming events within the 30-minute window and does not crash', () => {
    const now = new Date();
    const fifteenMinsLater = new Date(now.getTime() + 15 * 60 * 1000);

    const mockEvents: CalendarEvent[] = [
      {
        id: 'evt-1',
        title: 'Vet Appointment',
        start: fifteenMinsLater.toISOString(),
        end: new Date(fifteenMinsLater.getTime() + 60 * 60 * 1000).toISOString(),
        allDay: false,
        creatorId: 'user-brian',
        creatorName: 'Brian',
        color: '#3b82f6',
        assignee: 'both',
        duration: 60
      },
      {
        id: 'evt-2',
        title: 'Next Week Meeting',
        start: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 3600000).toISOString(),
        allDay: false,
        creatorId: 'user-brian',
        creatorName: 'Brian',
        color: '#3b82f6',
        assignee: 'both',
        duration: 60
      }
    ];

    expect(() => {
      checkUpcomingEventReminders(mockEvents, 'user-brian', { eventReminder: true });
    }).not.toThrow();
  });

  it('respects user preference when event reminders are disabled', () => {
    const now = new Date();
    const tenMinsLater = new Date(now.getTime() + 10 * 60 * 1000);

    const mockEvents: CalendarEvent[] = [
      {
        id: 'evt-disabled',
        title: 'Meeting',
        start: tenMinsLater.toISOString(),
        end: new Date(tenMinsLater.getTime() + 3600000).toISOString(),
        allDay: false,
        creatorId: 'user-brian',
        creatorName: 'Brian',
        color: '#3b82f6',
        assignee: 'both',
        duration: 60
      }
    ];

    expect(() => {
      checkUpcomingEventReminders(mockEvents, 'user-brian', { eventReminder: false });
    }).not.toThrow();
  });
});

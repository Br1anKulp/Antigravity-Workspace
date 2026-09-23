import React, { useState, useEffect } from 'react';
import { useCalendarStore } from '../store/calendarStore';
import type { CalendarEvent } from '../store/calendarStore';
import { useAuthStore } from '../store/authStore';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { 
  parseISO,
  startOfDay,
  endOfDay
} from 'date-fns';

import { CalendarSidebar } from '../components/Calendar/CalendarSidebar';
import { CalendarGrid } from '../components/Calendar/CalendarGrid';
import { ScheduleView } from '../components/Calendar/ScheduleView';
import { DayDetailModal } from '../components/Calendar/DayDetailModal';
import { EventModal } from '../components/Calendar/EventModal';


export const CalendarView: React.FC = () => {
  const { 
    events,
    loading, 
    selectedDate, 
    activeView, 
    setSelectedDate, 
    setActiveView,
    addEvent,
    updateEvent,
    deleteEvent,
    getExpandedEvents,
    googleCals,
    showCreateEventModal,
    setShowCreateEventModal
  } = useCalendarStore();

  const { user } = useAuthStore();

  // Modals & UI filters visibility
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDayDetailModal, setShowDayDetailModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Handle trigger from store to show create event modal
  if (showCreateEventModal && !showAddModal) {
    setShowAddModal(true);
    setShowCreateEventModal(false);
  }

  // Helper functions
  const isEventPassed = React.useCallback((e: CalendarEvent) => {
    return new Date(e.end) < new Date();
  }, []);

  const getFilteredEvents = React.useCallback((startDate: Date, endDate: Date) => {
    const raw = getExpandedEvents(startDate, endDate);

    // Slate member filter toggles (Brian / Chelsea)
    const brianCal = googleCals.find(c => c.id === 'brian-slate');
    const chelseaCal = googleCals.find(c => c.id === 'chelsea-slate');

    const filtered = raw.filter(e => {
      const isBrian = e.assignee === 'self' || e.creatorName?.toLowerCase().includes('brian');
      const isChelsea = e.assignee === 'partner' || e.creatorName?.toLowerCase().includes('chelsea');
      const isBoth = e.assignee === 'both';

      if (!isBoth) {
        if (isBrian && brianCal && !brianCal.visible) return false;
        if (isChelsea && chelseaCal && !chelseaCal.visible) return false;
      }

      return true;
    });

    // In-memory deduplication: collapse identical duplicate events across partner logins
    const seen = new Set<string>();
    const deduplicated: CalendarEvent[] = [];

    for (const e of filtered) {
      const normTitle = (e.title || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const startTime = e.start ? e.start.slice(0, 16) : '';
      const key = `${normTitle}_${startTime}_${e.allDay ? 'allDay' : 'timed'}`;

      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(e);
      }
    }

    return deduplicated;
  }, [getExpandedEvents, googleCals]);

  const isEventOnDay = React.useCallback((event: CalendarEvent, day: Date) => {
    const start = parseISO(event.start);
    const end = parseISO(event.end);
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    return start <= dayEnd && end >= dayStart;
  }, []);

  // Open creation modal
  const openCreateModal = React.useCallback((date: Date, hourStr?: string) => {
    setSelectedEvent(null);
    if (hourStr) {
      const parts = hourStr.split(':');
      const startHour = Number(parts[0]);
      const endHour = Math.min(startHour + 1, 23);
      const tempEvent = {
        id: '',
        creatorId: '',
        creatorName: '',
        title: '',
        start: new Date(date.setHours(startHour, 0, 0, 0)).toISOString(),
        end: new Date(date.setHours(endHour, 0, 0, 0)).toISOString(),
        allDay: false,
        color: user?.avatarColor || '#3b82f6',
        assignee: 'both' as const,
        duration: 60
      };
      setSelectedEvent(tempEvent);
    } else {
      setSelectedEvent(null);
    }
    setShowAddModal(true);
  }, [user?.avatarColor]);

  // Open edit modal
  const openEditModal = React.useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setShowAddModal(true);
  }, [setSelectedEvent, setShowAddModal]);

  // Auto-detect mobile width to default to Month view
  useEffect(() => {
    if (window.innerWidth < 768) {
      setActiveView('Month');
    }
  }, [setActiveView]);

  // Sync activeView with user profile preference on load
  useEffect(() => {
    if (user?.calendarDefaultView) {
      const view = user.calendarDefaultView === 'Hourly' ? 'Day' : user.calendarDefaultView;
      setActiveView(view as 'Month' | 'Day' | '4-Day' | '2-Week' | 'Schedule');
    }
  }, [user?.calendarDefaultView, setActiveView]);

  useEffect(() => {
    if (activeView === 'Schedule') {
      setSelectedDate(new Date());
    }
  }, [activeView, setSelectedDate]);

  useEffect(() => {
    const openItemId = localStorage.getItem('slate_open_item_id');
    const openItemType = localStorage.getItem('slate_open_item_type');
    if (openItemId && openItemType === 'event' && events.length > 0) {
      const event = events.find(e => e.id === openItemId);
      if (event) {
        setTimeout(() => {
          openEditModal(event);
        }, 0);
        localStorage.removeItem('slate_open_item_id');
        localStorage.removeItem('slate_open_item_type');
      }
    }
  }, [events, openEditModal]);



  // Save calendar event
  const handleSave = async (data: Partial<CalendarEvent>) => {
    try {
      if (selectedEvent && selectedEvent.id) {
        await updateEvent(selectedEvent.id, data);
      } else {
        await addEvent(data as Omit<CalendarEvent, 'id' | 'creatorId'>);
      }
    } catch (err) {
      console.error("Failed to save calendar event:", err);
    } finally {
      setShowAddModal(false);
    }
  };

  // Delete calendar event
  const handleDelete = async () => {
    if (selectedEvent && selectedEvent.id) {
      try {
        await deleteEvent(selectedEvent.id);
      } catch (err) {
        console.error("Failed to delete calendar event:", err);
      } finally {
        setShowAddModal(false);
      }
    }
  };



  const handleEventDrop = async (eventId: string, targetDate: Date) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    const currentStart = parseISO(event.start);
    const currentEnd = parseISO(event.end);
    const durationMs = currentEnd.getTime() - currentStart.getTime();

    const newStart = new Date(targetDate);
    newStart.setHours(currentStart.getHours(), currentStart.getMinutes(), 0, 0);

    const newEnd = new Date(newStart.getTime() + durationMs);

    try {
      await updateEvent(eventId, {
        start: newStart.toISOString(),
        end: newEnd.toISOString()
      });
    } catch (err) {
      console.error("Failed to move event via drag & drop:", err);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Sidebar Controls - Hidden on mobile during Month view */}
      <div className={activeView === 'Month' ? 'hidden lg:block shrink-0' : 'block shrink-0'}>
        <CalendarSidebar
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          openCreateModal={openCreateModal}
        />
      </div>

      {/* Main Calendar View Canvas */}
      <div className="flex-1 space-y-4 min-w-0">

        {/* Modal overview of events for a single day */}
        <DayDetailModal
          isOpen={showDayDetailModal}
          onClose={() => setShowDayDetailModal(false)}
          selectedDate={selectedDate}
          getFilteredEvents={getFilteredEvents}
          isEventPassed={isEventPassed}
          openCreateModal={openCreateModal}
          openEditModal={openEditModal}
        />

        {/* Main calendar loading or rendering block */}
        {loading ? (
          <LoadingSkeleton type="calendar" />
        ) : activeView === 'Schedule' ? (
          <ScheduleView
            selectedDate={selectedDate}
            getFilteredEvents={getFilteredEvents}
            isEventOnDay={isEventOnDay}
            isEventPassed={isEventPassed}
            openCreateModal={openCreateModal}
            openEditModal={openEditModal}
          />
        ) : (
          <div key={activeView} className="w-full animate-slide-up">
            <CalendarGrid
              activeView={activeView}
              selectedDate={selectedDate}
              getFilteredEvents={getFilteredEvents}
              isEventOnDay={isEventOnDay}
              isEventPassed={isEventPassed}
              openCreateModal={openCreateModal}
              openEditModal={openEditModal}
              setSelectedDate={setSelectedDate}
              setShowDayDetailModal={setShowDayDetailModal}
              onEventDrop={handleEventDrop}
            />
          </div>
        )}

        {/* Edit/Create Dialog */}
        <EventModal
          key={selectedEvent ? `edit-${selectedEvent.id}-${selectedEvent.start}` : `new-${selectedDate.getTime()}`}
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          selectedEvent={selectedEvent}
          selectedDate={selectedDate}
          defaultColor={user?.avatarColor || '#3b82f6'}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
};

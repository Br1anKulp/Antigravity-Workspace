import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EventModal } from '../EventModal';
import { useCalendarStore } from '../../../store/calendarStore';
import { parseISO, format } from 'date-fns';

describe('EventModal Recurrence Options & Back Handler', () => {
  const baseDate = new Date('2026-10-22T09:00:00.000Z');

  it('renders recurrence end options when recurring frequency is selected', () => {
    render(
      <EventModal
        isOpen={true}
        onClose={vi.fn()}
        selectedEvent={null}
        selectedDate={baseDate}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // Initially, end options are not rendered when frequency is 'none'
    expect(screen.queryByLabelText(/ends/i)).toBeNull();

    // Select 'Weekly' recurrence
    const freqSelect = screen.getByLabelText(/recurring event/i);
    fireEvent.change(freqSelect, { target: { value: 'weekly' } });

    // Ends dropdown should now be rendered
    expect(screen.getByLabelText(/ends/i)).toBeInTheDocument();
  });

  it('calculates until date and submits when ending on specific date', () => {
    const handleSave = vi.fn();
    render(
      <EventModal
        isOpen={true}
        onClose={vi.fn()}
        selectedEvent={null}
        selectedDate={baseDate}
        onSave={handleSave}
        onDelete={vi.fn()}
      />
    );

    // Title
    fireEvent.change(screen.getByPlaceholderText(/event name/i), {
      target: { value: 'Team Retrospective' }
    });

    // Select weekly
    fireEvent.change(screen.getByLabelText(/recurring event/i), {
      target: { value: 'weekly' }
    });

    // Select 'On Specific Date'
    fireEvent.change(screen.getByLabelText(/ends/i), {
      target: { value: 'date' }
    });

    // Pick end date
    const endDateInput = screen.getByLabelText(/end date/i);
    fireEvent.change(endDateInput, { target: { value: '2026-11-26' } });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(handleSave).toHaveBeenCalledTimes(1);
    const savedData = handleSave.mock.calls[0][0];
    expect(savedData.recurring).toBeDefined();
    expect(savedData.recurring.frequency).toBe('weekly');
    expect(savedData.recurring.endType).toBe('date');
    expect(savedData.recurring.until).toBeDefined();
    expect(format(parseISO(savedData.recurring.until), 'yyyy-MM-dd')).toBe('2026-11-26');
  });

  it('calculates until date and displays preview when ending after number of weeks', () => {
    const handleSave = vi.fn();
    render(
      <EventModal
        isOpen={true}
        onClose={vi.fn()}
        selectedEvent={null}
        selectedDate={baseDate}
        onSave={handleSave}
        onDelete={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/event name/i), {
      target: { value: 'Weekly Workout' }
    });

    fireEvent.change(screen.getByLabelText(/recurring event/i), {
      target: { value: 'weekly' }
    });

    // Select 'After Number of Weeks'
    fireEvent.change(screen.getByLabelText(/ends/i), {
      target: { value: 'weeks' }
    });

    // Change weeks to 6
    const weeksInput = screen.getByLabelText(/number of weeks/i);
    fireEvent.change(weeksInput, { target: { value: '6' } });

    // Check preview text
    expect(screen.getByText(/repeats until/i)).toBeInTheDocument();

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(handleSave).toHaveBeenCalledTimes(1);
    const savedData = handleSave.mock.calls[0][0];
    expect(savedData.recurring.frequency).toBe('weekly');
    expect(savedData.recurring.endType).toBe('weeks');
    expect(savedData.recurring.endWeeks).toBe(6);
    expect(savedData.recurring.until).toBeDefined();
  });

  it('closes modal when Android back button (popstate) event is triggered', () => {
    const handleClose = vi.fn();
    render(
      <EventModal
        isOpen={true}
        onClose={handleClose}
        selectedEvent={null}
        selectedDate={baseDate}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // Simulate system/Android back button navigation
    window.dispatchEvent(new PopStateEvent('popstate', { state: { slateModal: 'event-modal' } }));

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('properly truncates expanded recurring events in calendarStore using until', () => {
    const startStr = '2026-10-01T10:00:00.000Z';
    const endStr = '2026-10-01T11:00:00.000Z';
    const untilStr = '2026-10-15T23:59:59.999Z';

    const testEvent = {
      id: 'test-recur-1',
      title: 'Bi-Weekly Sync',
      start: startStr,
      end: endStr,
      duration: 60,
      color: '#3b82f6',
      assignee: 'both' as const,
      creatorId: 'user1',
      creatorName: 'Brian',
      recurring: {
        frequency: 'weekly' as const,
        interval: 1,
        endType: 'date' as const,
        until: untilStr
      }
    };

    useCalendarStore.setState({ events: [testEvent] });

    // Expand across the entire month of October 2026
    const expanded = useCalendarStore.getState().getExpandedEvents(
      new Date('2026-10-01T00:00:00.000Z'),
      new Date('2026-10-31T23:59:59.999Z')
    );

    // Weekly occurrences on Oct 1, Oct 8, Oct 15 -> should NOT include Oct 22 or Oct 29
    expect(expanded.length).toBe(3);
    const startDates = expanded.map(e => e.start.slice(0, 10));
    expect(startDates).toEqual(['2026-10-01', '2026-10-08', '2026-10-15']);
  });
});

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { TodayBriefing } from '../TodayBriefing';
import { useAuthStore } from '../../../store/authStore';
import { useMilestonesStore, DEFAULT_RETIREMENT_MILESTONE } from '../../../store/milestonesStore';

describe('TodayBriefing Component', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      user: {
        uid: 'user-brian',
        email: 'brian.k.kulp@gmail.com',
        name: 'Brian',
        avatarColor: '#3b82f6',
        avatarEmoji: '⚡',
        calendarDefaultView: 'Month',
        notificationPreferences: {
          cardAssigned: true,
          cardMoved: true,
          commentAdded: true,
          dueDateReminder: true,
          cardCompleted: true,
          wipLimitExceeded: true,
          eventReminder: true
        }
      }
    });

    useMilestonesStore.setState({
      milestones: [
        {
          id: 'brian-retirement-2029',
          ...DEFAULT_RETIREMENT_MILESTONE,
          createdAt: new Date().toISOString()
        }
      ],
      loading: false
    });
  });

  it('renders greeting with user name and retirement countdown', () => {
    render(<TodayBriefing />);
    
    expect(screen.getAllByText(/Brian/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Retirement/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/days/i).length).toBeGreaterThan(0);
  });

  it('allows collapsing and expanding the briefing card', () => {
    render(<TodayBriefing />);

    const collapseButton = screen.getByLabelText(/Collapse briefing/i);
    expect(collapseButton).toBeInTheDocument();

    fireEvent.click(collapseButton);

    // After collapse, the label switches to expand
    expect(screen.getByLabelText(/Expand briefing/i)).toBeInTheDocument();
    expect(localStorage.getItem('slate_briefing_collapsed')).toBe('true');
  });
});

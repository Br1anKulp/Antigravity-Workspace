import { describe, it, expect } from 'vitest';
import { calculateCountdown, DEFAULT_RETIREMENT_MILESTONE } from '../milestonesStore';

describe('Milestones Store & Countdown Calculation', () => {
  it('correctly calculates countdown for Brian\'s Retirement on March 1, 2029', () => {
    // Test with a fixed anchor date: 2026-10-22
    const anchor = new Date(2026, 9, 22); // Month is 0-indexed: 9 = October
    const countdown = calculateCountdown('2029-03-01', anchor);

    expect(countdown.isPast).toBe(false);
    expect(countdown.isToday).toBe(false);
    expect(countdown.days).toBeGreaterThan(800);
    expect(countdown.weeks).toBe(Math.floor(countdown.days / 7));
    expect(countdown.formattedSummary).toContain('days');
    expect(countdown.formattedSummary).toContain('weeks');
  });

  it('handles a milestone that is today', () => {
    const today = new Date(2026, 9, 22);
    const countdown = calculateCountdown('2026-10-22', today);

    expect(countdown.isToday).toBe(true);
    expect(countdown.days).toBe(0);
    expect(countdown.formattedSummary).toContain('Today!');
  });

  it('handles a milestone in the past', () => {
    const anchor = new Date(2026, 9, 22);
    const countdown = calculateCountdown('2026-10-20', anchor);

    expect(countdown.isPast).toBe(true);
    expect(countdown.days).toBeLessThan(0);
    expect(countdown.formattedSummary).toContain('ago');
  });

  it('has proper default retirement milestone configuration', () => {
    expect(DEFAULT_RETIREMENT_MILESTONE.title).toBe("Brian's Retirement");
    expect(DEFAULT_RETIREMENT_MILESTONE.targetDate).toBe('2029-03-01');
    expect(DEFAULT_RETIREMENT_MILESTONE.emoji).toBe('🏝️');
    expect(DEFAULT_RETIREMENT_MILESTONE.pinned).toBe(true);
    expect(DEFAULT_RETIREMENT_MILESTONE.category).toBe('retirement');
  });
});

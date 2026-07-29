export interface ParsedEvent {
  title: string;
  startDate: Date;
  duration: number;
}

export function parseNaturalLanguageEvent(text: string): ParsedEvent | null {
  if (!text) return null;

  let title = text;
  const today = new Date();
  let targetDate = new Date();
  const duration = 60; // default 1 hour

  // 1. Parse dates (tomorrow, next Monday, on Friday, on MM/DD)
  
  // Tomorrow
  if (/\btomorrow\b/i.test(text)) {
    targetDate.setDate(today.getDate() + 1);
    title = title.replace(/\btomorrow\b/ig, '');
  }
  // Today
  else if (/\btoday\b/i.test(text)) {
    title = title.replace(/\btoday\b/ig, '');
  }
  // Next [DayOfWeek]
  const nextDayMatch = text.match(/\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
  if (nextDayMatch) {
    const targetDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(nextDayMatch[1].toLowerCase());
    const currentDay = today.getDay();
    let daysToAdd = (targetDay - currentDay + 7) % 7;
    if (daysToAdd === 0) daysToAdd = 7; // next week
    targetDate.setDate(today.getDate() + daysToAdd);
    title = title.replace(nextDayMatch[0], '');
  }
  // On/This [DayOfWeek]
  else {
    const dayMatch = text.match(/\b(on|this)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
    if (dayMatch) {
      const targetDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(dayMatch[2].toLowerCase());
      const currentDay = today.getDay();
      let daysToAdd = (targetDay - currentDay + 7) % 7;
      if (daysToAdd === 0) daysToAdd = 7; // default to next occurrence
      targetDate.setDate(today.getDate() + daysToAdd);
      title = title.replace(dayMatch[0], '');
    }
  }

  // Specific date like MM/DD or MM/DD/YYYY
  const dateMatch = text.match(/\b(\d{1,2})[/-](\d{1,2})([/-](\d{4}))?\b/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1], 10) - 1;
    const day = parseInt(dateMatch[2], 10);
    const year = dateMatch[4] ? parseInt(dateMatch[4], 10) : today.getFullYear();
    targetDate = new Date(year, month, day);
    title = title.replace(dateMatch[0], '');
  }

  // 2. Parse times (at 7pm, at 10:30am, at 2:00 pm, etc.)
  const timeMatch = text.match(/\b(at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[2], 10);
    const minutes = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
    const ampm = timeMatch[4] ? timeMatch[4].toLowerCase() : null;

    if (ampm === 'pm' && hours < 12) {
      hours += 12;
    } else if (ampm === 'am' && hours === 12) {
      hours = 0;
    } else if (!ampm) {
      // Default to PM if it's during typical daytime (e.g. 1-6 implies pm)
      if (hours >= 1 && hours <= 6) {
        hours += 12;
      }
    }

    targetDate.setHours(hours, minutes, 0, 0);
    title = title.replace(timeMatch[0], '');
  } else {
    targetDate.setHours(12, 0, 0, 0); // default to noon
  }

  // Clean up title (remove double spaces, trailing prepositions, etc.)
  title = title
    .replace(/\s+/g, ' ')
    .replace(/\b(on|at|in|for)\b\s*$/i, '')
    .trim();

  if (!title) {
    title = "Quick Event";
  }

  return {
    title,
    startDate: targetDate,
    duration
  };
}

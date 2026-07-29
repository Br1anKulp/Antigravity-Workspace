export interface IcalEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  allDay: boolean;
}

interface RawIcalEvent extends Partial<IcalEvent> {
  rrule?: string;
}

export function parseIcalData(icalText: string): IcalEvent[] {
  const events: IcalEvent[] = [];
  // Standardize line endings and unfold folded lines
  const unfolded = icalText.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
  const lines = unfolded.split('\n');

  let currentEvent: RawIcalEvent | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (trimmed === 'END:VEVENT') {
      if (currentEvent && currentEvent.start) {
        // Fallbacks for missing UID or SUMMARY
        const baseUid = currentEvent.uid || `ical_${Math.random().toString(36).substring(2, 8)}`;
        const summaryText = currentEvent.summary || 'Untitled Event';
        const isAllDay = !!currentEvent.allDay;
        const startDate = currentEvent.start;

        let endDate = currentEvent.end;
        if (!endDate) {
          endDate = isAllDay
            ? new Date(startDate.getTime())
            : new Date(startDate.getTime() + 60 * 60 * 1000);
        }

        const baseEvent: IcalEvent = {
          uid: baseUid,
          summary: summaryText,
          description: currentEvent.description,
          location: currentEvent.location,
          start: startDate,
          end: endDate,
          allDay: isAllDay
        };

        if (currentEvent.rrule) {
          const expanded = expandRrule(baseEvent, currentEvent.rrule);
          events.push(...expanded);
        } else {
          // Unique composite key for single events
          baseEvent.uid = `${baseUid}_${startDate.getTime()}`;
          events.push(baseEvent);
        }
      }
      currentEvent = null;
    } else if (currentEvent) {
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;

      const keyPart = trimmed.substring(0, colonIdx);
      const valPart = trimmed.substring(colonIdx + 1);
      const keyName = keyPart.split(';')[0].toUpperCase();

      if (keyName === 'UID') {
        currentEvent.uid = valPart.trim();
      } else if (keyName === 'SUMMARY') {
        currentEvent.summary = unescapeIcalText(valPart);
      } else if (keyName === 'DESCRIPTION') {
        currentEvent.description = unescapeIcalText(valPart);
      } else if (keyName === 'LOCATION') {
        currentEvent.location = unescapeIcalText(valPart);
      } else if (keyName === 'RRULE') {
        currentEvent.rrule = valPart.trim();
      } else if (keyName === 'DTSTART') {
        const parsed = parseIcalDate(keyPart, valPart);
        if (parsed) {
          currentEvent.start = parsed.date;
          currentEvent.allDay = parsed.allDay;
        }
      } else if (keyName === 'DTEND') {
        const parsed = parseIcalDate(keyPart, valPart);
        if (parsed) {
          if (parsed.allDay) {
            const d = new Date(parsed.date);
            d.setDate(d.getDate() - 1);
            currentEvent.end = d;
          } else {
            currentEvent.end = parsed.date;
          }
        }
      }
    }
  }

  return events;
}

function expandRrule(base: IcalEvent, rruleStr: string): IcalEvent[] {
  const results: IcalEvent[] = [];
  const parts = rruleStr.split(';');
  const params: Record<string, string> = {};

  for (const part of parts) {
    const [k, v] = part.split('=');
    if (k && v) {
      params[k.toUpperCase()] = v.toUpperCase();
    }
  }

  const freq = params['FREQ'];
  if (!freq) {
    results.push({ ...base, uid: `${base.uid}_${base.start.getTime()}` });
    return results;
  }

  const interval = parseInt(params['INTERVAL'] || '1', 10);
  const maxCount = params['COUNT'] ? parseInt(params['COUNT'], 10) : 52; // Default limit: 52 occurrences

  let untilDate: Date | null = null;
  if (params['UNTIL']) {
    const parsedUntil = parseIcalDate('', params['UNTIL']);
    if (parsedUntil) untilDate = parsedUntil.date;
  }

  // Max horizon: 1 year from base start
  const maxHorizon = untilDate || new Date(base.start.getTime() + 365 * 24 * 60 * 60 * 1000);
  const durationMs = base.end.getTime() - base.start.getTime();

  const currStart = new Date(base.start.getTime());
  let count = 0;

  while (currStart <= maxHorizon && count < maxCount && count < 100) {
    const currEnd = new Date(currStart.getTime() + durationMs);
    const instanceUid = `${base.uid}_${currStart.getTime()}`;

    results.push({
      ...base,
      uid: instanceUid,
      start: new Date(currStart.getTime()),
      end: currEnd
    });

    count++;

    if (freq === 'DAILY') {
      currStart.setDate(currStart.getDate() + interval);
    } else if (freq === 'WEEKLY') {
      currStart.setDate(currStart.getDate() + 7 * interval);
    } else if (freq === 'MONTHLY') {
      currStart.setMonth(currStart.getMonth() + interval);
    } else if (freq === 'YEARLY') {
      currStart.setFullYear(currStart.getFullYear() + interval);
    } else {
      break;
    }
  }

  return results;
}

function unescapeIcalText(str: string): string {
  return str
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .replace(/\\n/gi, '\n');
}

function parseIcalDate(keyPart: string, valPart: string): { date: Date; allDay: boolean } | null {
  const isAllDay = keyPart.includes('VALUE=DATE') || valPart.trim().length === 8;
  const cleaned = valPart.replace(/[^0-9T]/g, '');

  if (isAllDay && cleaned.length >= 8) {
    const year = parseInt(cleaned.substring(0, 4), 10);
    const month = parseInt(cleaned.substring(4, 6), 10) - 1;
    const day = parseInt(cleaned.substring(6, 8), 10);
    const parsedDate = new Date(year, month, day, 0, 0, 0);
    if (!isNaN(parsedDate.getTime())) {
      return { date: parsedDate, allDay: true };
    }
  } else if (cleaned.length >= 13) {
    const year = parseInt(cleaned.substring(0, 4), 10);
    const month = parseInt(cleaned.substring(4, 6), 10) - 1;
    const day = parseInt(cleaned.substring(6, 8), 10);
    const hour = parseInt(cleaned.substring(9, 11), 10);
    const min = parseInt(cleaned.substring(11, 13), 10);
    const sec = cleaned.length >= 15 ? parseInt(cleaned.substring(13, 15), 10) : 0;

    if (valPart.endsWith('Z')) {
      const parsedDate = new Date(Date.UTC(year, month, day, hour, min, sec));
      if (!isNaN(parsedDate.getTime())) {
        return { date: parsedDate, allDay: false };
      }
    }
    const parsedDate = new Date(year, month, day, hour, min, sec);
    if (!isNaN(parsedDate.getTime())) {
      return { date: parsedDate, allDay: false };
    }
  }

  // Fallback parser for standard ISO string values
  const isoFallback = new Date(valPart.trim());
  if (!isNaN(isoFallback.getTime())) {
    return { date: isoFallback, allDay: isAllDay };
  }

  return null;
}

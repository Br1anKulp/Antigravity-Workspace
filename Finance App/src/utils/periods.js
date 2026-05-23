import { startOfMonth, endOfMonth, setDate, isWithinInterval, parseISO } from 'date-fns'

export const getCurrentPeriod = (date = new Date()) => {
  const day = date.getDate()
  if (day < 15) {
    return {
      start: startOfMonth(date),
      end: setDate(date, 14)
    }
  } else {
    return {
      start: setDate(date, 15),
      end: endOfMonth(date)
    }
  }
}

export const isDateInPeriod = (dateString, period) => {
  const d = typeof dateString === 'string' ? parseISO(dateString) : dateString
  return isWithinInterval(d, { start: period.start, end: period.end })
}

export const getPeriodLabel = (period) => {
  return `${period.start.toLocaleDateString()} - ${period.end.toLocaleDateString()}`
}

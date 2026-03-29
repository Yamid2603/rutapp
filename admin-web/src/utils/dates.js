import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, eachWeekOfInterval, subMonths, isWithinInterval,
  addDays
} from 'date-fns';
import { es } from 'date-fns/locale';

export function today() {
  return format(new Date(), 'yyyy-MM-dd');
}

export function formatDateShort(dateStr) {
  return format(new Date(dateStr + 'T12:00:00'), 'dd MMM', { locale: es });
}

export function formatDateFull(dateStr) {
  return format(new Date(dateStr + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es });
}

export function getWeekRange(date = new Date()) {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
    days: eachDayOfInterval({ start, end }).map(d => format(d, 'yyyy-MM-dd')),
    labels: eachDayOfInterval({ start, end }).map(d => format(d, 'EEE', { locale: es })),
  };
}

export function getMonthRange(date = new Date()) {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
    weeks: eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).map(w => ({
      start: format(w, 'yyyy-MM-dd'),
      end: format(endOfWeek(w, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      label: 'Sem ' + format(w, 'dd/MM'),
    })),
  };
}

export function getPrevMonthRange(date = new Date()) {
  return getMonthRange(subMonths(date, 1));
}

export function isInRange(dateStr, startStr, endStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return isWithinInterval(d, {
    start: new Date(startStr + 'T00:00:00'),
    end: new Date(endStr + 'T23:59:59'),
  });
}

export function weekDaysFromDate(date = new Date()) {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: 6 }, (_, i) => {
    const d = addDays(start, i);
    return { date: format(d, 'yyyy-MM-dd'), label: format(d, 'EEE dd', { locale: es }) };
  });
}

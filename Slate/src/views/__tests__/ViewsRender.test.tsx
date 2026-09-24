import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ToastProvider } from '../../components/Toast';
import { ListsView } from '../ListsView';
import { NotesView } from '../NotesView';
import { CalendarView } from '../CalendarView';
import { TasksView } from '../TasksView';

describe('Views rendering test with ToastProvider', () => {
  it('renders ListsView without throwing', () => {
    expect(() => render(<ToastProvider><ListsView /></ToastProvider>)).not.toThrow();
  });

  it('renders NotesView without throwing', () => {
    expect(() => render(<ToastProvider><NotesView /></ToastProvider>)).not.toThrow();
  });

  it('renders TasksView without throwing', () => {
    expect(() => render(<ToastProvider><TasksView /></ToastProvider>)).not.toThrow();
  });

  it('renders CalendarView without throwing', () => {
    expect(() => render(<ToastProvider><CalendarView /></ToastProvider>)).not.toThrow();
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { useTasksStore } from '../tasksStore';

describe('tasksStore', () => {
  beforeEach(() => {
    useTasksStore.setState({
      tasks: [],
      loading: false,
      filter: 'all',
      sortBy: 'dueDate',
      uploadProgress: {}
    });
  });

  it('updates task filter state correctly', () => {
    expect(useTasksStore.getState().filter).toBe('all');
    useTasksStore.getState().setFilter('mine');
    expect(useTasksStore.getState().filter).toBe('mine');
  });

  it('updates task sortBy state correctly', () => {
    expect(useTasksStore.getState().sortBy).toBe('dueDate');
    useTasksStore.getState().setSortBy('priority');
    expect(useTasksStore.getState().sortBy).toBe('priority');
  });
});

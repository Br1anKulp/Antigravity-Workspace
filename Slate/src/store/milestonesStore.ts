import { create } from 'zustand';
import { dbService } from '../firebase/db';
import { useAuthStore } from './authStore';

export interface MilestoneItem {
  id: string;
  title: string;
  description?: string;
  targetDate: string; // YYYY-MM-DD
  emoji: string;
  color: string;
  pinned: boolean;
  category?: 'retirement' | 'anniversary' | 'vacation' | 'birthday' | 'goal' | 'other';
  creatorId?: string;
  createdAt: string;
}

export interface MilestoneCountdown {
  days: number;
  weeks: number;
  remainderDays: number;
  months: number;
  isPast: boolean;
  isToday: boolean;
  formattedSummary: string;
}

export const DEFAULT_RETIREMENT_MILESTONE: Omit<MilestoneItem, 'id' | 'createdAt'> = {
  title: "Brian's Retirement",
  description: "Freedom, travel, relaxing, and celebrating achievements!",
  targetDate: '2029-03-01',
  emoji: '🏝️',
  color: '#10b981',
  pinned: true,
  category: 'retirement'
};

export const calculateCountdown = (targetDateStr: string, fromDate = new Date()): MilestoneCountdown => {
  // Parse target date at midnight local time
  const [year, month, day] = targetDateStr.split('T')[0].split('-').map(Number);
  const target = new Date(year, (month || 1) - 1, day || 1);
  const current = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());

  const diffMs = target.getTime() - current.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const isPast = diffDays < 0;
  const isToday = diffDays === 0;

  const absDays = Math.abs(diffDays);
  const weeks = Math.floor(absDays / 7);
  const remainderDays = absDays % 7;

  // Approximate calendar months remaining
  let months = (target.getFullYear() - current.getFullYear()) * 12 + (target.getMonth() - current.getMonth());
  if (target.getDate() < current.getDate()) {
    months = Math.max(0, months - 1);
  }

  let formattedSummary = '';
  if (isToday) {
    formattedSummary = 'Today! 🎉';
  } else if (isPast) {
    formattedSummary = `${absDays} day${absDays === 1 ? '' : 's'} ago`;
  } else {
    formattedSummary = `${absDays} days • ${weeks} weeks`;
  }

  return {
    days: diffDays,
    weeks,
    remainderDays,
    months: Math.max(0, months),
    isPast,
    isToday,
    formattedSummary
  };
};

interface MilestonesState {
  milestones: MilestoneItem[];
  loading: boolean;
  subscribeMilestones: () => () => void;
  addMilestone: (data: Omit<MilestoneItem, 'id' | 'createdAt'>) => Promise<MilestoneItem | null>;
  updateMilestone: (id: string, data: Partial<MilestoneItem>) => Promise<void>;
  deleteMilestone: (id: string) => Promise<void>;
  togglePinMilestone: (id: string) => Promise<void>;
  getPinnedMilestones: () => MilestoneItem[];
}

export const useMilestonesStore = create<MilestonesState>((set, get) => ({
  milestones: [],
  loading: true,

  subscribeMilestones: () => {
    set({ loading: true });
    let isInitialFetch = true;

    return dbService.subscribe<MilestoneItem>('milestones', async (items) => {
      // Sort pinned milestones first, then by earliest target date
      const sorted = [...items].sort((a, b) => {
        if (a.pinned !== b.pinned) {
          return a.pinned ? -1 : 1;
        }
        return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
      });

      // If this is the initial load and no milestones exist in the collection,
      // auto-seed Brian's Retirement milestone
      if (isInitialFetch && sorted.length === 0) {
        isInitialFetch = false;
        try {
          const authUser = useAuthStore.getState().user;
          const seededItem = {
            ...DEFAULT_RETIREMENT_MILESTONE,
            creatorId: authUser?.uid || 'user-brian',
            createdAt: new Date().toISOString()
          };
          const created = await dbService.add<Omit<MilestoneItem, 'id'>>('milestones', seededItem);
          set({ milestones: [created], loading: false });
          return;
        } catch (err) {
          console.warn('Could not auto-seed retirement milestone to remote db, setting in-memory fallback:', err);
          const fallback: MilestoneItem = {
            id: 'brian-retirement-2029',
            ...DEFAULT_RETIREMENT_MILESTONE,
            createdAt: new Date().toISOString()
          };
          set({ milestones: [fallback], loading: false });
          return;
        }
      }

      isInitialFetch = false;
      set({ milestones: sorted, loading: false });
    });
  },

  addMilestone: async (data) => {
    const authUser = useAuthStore.getState().user;
    const newItem = {
      ...data,
      creatorId: authUser?.uid || 'user-brian',
      createdAt: new Date().toISOString()
    };
    try {
      const doc = await dbService.add<Omit<MilestoneItem, 'id'>>('milestones', newItem);
      return doc;
    } catch (err) {
      console.error('Failed to add milestone:', err);
      return null;
    }
  },

  updateMilestone: async (id, data) => {
    try {
      const current = get().milestones.find(m => m.id === id);
      if (!current) return;
      const updated = { ...current, ...data };
      await dbService.set('milestones', id, updated);
    } catch (err) {
      console.error('Failed to update milestone:', err);
    }
  },

  deleteMilestone: async (id) => {
    try {
      await dbService.delete('milestones', id);
    } catch (err) {
      console.error('Failed to delete milestone:', err);
    }
  },

  togglePinMilestone: async (id) => {
    const item = get().milestones.find(m => m.id === id);
    if (!item) return;
    await get().updateMilestone(id, { pinned: !item.pinned });
  },

  getPinnedMilestones: () => {
    const { milestones } = get();
    return milestones.filter(m => m.pinned);
  }
}));

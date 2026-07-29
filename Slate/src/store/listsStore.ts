import { create } from 'zustand';
import { dbService } from '../firebase/db';
import { useAuthStore } from './authStore';

export interface GroceryItem {
  id: string;
  name: string;
  category: string; // "Produce" | "Dairy" | "Meat/Seafood" | "Bakery" | "Frozen" | "Pantry" | "Household" | "Other"
  completed: boolean;
  addedBy: string;
  addedById: string;
  timestamp: string;
  photoUrl?: string;
}

interface ListsState {
  items: GroceryItem[];
  loading: boolean;
  subscribeItems: () => () => void;
  addItem: (name: string, category: string, file?: File) => Promise<void>;
  toggleItemComplete: (id: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  clearCompleted: () => Promise<void>;
  uploadItemPhoto: (id: string, file: File) => Promise<void>;
}

export const useListsStore = create<ListsState>((set, get) => ({
  items: [],
  loading: true,

  subscribeItems: () => {
    set({ loading: true });
    return dbService.subscribe<GroceryItem>('groceryList', (items) => {
      // Sort items: uncompleted first, then completed. Within each group, sort by newest added.
      const sorted = items.sort((a, b) => {
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
      set({ items: sorted, loading: false });
    });
  },

  addItem: async (name, category, file) => {
    if (!name.trim()) return;
    const authStore = useAuthStore.getState();
    const user = authStore.user;
    if (!user) return;

    const newItem = {
      name: name.trim(),
      category,
      completed: false,
      addedBy: user.name,
      addedById: user.uid,
      timestamp: new Date().toISOString()
    };

    const doc = await dbService.add<Omit<GroceryItem, 'id'>>('groceryList', newItem);

    if (doc && file) {
      try {
        const path = `groceryList/${doc.id}/${Date.now()}_${file.name}`;
        const url = await dbService.uploadFile(path, file);
        await dbService.set('groceryList', doc.id, {
          ...newItem,
          photoUrl: url,
          id: doc.id
        });
      } catch (err) {
        console.error("Failed to upload grocery photo on creation:", err);
      }
    }
  },

  toggleItemComplete: async (id) => {
    const item = get().items.find(i => i.id === id);
    if (!item) return;

    await dbService.set('groceryList', id, {
      ...item,
      completed: !item.completed
    });
  },

  deleteItem: async (id) => {
    const item = get().items.find(i => i.id === id);
    if (item && item.photoUrl) {
      try {
        await dbService.deleteFile(item.photoUrl);
      } catch (err) {
        console.warn("Failed to delete grocery photo file:", err);
      }
    }
    await dbService.delete('groceryList', id);
  },

  clearCompleted: async () => {
    const completedItems = get().items.filter(i => i.completed);
    for (const item of completedItems) {
      if (item.photoUrl) {
        try {
          await dbService.deleteFile(item.photoUrl);
        } catch (err) {
          console.warn("Failed to delete grocery photo file on clearCompleted:", err);
        }
      }
      await dbService.delete('groceryList', item.id);
    }
  },

  uploadItemPhoto: async (id, file) => {
    const item = get().items.find(i => i.id === id);
    if (!item) return;

    const path = `groceryList/${id}/${Date.now()}_${file.name}`;
    const url = await dbService.uploadFile(path, file);
    await dbService.set('groceryList', id, {
      ...item,
      photoUrl: url
    });
  }
}));

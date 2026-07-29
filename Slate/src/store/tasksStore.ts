import { create } from 'zustand';
import { dbService } from '../firebase/db';
import { useAuthStore } from './authStore';
import { useNotificationStore } from './notificationStore';

export interface TaskAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
  isPending?: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  dueDate?: string; // ISO Date string (YYYY-MM-DD)
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee: 'self' | 'partner' | 'both';
  tags: string[];
  completed: boolean;
  completedAt?: string;
  linkedEventId?: string;
  isKanbanCard?: boolean;
  creatorId: string;
  attachments?: TaskAttachment[];
  createdAt?: string;
}

interface TasksState {
  tasks: TaskItem[];
  loading: boolean;
  filter: 'all' | 'mine' | 'partner' | 'shared' | 'overdue' | 'completed';
  sortBy: 'dueDate' | 'priority' | 'createdAt' | 'title';
  uploadProgress: Record<string, number>;
  subscribeTasks: () => () => void;
  setFilter: (filter: TasksState['filter']) => void;
  setSortBy: (sort: TasksState['sortBy']) => void;
  addTask: (task: Omit<TaskItem, 'id' | 'completed' | 'creatorId' | 'attachments'>) => Promise<TaskItem | null>;
  updateTask: (id: string, data: Partial<TaskItem>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleComplete: (id: string) => Promise<boolean>; // Returns true if just completed
  uploadAttachment: (id: string, file: File, onProgress?: (pct: number) => void) => Promise<void>;
  deleteAttachment: (id: string, index: number) => Promise<void>;
}

interface OfflineQueueItem {
  id: string;
  parentId: string;
  file: File;
  tempUrl: string;
  progressKey: string;
}

const DB_NAME = 'slate_offline_db';
const STORE_NAME = 'tasks_queue';

const openOfflineDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveOfflineTaskItem = async (item: OfflineQueueItem) => {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(item);
  } catch (err) {
    console.warn('Failed to persist offline upload item:', err);
  }
};

const getOfflineTaskItems = async (): Promise<OfflineQueueItem[]> => {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
};

const removeOfflineTaskItem = async (id: string) => {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
  } catch (err) {
    console.warn('Failed to delete offline upload item:', err);
  }
};

const syncOfflineTasks = async () => {
  const queueItems = await getOfflineTaskItems();
  if (queueItems.length === 0) return;

  for (const item of queueItems) {
    try {
      const store = useTasksStore.getState();
      const task = store.tasks.find(t => t.id === item.parentId);
      if (!task) {
        await removeOfflineTaskItem(item.id);
        continue;
      }

      const updateProgress = (pct: number) => {
        useTasksStore.setState((state) => ({
          uploadProgress: { ...state.uploadProgress, [item.progressKey]: pct }
        }));
      };

      updateProgress(0);
      const path = `tasks/${item.parentId}/${Date.now()}_${item.file.name}`;
      const url = await dbService.uploadFile(path, item.file, updateProgress);

      const currentAttachments = task.attachments || [];
      const updatedAttachments = currentAttachments.map(att => {
        if (att.url === item.tempUrl) {
          return {
            name: item.file.name,
            url,
            type: item.file.type,
            size: item.file.size
          };
        }
        return att;
      });

      await store.updateTask(item.parentId, {
        attachments: updatedAttachments
      });

      await removeOfflineTaskItem(item.id);
      if (item.tempUrl.startsWith('blob:')) {
        URL.revokeObjectURL(item.tempUrl);
      }
    } catch (err) {
      console.error("Failed to sync offline task upload:", err);
    } finally {
      setTimeout(() => {
        useTasksStore.setState((state) => {
          const next = { ...state.uploadProgress };
          delete next[item.progressKey];
          return { uploadProgress: next };
        });
      }, 1000);
    }
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', syncOfflineTasks);
  // Initial sync attempt when script loads if back online
  if (navigator.onLine) {
    syncOfflineTasks();
  }
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  loading: true,
  filter: 'all',
  sortBy: 'dueDate',
  uploadProgress: {},

  subscribeTasks: () => {
    set({ loading: true });
    return dbService.subscribe<TaskItem>('tasks', 
      (items) => {
        set({ tasks: items, loading: false });
      },
      undefined,
      () => {
        set({ loading: false });
      }
    );
  },

  setFilter: (filter) => set({ filter }),
  setSortBy: (sortBy) => set({ sortBy }),

  addTask: async (taskData) => {
    const authStore = useAuthStore.getState();
    const notificationStore = useNotificationStore.getState();
    const user = authStore.user;
    if (!user) return null;

    const newTask = {
      ...taskData,
      completed: false,
      attachments: [],
      creatorId: user.uid,
      createdAt: new Date().toISOString()
    };

    const doc = await dbService.add<Omit<TaskItem, 'id'>>('tasks', newTask);

    // Notify partner
    if (taskData.assignee !== 'self' && authStore.partner) {
      await notificationStore.addNotification({
        recipientId: authStore.partner.uid,
        senderId: user.uid,
        senderName: user.name,
        title: '✅ New Task Assigned',
        description: `${user.name} assigned task "${taskData.title}" to ${taskData.assignee === 'both' ? 'both of you' : 'you'}.`,
        type: 'cardAssigned',
        relatedId: doc.id,
        relatedType: 'task'
      });
    }

    return doc;
  },

  updateTask: async (id, data) => {
    const task = get().tasks.find(t => t.id === id);
    if (!task) return;

    const updated = { ...task, ...data };
    await dbService.set('tasks', id, updated);

    // Notify partner
    const authStore = useAuthStore.getState();
    const notificationStore = useNotificationStore.getState();
    const user = authStore.user;
    if (user && authStore.partner && task.assignee !== 'self') {
      await notificationStore.addNotification({
        recipientId: authStore.partner.uid,
        senderId: user.uid,
        senderName: user.name,
        title: '✏️ Task Updated',
        description: `${user.name} updated the task "${task.title}".`,
        type: 'cardMoved',
        relatedId: id,
        relatedType: 'task'
      });
    }
  },

  deleteTask: async (id) => {
    const task = get().tasks.find(t => t.id === id);
    await dbService.delete('tasks', id);

    // Notify partner
    const authStore = useAuthStore.getState();
    const notificationStore = useNotificationStore.getState();
    const user = authStore.user;
    if (user && task && authStore.partner && task.assignee !== 'self') {
      await notificationStore.addNotification({
        recipientId: authStore.partner.uid,
        senderId: user.uid,
        senderName: user.name,
        title: '🗑 Task Deleted',
        description: `${user.name} deleted the task "${task.title}".`,
        type: 'system'
      });
    }
  },

  toggleComplete: async (id) => {
    const task = get().tasks.find(t => t.id === id);
    if (!task) return false;

    const nextCompleted = !task.completed;
    const updated = { 
      ...task, 
      completed: nextCompleted, 
      completedAt: nextCompleted ? new Date().toISOString() : undefined 
    };

    await dbService.set('tasks', id, updated);

    // Confetti logic: trigger if completed and trigger confetti animation on the client side
    const authStore = useAuthStore.getState();
    const notificationStore = useNotificationStore.getState();
    const user = authStore.user;

    if (nextCompleted) {
      // Confetti is handled visually inside the task item, but let's notify partner
      if (user && authStore.partner && task.assignee !== 'self') {
        await notificationStore.addNotification({
          recipientId: authStore.partner.uid,
          senderId: user.uid,
          senderName: user.name,
          title: '🎉 Task Completed!',
          description: `${user.name} completed the task "${task.title}".`,
          type: 'cardCompleted',
          relatedId: id,
          relatedType: 'task'
        });
      }
      return true;
    }
    return false;
  },

  uploadAttachment: async (id, file, onProgress) => {
    const task = get().tasks.find(t => t.id === id);
    if (!task) return;

    const progressKey = `${id}-${file.name}`;
    const updateProgress = (pct: number) => {
      set((state) => ({
        uploadProgress: { ...state.uploadProgress, [progressKey]: pct }
      }));
      if (onProgress) onProgress(pct);
    };

    if (!navigator.onLine) {
      const tempUrl = URL.createObjectURL(file);
      const newAttachment = {
        name: file.name,
        url: tempUrl,
        type: file.type,
        size: file.size,
        isPending: true
      };

      const currentAttachments = task.attachments || [];
      await get().updateTask(id, {
        attachments: [...currentAttachments, newAttachment]
      });

      const queueItem: OfflineQueueItem = {
        id: `${id}_${Date.now()}_${file.name}`,
        parentId: id,
        file,
        tempUrl,
        progressKey
      };
      await saveOfflineTaskItem(queueItem);
      if (navigator.onLine) {
        syncOfflineTasks();
      }
      return;
    }

    try {
      updateProgress(0);
      const path = `tasks/${id}/${Date.now()}_${file.name}`;
      const url = await dbService.uploadFile(path, file, updateProgress);

      const newAttachment = {
        name: file.name,
        url,
        type: file.type,
        size: file.size
      };

      const currentAttachments = task.attachments || [];
      await get().updateTask(id, {
        attachments: [...currentAttachments, newAttachment]
      });
    } finally {
      setTimeout(() => {
        set((state) => {
          const next = { ...state.uploadProgress };
          delete next[progressKey];
          return { uploadProgress: next };
        });
      }, 1000);
    }
  },

  deleteAttachment: async (id, index) => {
    const task = get().tasks.find(t => t.id === id);
    if (!task) return;

    const currentAttachments = task.attachments || [];
    const attachmentToDelete = currentAttachments[index];
    if (attachmentToDelete) {
      if (!attachmentToDelete.url.startsWith('blob:') && !attachmentToDelete.url.startsWith('data:')) {
        await dbService.deleteFile(attachmentToDelete.url);
      } else if (attachmentToDelete.url.startsWith('blob:')) {
        URL.revokeObjectURL(attachmentToDelete.url);
      }
    }

    const updatedAttachments = currentAttachments.filter((_, idx) => idx !== index);
    await get().updateTask(id, {
      attachments: updatedAttachments
    });
  }
}));

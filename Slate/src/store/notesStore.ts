import { create } from 'zustand';
import { dbService } from '../firebase/db';
import { useAuthStore } from './authStore';

export interface NoteAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
  isPending?: boolean;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string; // HTML or Markdown representation
  isShared: boolean;
  isPinned: boolean;
  tags: string[];
  lastEditedBy: string; // name of user
  lastEditedById: string; // UID of user
  lastEditedAt: string; // ISO timestamp
  creatorId: string;
  attachments?: NoteAttachment[];
}

interface NotesState {
  notes: NoteItem[];
  loading: boolean;
  searchQuery: string;
  uploadProgress: Record<string, number>;
  lastDeletedNote: NoteItem | null;
  subscribeNotes: () => () => void;
  setSearchQuery: (query: string) => void;
  addNote: (note: Omit<NoteItem, 'id' | 'lastEditedBy' | 'lastEditedById' | 'lastEditedAt' | 'creatorId' | 'attachments'>) => Promise<NoteItem | null>;
  updateNote: (id: string, data: Partial<NoteItem>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  undoDelete: () => Promise<void>;
  clearLastDeletedNote: () => void;
  uploadAttachment: (id: string, file: File, onProgress?: (pct: number) => void) => Promise<void>;
  deleteAttachment: (id: string, index: number) => Promise<void>;
}

const offlineNotesQueue: { parentId: string; file: File; tempUrl: string; progressKey: string }[] = [];

const syncOfflineNotes = async () => {
  if (offlineNotesQueue.length === 0) return;
  const queueCopy = [...offlineNotesQueue];
  offlineNotesQueue.length = 0;

  for (const item of queueCopy) {
    try {
      const store = useNotesStore.getState();
      const note = store.notes.find(n => n.id === item.parentId);
      if (!note) continue;

      const updateProgress = (pct: number) => {
        useNotesStore.setState((state) => ({
          uploadProgress: { ...state.uploadProgress, [item.progressKey]: pct }
        }));
      };

      updateProgress(0);
      const path = `notes/${item.parentId}/${Date.now()}_${item.file.name}`;
      const url = await dbService.uploadFile(path, item.file, updateProgress);

      const currentAttachments = note.attachments || [];
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

      await store.updateNote(item.parentId, {
        attachments: updatedAttachments
      });

      URL.revokeObjectURL(item.tempUrl);
    } catch (err) {
      console.error("Failed to sync offline note upload:", err);
      if (!navigator.onLine) {
        offlineNotesQueue.push(item);
      }
    } finally {
      setTimeout(() => {
        useNotesStore.setState((state) => {
          const next = { ...state.uploadProgress };
          delete next[item.progressKey];
          return { uploadProgress: next };
        });
      }, 1000);
    }
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', syncOfflineNotes);
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  loading: true,
  searchQuery: '',
  uploadProgress: {},
  lastDeletedNote: null,

  subscribeNotes: () => {
    set({ loading: true });
    return dbService.subscribe<NoteItem>('notes', 
      (items) => {
        set({ notes: items, loading: false });
      },
      undefined,
      () => {
        set({ loading: false });
      }
    );
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  addNote: async (noteData) => {
    const authStore = useAuthStore.getState();
    const user = authStore.user;
    if (!user) return null;

    const newNote = {
      ...noteData,
      attachments: [],
      creatorId: user.uid,
      lastEditedBy: user.name,
      lastEditedById: user.uid,
      lastEditedAt: new Date().toISOString()
    };

    return await dbService.add<Omit<NoteItem, 'id'>>('notes', newNote);
  },

  updateNote: async (id, data) => {
    const note = get().notes.find(n => n.id === id);
    if (!note) return;

    const authStore = useAuthStore.getState();
    const user = authStore.user;
    if (!user) return;

    const updated = { 
      ...note, 
      ...data,
      lastEditedBy: user.name,
      lastEditedById: user.uid,
      lastEditedAt: new Date().toISOString()
    };
    
    // Optimistic local update to prevent cursor jumping/typing delay during debounced saves
    const currentNotes = get().notes;
    const index = currentNotes.findIndex(n => n.id === id);
    if (index !== -1) {
      const copy = [...currentNotes];
      copy[index] = updated;
      set({ notes: copy });
    }

    await dbService.set('notes', id, updated);
  },

  deleteNote: async (id) => {
    const note = get().notes.find(n => n.id === id);
    if (note) {
      set({ lastDeletedNote: note });
    }
    await dbService.delete('notes', id);
  },

  undoDelete: async () => {
    const { lastDeletedNote } = get();
    if (!lastDeletedNote) return;
    await dbService.set('notes', lastDeletedNote.id, lastDeletedNote);
    set({ lastDeletedNote: null });
  },

  clearLastDeletedNote: () => set({ lastDeletedNote: null }),

  uploadAttachment: async (id, file, onProgress) => {
    const note = get().notes.find(n => n.id === id);
    if (!note) return;

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

      const currentAttachments = note.attachments || [];
      await get().updateNote(id, {
        attachments: [...currentAttachments, newAttachment]
      });

      offlineNotesQueue.push({ parentId: id, file, tempUrl, progressKey });
      if (navigator.onLine) {
        syncOfflineNotes();
      }
      return;
    }

    try {
      updateProgress(0);
      const path = `notes/${id}/${Date.now()}_${file.name}`;
      const url = await dbService.uploadFile(path, file, updateProgress);

      const newAttachment = {
        name: file.name,
        url,
        type: file.type,
        size: file.size
      };

      const currentAttachments = note.attachments || [];
      await get().updateNote(id, {
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
    const note = get().notes.find(n => n.id === id);
    if (!note) return;

    const currentAttachments = note.attachments || [];
    const attachmentToDelete = currentAttachments[index];
    if (attachmentToDelete) {
      if (!attachmentToDelete.url.startsWith('blob:') && !attachmentToDelete.url.startsWith('data:')) {
        await dbService.deleteFile(attachmentToDelete.url);
      } else if (attachmentToDelete.url.startsWith('blob:')) {
        URL.revokeObjectURL(attachmentToDelete.url);
      }
    }

    const updatedAttachments = currentAttachments.filter((_, idx) => idx !== index);
    await get().updateNote(id, {
      attachments: updatedAttachments
    });
  }
}));

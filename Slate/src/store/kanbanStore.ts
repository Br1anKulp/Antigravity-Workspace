import { create } from 'zustand';
import { dbService } from '../firebase/db';
import { useAuthStore } from './authStore';
import { useNotificationStore } from './notificationStore';

export interface Board {
  id: string;
  name: string;
  description?: string;
  creatorId: string;
}

export interface Column {
  id: string;
  boardId: string;
  name: string;
  order: number;
  wipLimit: number;
}

export interface CardAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
  isPending?: boolean;
}

export interface CardComment {
  id: string;
  userId: string;
  userName: string;
  avatarColor: string;
  text: string;
  timestamp: string;
}

export interface CardChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Card {
  id: string;
  columnId: string;
  boardId: string;
  title: string;
  description?: string;
  assignee: 'self' | 'partner' | 'both';
  dueDate?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags: string[];
  checklist: CardChecklistItem[];
  attachments: CardAttachment[];
  comments: CardComment[];
  color?: string;
  creatorId: string;
  createdAt: string;
}

interface KanbanState {
  boards: Board[];
  columns: Column[];
  cards: Card[];
  activeBoardId: string | null;
  loading: boolean;
  uploadProgress: Record<string, number>;
  
  subscribeKanban: () => () => void;
  setActiveBoard: (boardId: string) => void;
  
  // Board Operations
  addBoard: (name: string, description?: string) => Promise<string>;
  deleteBoard: (id: string) => Promise<void>;
  
  // Column Operations
  addColumn: (boardId: string, name: string, wipLimit?: number) => Promise<void>;
  updateColumnName: (id: string, name: string) => Promise<void>;
  updateColumnWipLimit: (id: string, limit: number) => Promise<void>;
  deleteColumn: (id: string) => Promise<void>;
  reorderColumns: (columns: Column[]) => Promise<void>;
  
  // Card Operations
  addCard: (card: Omit<Card, 'id' | 'checklist' | 'attachments' | 'comments' | 'creatorId' | 'createdAt'>) => Promise<void>;
  updateCard: (id: string, data: Partial<Card>) => Promise<void>;
  moveCard: (cardId: string, targetColId: string) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  
  // Checklist, Attachments, Comments
  toggleChecklistItem: (cardId: string, itemId: string) => Promise<void>;
  addChecklistItem: (cardId: string, text: string) => Promise<void>;
  deleteChecklistItem: (cardId: string, itemId: string) => Promise<void>;
  addComment: (cardId: string, text: string) => Promise<void>;
  uploadAttachment: (cardId: string, file: File, onProgress?: (pct: number) => void) => Promise<void>;
  deleteAttachment: (cardId: string, index: number) => Promise<void>;
}

const offlineKanbanQueue: { parentId: string; file: File; tempUrl: string; progressKey: string }[] = [];

const syncOfflineKanban = async () => {
  if (offlineKanbanQueue.length === 0) return;
  const queueCopy = [...offlineKanbanQueue];
  offlineKanbanQueue.length = 0;

  for (const item of queueCopy) {
    try {
      const store = useKanbanStore.getState();
      const card = store.cards.find(c => c.id === item.parentId);
      if (!card) continue;

      const updateProgress = (pct: number) => {
        useKanbanStore.setState((state) => ({
          uploadProgress: { ...state.uploadProgress, [item.progressKey]: pct }
        }));
      };

      updateProgress(0);
      const path = `cards/${item.parentId}/${Date.now()}_${item.file.name}`;
      const url = await dbService.uploadFile(path, item.file, updateProgress);

      const currentAttachments = card.attachments || [];
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

      await store.updateCard(item.parentId, {
        attachments: updatedAttachments
      });

      URL.revokeObjectURL(item.tempUrl);
    } catch (err) {
      console.error("Failed to sync offline kanban upload:", err);
      if (!navigator.onLine) {
        offlineKanbanQueue.push(item);
      }
    } finally {
      setTimeout(() => {
        useKanbanStore.setState((state) => {
          const next = { ...state.uploadProgress };
          delete next[item.progressKey];
          return { uploadProgress: next };
        });
      }, 1000);
    }
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', syncOfflineKanban);
}

export const useKanbanStore = create<KanbanState>((set, get) => ({
  boards: [],
  columns: [],
  cards: [],
  activeBoardId: null,
  loading: true,
  uploadProgress: {},

  subscribeKanban: () => {
    set({ loading: true });
    
    const handleErr = () => {
      set({ loading: false });
    };

    const unsubBoards = dbService.subscribe<Board>('boards', (boards) => {
      set({ boards });
      if (boards.length > 0 && !get().activeBoardId) {
        set({ activeBoardId: boards[0].id });
      }
    }, undefined, handleErr);

    const unsubCols = dbService.subscribe<Column>('columns', (columns) => {
      set({ columns: columns.sort((a, b) => a.order - b.order) });
    }, undefined, handleErr);

    const unsubCards = dbService.subscribe<Card>('cards', (cards) => {
      set({ cards, loading: false });
    }, undefined, handleErr);

    return () => {
      unsubBoards();
      unsubCols();
      unsubCards();
    };
  },

  setActiveBoard: (activeBoardId) => set({ activeBoardId }),

  addBoard: async (name, description) => {
    const authStore = useAuthStore.getState();
    const user = authStore.user;
    if (!user) throw new Error('Unauthenticated');

    const newBoard = await dbService.add<Omit<Board, 'id'>>('boards', {
      name,
      description,
      creatorId: user.uid
    });

    // Seed default columns for new board
    const cols = ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'];
    for (let i = 0; i < cols.length; i++) {
      await dbService.add<Omit<Column, 'id'>>('columns', {
        boardId: newBoard.id,
        name: cols[i],
        order: i,
        wipLimit: cols[i] === 'In Progress' ? 3 : 10
      });
    }

    set({ activeBoardId: newBoard.id });
    return newBoard.id;
  },

  deleteBoard: async (id) => {
    await dbService.delete('boards', id);
    const remaining = get().boards.filter(b => b.id !== id);
    if (remaining.length > 0) {
      set({ activeBoardId: remaining[0].id });
    } else {
      set({ activeBoardId: null });
    }
  },

  addColumn: async (boardId, name, wipLimit = 5) => {
    const existingCols = get().columns.filter(c => c.boardId === boardId);
    await dbService.add<Omit<Column, 'id'>>('columns', {
      boardId,
      name,
      order: existingCols.length,
      wipLimit
    });
  },

  updateColumnName: async (id, name) => {
    const col = get().columns.find(c => c.id === id);
    if (col) {
      await dbService.set('columns', id, { ...col, name });
    }
  },

  updateColumnWipLimit: async (id, wipLimit) => {
    const col = get().columns.find(c => c.id === id);
    if (col) {
      await dbService.set('columns', id, { ...col, wipLimit });
    }
  },

  deleteColumn: async (id) => {
    await dbService.delete('columns', id);
  },

  reorderColumns: async (updatedCols) => {
    const promises = updatedCols.map((col, idx) => 
      dbService.set('columns', col.id, { ...col, order: idx })
    );
    await Promise.all(promises);
  },

  addCard: async (cardData) => {
    const authStore = useAuthStore.getState();
    const notificationStore = useNotificationStore.getState();
    const user = authStore.user;
    if (!user) return;

    const newCard = {
      ...cardData,
      checklist: [],
      attachments: [],
      comments: [],
      creatorId: user.uid,
      createdAt: new Date().toISOString()
    };

    const added = await dbService.add<Omit<Card, 'id'>>('cards', newCard);

    // Notify partner
    if (cardData.assignee !== 'self' && authStore.partner) {
      await notificationStore.addNotification({
        recipientId: authStore.partner.uid,
        senderId: user.uid,
        senderName: user.name,
        title: '🗂 Card Assigned in Kanban',
        description: `${user.name} assigned you a card: "${cardData.title}".`,
        type: 'cardAssigned',
        relatedId: added.id,
        relatedType: 'card'
      });
    }
  },

  updateCard: async (id, data) => {
    const card = get().cards.find(c => c.id === id);
    if (card) {
      await dbService.set('cards', id, { ...card, ...data });
    }
  },

  moveCard: async (cardId, targetColId) => {
    const card = get().cards.find(c => c.id === cardId);
    if (!card) return;
    if (card.columnId === targetColId) return;

    const targetCol = get().columns.find(c => c.id === targetColId);
    if (!targetCol) return;

    // Check WIP limit
    const cardsInTarget = get().cards.filter(c => c.columnId === targetColId);
    const authStore = useAuthStore.getState();
    const notificationStore = useNotificationStore.getState();
    const user = authStore.user;

    if (targetCol.wipLimit && cardsInTarget.length >= targetCol.wipLimit) {
      if (user && authStore.partner) {
        await notificationStore.addNotification({
          recipientId: 'both',
          senderId: user.uid,
          senderName: user.name,
          title: '⚠️ Column WIP Limit Exceeded',
          description: `"${targetCol.name}" has exceeded its WIP limit of ${targetCol.wipLimit} cards!`,
          type: 'wipLimitExceeded',
          relatedId: cardId,
          relatedType: 'card'
        });
      }
    }

    await dbService.set('cards', cardId, { ...card, columnId: targetColId });

    // Notify partner of move
    if (user && authStore.partner && card.assignee !== 'self') {
      await notificationStore.addNotification({
        recipientId: authStore.partner.uid,
        senderId: user.uid,
        senderName: user.name,
        title: '🗂 Card Moved',
        description: `${user.name} moved "${card.title}" to ${targetCol.name}.`,
        type: 'cardMoved',
        relatedId: cardId,
        relatedType: 'card'
      });
    }
  },

  deleteCard: async (id) => {
    await dbService.delete('cards', id);
  },

  toggleChecklistItem: async (cardId, itemId) => {
    const card = get().cards.find(c => c.id === cardId);
    if (!card) return;
    
    const checklist = card.checklist.map(item => 
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    await dbService.set('cards', cardId, { ...card, checklist });
  },

  addChecklistItem: async (cardId, text) => {
    const card = get().cards.find(c => c.id === cardId);
    if (!card) return;

    const checklist = [
      ...card.checklist,
      { id: Math.random().toString(36).substring(2, 9), text, completed: false }
    ];
    await dbService.set('cards', cardId, { ...card, checklist });
  },

  deleteChecklistItem: async (cardId, itemId) => {
    const card = get().cards.find(c => c.id === cardId);
    if (!card) return;

    const checklist = card.checklist.filter(item => item.id !== itemId);
    await dbService.set('cards', cardId, { ...card, checklist });
  },

  addComment: async (cardId, text) => {
    const card = get().cards.find(c => c.id === cardId);
    if (!card) return;

    const authStore = useAuthStore.getState();
    const notificationStore = useNotificationStore.getState();
    const user = authStore.user;
    if (!user) return;

    const newComment = {
      id: Math.random().toString(36).substring(2, 9),
      userId: user.uid,
      userName: user.name,
      avatarColor: user.avatarColor,
      text,
      timestamp: new Date().toISOString()
    };

    await dbService.set('cards', cardId, {
      ...card,
      comments: [...card.comments, newComment]
    });

    // Notify partner
    if (authStore.partner) {
      await notificationStore.addNotification({
        recipientId: authStore.partner.uid,
        senderId: user.uid,
        senderName: user.name,
        title: '💬 New Kanban Comment',
        description: `${user.name} commented on "${card.title}": "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`,
        type: 'commentAdded',
        relatedId: cardId,
        relatedType: 'card'
      });
    }
  },

  uploadAttachment: async (cardId, file, onProgress) => {
    const card = get().cards.find(c => c.id === cardId);
    if (!card) return;

    const progressKey = `${cardId}-${file.name}`;
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

      await dbService.set('cards', cardId, {
        ...card,
        attachments: [...card.attachments, newAttachment]
      });

      offlineKanbanQueue.push({ parentId: cardId, file, tempUrl, progressKey });
      if (navigator.onLine) {
        syncOfflineKanban();
      }
      return;
    }

    try {
      updateProgress(0);
      const path = `cards/${cardId}/${Date.now()}_${file.name}`;
      const url = await dbService.uploadFile(path, file, updateProgress);

      const newAttachment = {
        name: file.name,
        url,
        type: file.type,
        size: file.size
      };

      await dbService.set('cards', cardId, {
        ...card,
        attachments: [...card.attachments, newAttachment]
      });

      // Notify partner
      const authStore = useAuthStore.getState();
      const notificationStore = useNotificationStore.getState();
      const user = authStore.user;
      if (user && authStore.partner && card.assignee !== 'self') {
        await notificationStore.addNotification({
          recipientId: authStore.partner.uid,
          senderId: user.uid,
          senderName: user.name,
          title: '📎 File Attached',
          description: `${user.name} attached "${file.name}" to card "${card.title}".`,
          type: 'commentAdded',
          relatedId: cardId,
          relatedType: 'card'
        });
      }
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

  deleteAttachment: async (cardId, index) => {
    const card = get().cards.find(c => c.id === cardId);
    if (!card) return;

    const currentAttachments = card.attachments || [];
    const attachmentToDelete = currentAttachments[index];
    if (attachmentToDelete) {
      if (!attachmentToDelete.url.startsWith('blob:') && !attachmentToDelete.url.startsWith('data:')) {
        await dbService.deleteFile(attachmentToDelete.url);
      } else if (attachmentToDelete.url.startsWith('blob:')) {
        URL.revokeObjectURL(attachmentToDelete.url);
      }
    }

    const updatedAttachments = currentAttachments.filter((_, idx) => idx !== index);
    await dbService.set('cards', cardId, {
      ...card,
      attachments: updatedAttachments
    });
  }
}));

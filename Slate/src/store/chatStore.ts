import { create } from 'zustand';
import { dbService } from '../firebase/db';
import { useAuthStore } from './authStore';
import { useNotificationStore } from './notificationStore';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  avatarColor: string;
  avatarEmoji: string;
  text: string;
  timestamp: string;
}

interface ChatState {
  messages: ChatMessage[];
  loading: boolean;
  subscribeMessages: () => () => void;
  sendMessage: (text: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  loading: true,

  subscribeMessages: () => {
    set({ loading: true });
    return dbService.subscribe<ChatMessage>('messages', (items) => {
      // Sort messages chronologically (oldest to newest) for a standard chat feed
      const sorted = items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      set({ messages: sorted, loading: false });
    });
  },

  sendMessage: async (text) => {
    if (!text.trim()) return;
    const authStore = useAuthStore.getState();
    const user = authStore.user;
    if (!user) return;

    const newMessage = {
      senderId: user.uid,
      senderName: user.name,
      avatarColor: user.avatarColor || '#64748b',
      avatarEmoji: user.avatarEmoji || '👤',
      text: text.trim(),
      timestamp: new Date().toISOString()
    };

    await dbService.add<Omit<ChatMessage, 'id'>>('messages', newMessage);

    // Notify partner
    if (authStore.partner) {
      const notificationStore = useNotificationStore.getState();
      await notificationStore.addNotification({
        recipientId: authStore.partner.uid,
        senderId: user.uid,
        senderName: user.name,
        title: '💬 New Message',
        description: text.trim().length > 60 ? `${text.trim().substring(0, 60)}...` : text.trim(),
        type: 'chatMessage',
        relatedId: 'chat',
        relatedType: 'chat'
      });
    }
  }
}));

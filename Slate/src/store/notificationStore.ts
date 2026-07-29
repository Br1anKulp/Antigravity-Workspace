import { create } from 'zustand';
import { dbService } from '../firebase/db';

export interface NotificationItem {
  id: string;
  recipientId: string; // user UID, partner UID, or 'both'
  senderId: string;
  senderName: string;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  type: 'cardAssigned' | 'cardMoved' | 'commentAdded' | 'dueDateReminder' | 'cardCompleted' | 'wipLimitExceeded' | 'system' | 'chatMessage';
  relatedId?: string;
  relatedType?: 'card' | 'task' | 'note' | 'event' | 'chat';
}

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  permissionGranted: boolean;
  subscribeNotifications: (uid: string) => () => void;
  addNotification: (notification: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  requestPermission: (uid?: string) => Promise<void>;
  syncFCMToken: (uid: string) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  permissionGranted: 'Notification' in window ? Notification.permission === 'granted' : false,

  subscribeNotifications: (uid: string) => {
    // Sync FCM Token for mobile background push notifications if permission is already granted
    get().syncFCMToken(uid);

    // Unsubscribe from any prior listener
    return dbService.subscribe<NotificationItem>(
      'notifications', 
      (items) => {
        // Sort notifications by newest first
        const sorted = items
          .filter(n => n.recipientId === uid || n.recipientId === 'both')
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        const currentTab = typeof localStorage !== 'undefined' ? localStorage.getItem('slate_active_tab') : null;

        // Auto-read incoming chat notifications if the user is already actively chatting
        const chatNotifsToAutoRead = sorted.filter(n => !n.read && n.type === 'chatMessage' && currentTab === 'chat');
        if (chatNotifsToAutoRead.length > 0) {
          chatNotifsToAutoRead.forEach(n => {
            dbService.set('notifications', n.id, { ...n, read: true }).catch(console.error);
          });
        }

        // Check if there are new unread notifications that were sent by the partner
        const prevItems = get().notifications;
        if (prevItems.length > 0) {
          const newUnread = sorted.filter(n => 
            !n.read && 
            n.senderId !== uid && 
            !(n.type === 'chatMessage' && currentTab === 'chat') &&
            !prevItems.some(prev => prev.id === n.id)
          );
          
          if (newUnread.length > 0) {
            // Trigger haptic vibration for mobile users
            if (typeof window !== 'undefined' && 'vibrate' in navigator) {
              try {
                // Short rapid double pulse for chat messages, longer pulse for tasks/calendar alerts
                const hasChatMsg = newUnread.some(n => n.type === 'chatMessage');
                const pattern = hasChatMsg ? [100, 50, 100] : [400, 200, 400];
                navigator.vibrate(pattern);
              } catch {
                // Ignore silent vibration fails
              }
            }

            // Only trigger local browser popup if the app is in the foreground (document is visible).
            // If the app is in the background, FCM will handle display of push notifications.
            if (Notification.permission === 'granted' && typeof document !== 'undefined' && document.visibilityState === 'visible') {
              newUnread.forEach(n => {
                try {
                  new Notification(n.title, {
                    body: n.description,
                    icon: '/favicon.svg'
                  });
                } catch (err) {
                  console.warn('Failed to trigger native Notification popup:', err);
                }
              });
            }
          }
        }

        const unread = sorted.filter(n => !n.read).length;
        set({ notifications: sorted, unreadCount: unread });
      }
    );
  },

  addNotification: async (n) => {
    const newNotification = {
      ...n,
      timestamp: new Date().toISOString(),
      read: false
    };
    await dbService.add<Omit<NotificationItem, 'id'>>('notifications', newNotification);
  },

  markAsRead: async (id) => {
    const item = get().notifications.find(n => n.id === id);
    if (item) {
      await dbService.set('notifications', id, { ...item, read: true });
    }
  },

  markAllAsRead: async () => {
    const unread = get().notifications.filter(n => !n.read);
    const promises = unread.map(n => dbService.set('notifications', n.id, { ...n, read: true }));
    await Promise.all(promises);
  },

  deleteNotification: async (id) => {
    await dbService.delete('notifications', id);
  },

  requestPermission: async (uid?: string) => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      set({ permissionGranted: permission === 'granted' });
      if (permission === 'granted' && uid) {
        get().syncFCMToken(uid);
      }
    }
  },

  syncFCMToken: async (uid: string) => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
      return;
    }
    
    if (Notification.permission !== 'granted') {
      return;
    }

    try {
      const { messaging } = await import('../firebase/config');
      if (!messaging) return;

      const { getToken } = await import('firebase/messaging');
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        console.warn('VITE_FIREBASE_VAPID_KEY is not defined in environment variables.');
        return;
      }

      // Wait for service worker to be ready
      const registration = await navigator.serviceWorker.ready;

      const currentToken = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration
      });

      if (currentToken) {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../firebase/config');
        if (db) {
          const userDocRef = doc(db, 'users', uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            const existingTokens = data.fcmTokens || [];
            if (!existingTokens.includes(currentToken)) {
              const updatedTokens = [...existingTokens, currentToken];
              await dbService.set('users', uid, { fcmTokens: updatedTokens });
              console.log('Registered FCM Token successfully:', currentToken);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to sync FCM Token:', err);
    }
  }
}));

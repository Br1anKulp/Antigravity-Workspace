import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  getDoc
} from 'firebase/firestore';
import type { Firestore, WhereFilterOp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, isMockMode } from './config';
import { safeStorage } from '../utils/storage';

interface DbItem {
  id?: string;
  uid?: string;
  email?: string;
  [key: string]: unknown;
}

// Safety timeout helper for database operations to prevent infinite spinner hangs
const withTimeout = <T>(promise: Promise<T>, timeoutMs = 8000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Firebase database request timed out.")), timeoutMs)
    )
  ]);
};

// Helper to notify other tabs when mock data changes
const triggerMockSync = (key: string) => {
  window.dispatchEvent(new CustomEvent('mock-db-update', { detail: { key } }));
  // Storage event triggers for other tabs/windows
  safeStorage.setItem('__slate_sync_trigger__', Date.now().toString());
};

// Define initial mock data
const INITIAL_ALLOWED_USERS = [
  'brian.k.kulp@gmail.com',
  'familynflowers@protonmail.com'
];

const MOCK_PROFILES: Record<string, Record<string, unknown>> = {
  'brian_k_kulp_gmail_com': {
    uid: 'user-brian',
    email: 'brian.k.kulp@gmail.com',
    name: 'Brian',
    avatarColor: '#3b82f6', // blue
    avatarEmoji: '⚡',
    notificationPreferences: {
      cardAssigned: true,
      cardMoved: true,
      commentAdded: true,
      dueDateReminder: true,
      cardCompleted: true,
      wipLimitExceeded: true
    },
    calendarDefaultView: 'Month'
  },
  'familynflowers_protonmail_com': {
    uid: 'user-partner',
    email: 'familynflowers@protonmail.com',
    name: 'Flower',
    avatarColor: '#ec4899', // pink
    avatarEmoji: '🌸',
    notificationPreferences: {
      cardAssigned: true,
      cardMoved: true,
      commentAdded: true,
      dueDateReminder: true,
      cardCompleted: true,
      wipLimitExceeded: true
    },
    calendarDefaultView: 'Month'
  }
};

// Initialize Mock database structure if empty
const getMockCollection = (colName: string): unknown[] => {
  const data = safeStorage.getItem(`slate_mock_${colName}`);
  if (!data) {
    // Seed default allowed users
    if (colName === 'allowedUsers') {
      safeStorage.setItem(`slate_mock_allowedUsers`, JSON.stringify(INITIAL_ALLOWED_USERS));
      return INITIAL_ALLOWED_USERS;
    }
    // Seed default boards
    if (colName === 'boards') {
      const defaultBoards = [{ id: 'board-home', name: '🏠 Home & Family', description: 'Coordinating house tasks, groceries, and plans', creatorId: 'user-brian' }];
      safeStorage.setItem(`slate_mock_boards`, JSON.stringify(defaultBoards));
      return defaultBoards;
    }
    // Seed default columns
    if (colName === 'columns') {
      const defaultCols = [
        { id: 'col-backlog', boardId: 'board-home', name: 'Backlog', order: 0, wipLimit: 10 },
        { id: 'col-todo', boardId: 'board-home', name: 'To Do', order: 1, wipLimit: 5 },
        { id: 'col-inprogress', boardId: 'board-home', name: 'In Progress', order: 2, wipLimit: 3 },
        { id: 'col-review', boardId: 'board-home', name: 'Review', order: 3, wipLimit: 5 },
        { id: 'col-done', boardId: 'board-home', name: 'Done', order: 4, wipLimit: 20 }
      ];
      safeStorage.setItem(`slate_mock_columns`, JSON.stringify(defaultCols));
      return defaultCols;
    }
    return [];
  }
  return JSON.parse(data);
};

const saveMockCollection = (colName: string, items: unknown[]) => {
  safeStorage.setItem(`slate_mock_${colName}`, JSON.stringify(items));
  triggerMockSync(colName);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cleanUndefined = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanUndefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newObj: any = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      newObj[key] = cleanUndefined(obj[key]);
    }
  }
  return newObj;
};

// Unified DB API interface
export const dbService = {
  // Listen for real-time collection changes
  subscribe: <T>(
    colName: string, 
    callback: (data: T[]) => void, 
    filters?: { field: string; op: WhereFilterOp; value: unknown }[],
    onError?: (error: Error) => void
  ) => {
    if (isMockMode) {
      // Return current mock data
      const getFilteredData = () => {
        let items = getMockCollection(colName) as unknown as T[];
        if (filters) {
          filters.forEach(f => {
            items = items.filter(item => {
              const val = (item as Record<string, unknown>)[f.field];
              if (f.op === '==') return val === f.value;
              if (f.op === 'in') return Array.isArray(f.value) && f.value.includes(val);
              return true;
            });
          });
        }
        return items;
      };

      callback(getFilteredData());

      // Setup window listeners for updates from other files/tabs
      const handleSync = () => {
        callback(getFilteredData());
      };
      
      window.addEventListener('mock-db-update', handleSync);
      window.addEventListener('storage', handleSync);

      return () => {
        window.removeEventListener('mock-db-update', handleSync);
        window.removeEventListener('storage', handleSync);
      };
    } else {
      // Live Firebase Firestore listener
      let q = query(collection(db as Firestore, colName));
      if (filters) {
        filters.forEach(f => {
          q = query(q, where(f.field, f.op, f.value));
        });
      }
      return onSnapshot(q, (snapshot) => {
        const items: T[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as unknown as T);
        });
        callback(items);
      }, (error) => {
        console.error(`Firestore subscribe error for ${colName}:`, error);
        if (onError) {
          onError(error);
        }
      });
    }
  },

  // Document management: Set/Save document
  set: async <T>(colName: string, docId: string, data: T): Promise<T & { id: string }> => {
    if (isMockMode) {
      const items = getMockCollection(colName) as DbItem[];
      const index = items.findIndex(item => item.id === docId);
      const updatedItem = { ...items[index], ...data, id: docId } as unknown as T & { id: string };
      if (index >= 0) {
        items[index] = updatedItem as unknown as DbItem;
      } else {
        items.push(updatedItem as unknown as DbItem);
      }
      saveMockCollection(colName, items);
      return updatedItem;
    } else {
      const docRef = doc(db as Firestore, colName, docId);
      const cleaned = cleanUndefined(data);
      await setDoc(docRef, cleaned as Record<string, unknown>, { merge: true });
      return { id: docId, ...data } as unknown as T & { id: string };
    }
  },

  // Document management: Add document (auto-generated ID)
  add: async <T>(colName: string, data: T): Promise<T & { id: string }> => {
    if (isMockMode) {
      const newId = Math.random().toString(36).substring(2, 11);
      const items = getMockCollection(colName) as DbItem[];
      const newItem = { ...data, id: newId } as unknown as T & { id: string };
      items.push(newItem as unknown as DbItem);
      saveMockCollection(colName, items);
      return newItem;
    } else {
      const docRef = doc(collection(db as Firestore, colName));
      const newId = docRef.id;
      const cleaned = cleanUndefined(data);
      await setDoc(docRef, cleaned as Record<string, unknown>);
      return { id: newId, ...data } as unknown as T & { id: string };
    }
  },

  // Document management: Delete document
  delete: async (colName: string, docId: string) => {
    if (isMockMode) {
      let items = getMockCollection(colName) as DbItem[];
      items = items.filter(item => item.id !== docId);
      saveMockCollection(colName, items);
    } else {
      const docRef = doc(db as Firestore, colName, docId);
      await deleteDoc(docRef);
    }
  },

  // Whitelist verification logic
  checkWhitelist: async (email: string): Promise<boolean> => {
    const normalizedEmail = email.toLowerCase().trim();
    if (isMockMode) {
      const allowed = getMockCollection('allowedUsers') as string[];
      return allowed.map((e: string) => e.toLowerCase()).includes(normalizedEmail);
    } else {
      const docRef = doc(db as Firestore, 'allowedUsers', normalizedEmail);
      const docSnap = await withTimeout(getDoc(docRef));
      return docSnap.exists();
    }
  },

  // Fetch or create user profile on login
  getOrCreateProfile: async (uid: string, email: string, defaultName?: string) => {
    if (isMockMode) {
      const key = email.replace(/\./g, '_').replace(/@/g, '_');
      const staticProfile = MOCK_PROFILES[key] || {
        uid,
        email,
        name: defaultName || email.split('@')[0],
        avatarColor: '#64748b',
        avatarEmoji: '👤',
        notificationPreferences: {
          cardAssigned: true,
          cardMoved: true,
          commentAdded: true,
          dueDateReminder: true,
          cardCompleted: true,
          wipLimitExceeded: true
        },
        calendarDefaultView: 'Month'
      };
      
      // Load stored custom profile if it exists
      const profiles = getMockCollection('users') as DbItem[];
      const existing = profiles.find(p => p.uid === uid || p.email === email);
      if (existing) {
        return existing;
      } else {
        const newProfile = { ...staticProfile, id: uid, uid };
        profiles.push(newProfile);
        saveMockCollection('users', profiles);
        return newProfile;
      }
    } else {
      const docRef = doc(db as Firestore, 'users', uid);
      const docSnap = await withTimeout(getDoc(docRef));
      if (docSnap.exists()) {
        return docSnap.data();
      } else {
        const newProfile = {
          uid,
          email,
          name: defaultName || email.split('@')[0],
          avatarColor: email === 'brian.k.kulp@gmail.com' ? '#3b82f6' : '#ec4899',
          avatarEmoji: email === 'brian.k.kulp@gmail.com' ? '⚡' : '🌸',
          notificationPreferences: {
            cardAssigned: true,
            cardMoved: true,
            commentAdded: true,
            dueDateReminder: true,
            cardCompleted: true,
            wipLimitExceeded: true
          },
          calendarDefaultView: 'Month'
        };
        await withTimeout(setDoc(docRef, newProfile));
        return { id: uid, ...newProfile };
      }
    }
  },

  // Migrate mock data to live firestore
  migrateMockData: async (uid: string) => {
    const collectionsToMigrate = ['boards', 'columns', 'cards', 'tasks', 'notes', 'events', 'messages'];
    let hasData = false;
    for (const col of collectionsToMigrate) {
      const data = safeStorage.getItem(`slate_mock_${col}`);
      if (data) {
        const items = JSON.parse(data);
        if (items && items.length > 0) {
          hasData = true;
          break;
        }
      }
    }
    if (!hasData) return;

    const migrationFlag = `slate_migrated_${uid}`;
    if (safeStorage.getItem(migrationFlag) === 'true') return;

    console.log("Migrating mock data to live firestore...");
    try {
      const safeMigrate = async (colName: string, itemId: string, cleanedData: Record<string, unknown>) => {
        const docRef = doc(db as Firestore, colName, itemId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const liveData = docSnap.data();
          const liveTime = liveData ? ((liveData.lastEditedAt || liveData.createdAt) as string | number | Date | undefined) : undefined;
          const mockTime = (cleanedData.lastEditedAt || cleanedData.createdAt) as string | number | Date | undefined;
          if (liveTime && mockTime) {
            if (new Date(liveTime) > new Date(mockTime)) {
              console.log(`Skipping migration for ${colName}/${itemId} (live version is newer)`);
              return;
            }
          } else {
            console.log(`Skipping migration for ${colName}/${itemId} (already exists in live database)`);
            return;
          }
        }
        await dbService.set(colName, itemId, cleanedData);
      };

      const boardsData = safeStorage.getItem('slate_mock_boards');
      if (boardsData) {
        const boards = JSON.parse(boardsData);
        for (const b of boards) {
          const cleaned = { ...b };
          if (cleaned.creatorId === 'user-brian' || cleaned.creatorId === 'user-partner') {
            cleaned.creatorId = uid;
          }
          await safeMigrate('boards', b.id, cleaned);
        }
      }

      const columnsData = safeStorage.getItem('slate_mock_columns');
      if (columnsData) {
        const columns = JSON.parse(columnsData);
        for (const c of columns) {
          await safeMigrate('columns', c.id, c);
        }
      }

      const cardsData = safeStorage.getItem('slate_mock_cards');
      if (cardsData) {
        const cards = JSON.parse(cardsData);
        for (const c of cards) {
          const cleaned = { ...c };
          if (cleaned.creatorId === 'user-brian' || cleaned.creatorId === 'user-partner') {
            cleaned.creatorId = uid;
          }
          await safeMigrate('cards', c.id, cleaned);
        }
      }

      const tasksData = safeStorage.getItem('slate_mock_tasks');
      if (tasksData) {
        const tasks = JSON.parse(tasksData);
        for (const t of tasks) {
          const cleaned = { ...t };
          if (cleaned.creatorId === 'user-brian' || cleaned.creatorId === 'user-partner') {
            cleaned.creatorId = uid;
          }
          await safeMigrate('tasks', t.id, cleaned);
        }
      }

      const notesData = safeStorage.getItem('slate_mock_notes');
      if (notesData) {
        const notes = JSON.parse(notesData);
        for (const n of notes) {
          const cleaned = { ...n };
          if (cleaned.creatorId === 'user-brian' || cleaned.creatorId === 'user-partner') {
            cleaned.creatorId = uid;
          }
          if (cleaned.lastEditedById === 'user-brian' || cleaned.lastEditedById === 'user-partner') {
            cleaned.lastEditedById = uid;
          }
          await safeMigrate('notes', n.id, cleaned);
        }
      }

      const eventsData = safeStorage.getItem('slate_mock_events');
      if (eventsData) {
        const events = JSON.parse(eventsData);
        for (const e of events) {
          const cleaned = { ...e };
          if (cleaned.creatorId === 'user-brian' || cleaned.creatorId === 'user-partner') {
            cleaned.creatorId = uid;
          }
          await safeMigrate('events', e.id, cleaned);
        }
      }

      const messagesData = safeStorage.getItem('slate_mock_messages');
      if (messagesData) {
        const messages = JSON.parse(messagesData);
        for (const m of messages) {
          const cleaned = { ...m };
          if (cleaned.senderId === 'user-brian' || cleaned.senderId === 'user-partner') {
            cleaned.senderId = uid;
          }
          await safeMigrate('messages', m.id, cleaned);
        }
      }

      safeStorage.setItem(migrationFlag, 'true');
      console.log("Migration complete!");
    } catch (err) {
      console.error("Migration error:", err);
    }
  },

  // Upload attachment file (Storage bucket or mock base64/url)
  uploadFile: async (filePath: string, file: File, onProgress?: (pct: number) => void): Promise<string> => {
    if (isMockMode) {
      if (onProgress) {
        onProgress(20);
        setTimeout(() => onProgress(60), 100);
        setTimeout(() => onProgress(100), 200);
      }
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) {
            resolve(reader.result as string);
          } else {
            reject(new Error("Failed to read file."));
          }
        };
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsDataURL(file);
      });
    } else {
      if (!storage) throw new Error("Firebase Storage is not initialized.");
      const fileRef = ref(storage, filePath);
      const uploadTask = uploadBytesResumable(fileRef, file);
      
      return new Promise((resolve, reject) => {
        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            if (onProgress) onProgress(Math.round(progress));
          }, 
          (error) => reject(error), 
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          }
        );
      });
    }
  },

  // Delete raw file from Firebase Storage bucket
  deleteFile: async (fileUrl: string): Promise<void> => {
    if (isMockMode || !fileUrl || !fileUrl.startsWith('http') || !storage) return;
    try {
      const fileRef = ref(storage, fileUrl);
      await deleteObject(fileRef);
    } catch (err) {
      console.warn("Raw storage file deletion failed:", err);
    }
  }
};

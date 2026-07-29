import { create } from 'zustand';
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import { auth, isMockMode } from '../firebase/config';
import { dbService } from '../firebase/db';
import { safeStorage } from '../utils/storage';

export interface StoredCalendarConfig {
  id: string;
  summary: string;
  color: string;
  selected: boolean;
  visibility?: 'self' | 'both';
}

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  avatarColor: string;
  avatarEmoji: string;
  calendarDefaultView: string;
  lastActive?: string;
  isTyping?: boolean;
  lastReadChat?: string;
  calendarConfigs?: StoredCalendarConfig[];
  notificationPreferences: {
    cardAssigned: boolean;
    cardMoved: boolean;
    commentAdded: boolean;
    dueDateReminder: boolean;
    cardCompleted: boolean;
    wipLimitExceeded: boolean;
  };
}

interface AuthState {
  user: UserProfile | null;
  partner: UserProfile | null;
  partnerUnsub: (() => void) | null;
  loading: boolean;
  error: string | null;
  theme: 'light' | 'dark';
  init: () => void;
  signIn: (email: string, password?: string, rememberMe?: boolean) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
  toggleTheme: () => void;
  getGoogleCalendarToken: () => Promise<string | null>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  partner: null,
  partnerUnsub: null,
  loading: true,
  error: null,
  theme: 'dark', // default theme

  init: () => {
    // Read cached user/theme
    const cachedTheme = safeStorage.getItem('slate_theme') as 'light' | 'dark';
    if (cachedTheme) {
      set({ theme: cachedTheme });
      document.documentElement.classList.toggle('dark', cachedTheme === 'dark');
    } else {
      document.documentElement.classList.add('dark');
    }

    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const TIMEOUT_MS = isMobile ? 12000 : 3000;

    // Safety timeout to prevent infinite loading spinners if Firebase hangs
    const timeoutId = setTimeout(() => {
      if (get().loading) {
        console.warn('Firebase initialization timed out. Falling back to offline mode.');
        const savedUser = safeStorage.getItem('slate_mock_user');
        if (savedUser) {
          set({ user: JSON.parse(savedUser), loading: false });
        } else {
          set({ loading: false });
        }
      }
    }, TIMEOUT_MS);

    if (isMockMode) {
      clearTimeout(timeoutId);
      // Mock persistent session check
      const savedUser = safeStorage.getItem('slate_mock_user');
      if (savedUser) {
        const user = JSON.parse(savedUser);
        set({ user, loading: false });
        // Fetch partner
        const partnerEmail = user.email === 'brian.k.kulp@gmail.com' 
          ? 'familynflowers@protonmail.com' 
          : 'brian.k.kulp@gmail.com';
        
        const existingUnsub = get().partnerUnsub;
        if (existingUnsub) {
          existingUnsub();
        }

        const unsub = dbService.subscribe<UserProfile>('users', (users) => {
          const p = users.find(u => u.email === partnerEmail);
          if (p) set({ partner: p });
        });
        set({ partnerUnsub: unsub });
      } else {
        set({ loading: false });
      }
    } else {
      if (!auth) {
        clearTimeout(timeoutId);
        console.warn('Firebase Auth is uninitialized. Running in local offline mode.');
        set({ loading: false });
        return;
      }

      let redirectChecked = false;
      let initialAuthChecked = false;

      const firebaseAuth = auth as Auth;

      // Handle redirect result first (mobile Google sign-in)
      getRedirectResult(firebaseAuth).then(async (result) => {
        redirectChecked = true;
        if (result?.user) {
          // A user successfully signed in via redirect.
          // onAuthStateChanged will handle profile creation below.
        } else {
          // No redirect result.
          // If onAuthStateChanged has already fired with null, we can safely set loading: false.
          if (initialAuthChecked && !firebaseAuth.currentUser) {
            clearTimeout(timeoutId);
            set({ user: null, partner: null, loading: false });
          }
        }
      }).catch((err) => {
        console.error('Redirect result error:', err);
        redirectChecked = true;
        clearTimeout(timeoutId);
        set({ error: `Redirect error: ${err.message}`, loading: false });
      });

      // Live Firebase auth state listener
      onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
        initialAuthChecked = true;
        if (firebaseUser && firebaseUser.email) {
          clearTimeout(timeoutId);
          try {
            // Check whitelist first
            const isAllowed = await dbService.checkWhitelist(firebaseUser.email);
            if (!isAllowed) {
              await firebaseSignOut(firebaseAuth);
              set({ user: null, partner: null, error: 'Access Denied: Your email is not pre-approved.', loading: false });
              return;
            }

            const profile = await dbService.getOrCreateProfile(
              firebaseUser.uid, 
              firebaseUser.email, 
              firebaseUser.displayName || undefined
            ) as UserProfile;
            
            set({ user: profile, error: null, loading: false });
            
            // Trigger automatic local-to-live migration if mock data exists
            await dbService.migrateMockData(firebaseUser.uid);
            
            // Sync theme preference
            if (profile.calendarDefaultView) {
              // Can read calendarDefaultView, theme details, etc.
            }

            // Listen to all profiles to sync partner info
            const partnerEmail = firebaseUser.email === 'brian.k.kulp@gmail.com' 
              ? 'familynflowers@protonmail.com' 
              : 'brian.k.kulp@gmail.com';

            const existingUnsub = get().partnerUnsub;
            if (existingUnsub) {
              existingUnsub();
            }

            const unsub = dbService.subscribe<UserProfile>('users', (users) => {
              const me = users.find(u => u.uid === firebaseUser.uid);
              if (me) set({ user: me });
              const p = users.find(u => u.email === partnerEmail);
              if (p) set({ partner: p });
            });
            set({ partnerUnsub: unsub });

          } catch (err) {
            console.error('Error fetching profile:', err);
            set({ error: err instanceof Error ? err.message : String(err), loading: false });
          }
        } else {
          // Only set user to null and loading to false if redirect has finished checking!
          if (redirectChecked) {
            clearTimeout(timeoutId);
            set({ user: null, partner: null, loading: false });
          }
        }
      });
    }
  },

  signIn: async (email: string, password?: string, rememberMe = true) => {
    set({ loading: true, error: null });
    const normalizedEmail = email.toLowerCase().trim();

    if (isMockMode) {
      // Check whitelist client-side first
      const isAllowed = await dbService.checkWhitelist(normalizedEmail);
      if (!isAllowed) {
        set({ error: 'Access Denied: Your email is not pre-approved.', loading: false });
        return false;
      }

      // Simulate network request
      await new Promise(r => setTimeout(r, 800));
      const mockUid = normalizedEmail === 'brian.k.kulp@gmail.com' ? 'user-brian' : 'user-partner';
      const profile = await dbService.getOrCreateProfile(mockUid, normalizedEmail);
      
      if (rememberMe) {
        safeStorage.setItem('slate_mock_user', JSON.stringify(profile));
      }
      set({ user: profile as UserProfile, loading: false });

      // Fetch partner info
      const partnerEmail = normalizedEmail === 'brian.k.kulp@gmail.com' 
        ? 'familynflowers@protonmail.com' 
        : 'brian.k.kulp@gmail.com';

      const existingUnsub = get().partnerUnsub;
      if (existingUnsub) {
        existingUnsub();
      }

      const unsub = dbService.subscribe<UserProfile>('users', (users) => {
        const p = users.find(u => u.email === partnerEmail);
        if (p) set({ partner: p });
      });
      set({ partnerUnsub: unsub });

      return true;
    } else {
      try {
        if (!password) {
          set({ error: 'Password required for live authentication.', loading: false });
          return false;
        }
        await signInWithEmailAndPassword(auth as Auth, normalizedEmail, password);
        return true;
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err), loading: false });
        return false;
      }
    }
  },

  signInWithGoogle: async () => {
    set({ loading: true, error: null });
    if (isMockMode) {
      set({ error: 'Google sign-in is not active in mock mode. Please input your email address directly.', loading: false });
      return false;
    }

    try {
      const provider = new GoogleAuthProvider();
      // Check if running in PWA standalone mode
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;
      
      if (isStandalone) {
        // Standalone PWAs must use redirect since popups cannot communicate back to standalone windows on iOS
        await signInWithRedirect(auth as Auth, provider);
        return true;
      }

      try {
        const result = await signInWithPopup(auth as Auth, provider);
        return !!result.user;
      } catch (popupErr) {
        console.warn('Popup sign-in failed or blocked, falling back to redirect:', popupErr);
        // Fall back to redirect if popup is blocked or unsupported in the current browser/webview env
        await signInWithRedirect(auth as Auth, provider);
        return true;
      }
    } catch (err) {
      console.error('Google sign-in error:', err);
      set({ error: err instanceof Error ? err.message : String(err), loading: false });
      return false;
    }
  },

  signOut: async () => {
    set({ loading: true });
    
    const existingUnsub = get().partnerUnsub;
    if (existingUnsub) {
      existingUnsub();
    }
    
    if (isMockMode) {
      safeStorage.removeItem('slate_mock_user');
      set({ user: null, partner: null, partnerUnsub: null, loading: false });
    } else {
      await firebaseSignOut(auth as Auth);
      set({ user: null, partner: null, partnerUnsub: null, loading: false });
    }
  },

  updateProfile: async (data: Partial<UserProfile>) => {
    const { user } = get();
    if (!user) return;

    const updatedUser = { ...user, ...data };
    set({ user: updatedUser });

    if (isMockMode) {
      safeStorage.setItem('slate_mock_user', JSON.stringify(updatedUser));
    }
    await dbService.set('users', user.uid, updatedUser);
  },

  toggleTheme: () => {
    const nextTheme = get().theme === 'light' ? 'dark' : 'light';
    set({ theme: nextTheme });
    safeStorage.setItem('slate_theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  },

  getGoogleCalendarToken: async () => {
    if (isMockMode) {
      await new Promise(r => setTimeout(r, 1000));
      return 'mock-google-token-xyz123';
    } else {
      if (!auth) throw new Error('Auth uninitialized');
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
      // Popup is required here to get an inline access token (redirect cannot return credentials)
      try {
        const result = await signInWithPopup(auth as Auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        return credential?.accessToken || null;
      } catch (err) {
        // On mobile, popup may be blocked — surface a clear error
        if (err && typeof err === 'object' && 'code' in err) {
          const code = (err as Record<string, unknown>).code;
          if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
            throw new Error('Popup was blocked by your browser. Please allow popups for this site in your browser settings to connect Google Calendar.', { cause: err });
          }
        }
        throw err;
      }
    }
  }
}));

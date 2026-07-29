import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';

import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import type { Messaging } from 'firebase/messaging';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Check if valid configuration keys exist
export const isMockMode = !firebaseConfig.apiKey || firebaseConfig.apiKey === 'YOUR_API_KEY';

let firebaseApp;
let firebaseAuth: Auth | null = null;
let firebaseDb: Firestore | null = null;
let firebaseStorage: FirebaseStorage | null = null;
let firebaseMessaging: Messaging | null = null;

if (!isMockMode) {
  try {
    firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    firebaseAuth = getAuth(firebaseApp);
    firebaseDb = initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
    firebaseStorage = getStorage(firebaseApp);
    firebaseStorage.maxUploadRetryTime = 120000; // 2 minutes max retry for uploads
    firebaseStorage.maxOperationRetryTime = 120000; // 2 minutes max retry for other operations
    try {
      firebaseMessaging = getMessaging(firebaseApp);
    } catch {
      firebaseMessaging = null;
    }
  } catch (error) {
    console.error('Failed to initialize Firebase, falling back to mock mode:', error);
  }
}

export { firebaseAuth as auth, firebaseDb as db, firebaseStorage as storage, firebaseMessaging as messaging };

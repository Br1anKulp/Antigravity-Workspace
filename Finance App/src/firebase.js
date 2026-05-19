import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBVcH-Mv49iqe2v1rW9CQB0MyphaaHMzNY",
  authDomain: "finance-app-a08c0.firebaseapp.com",
  projectId: "finance-app-a08c0",
  storageBucket: "finance-app-a08c0.firebasestorage.app",
  messagingSenderId: "235135083374",
  appId: "1:235135083374:web:894f2a5c2cf111aca5577f"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

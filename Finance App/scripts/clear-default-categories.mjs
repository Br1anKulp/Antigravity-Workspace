// Script to wipe all default categories from Firestore budget documents
// Run with: node scripts/clear-default-categories.mjs

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, setDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBVcH-Mv49iqe2v1rW9CQB0MyphaaHMzNY",
  authDomain: "finance-app-a08c0.firebaseapp.com",
  projectId: "finance-app-a08c0",
  storageBucket: "finance-app-a08c0.firebasestorage.app",
  messagingSenderId: "235135083374",
  appId: "1:235135083374:web:894f2a5c2cf111aca5577f"
};

const DEFAULT_CATEGORIES = [
  'Home Expenses', 'Transportation', 'Daily Living',
  'Entertainment', 'Health', 'Personal', 'Savings', 'Donations', 'Misc'
];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function clearDefaultCategories() {
  console.log('Fetching all budget documents...');
  const snapshot = await getDocs(collection(db, 'budgets'));
  
  console.log(`Found ${snapshot.docs.length} budget document(s).`);
  let updated = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    let modified = false;
    const newData = { ...data };

    for (const cat of DEFAULT_CATEGORIES) {
      if (newData[cat] !== undefined) {
        delete newData[cat];
        modified = true;
        console.log(`  Removing "${cat}" from: ${docSnap.id}`);
      }
    }

    if (modified) {
      await setDoc(doc(db, 'budgets', docSnap.id), newData);
      updated++;
      console.log(`  ✓ Saved: ${docSnap.id}`);
    } else {
      console.log(`  ✓ No default categories found in: ${docSnap.id}`);
    }
  }

  console.log(`\nDone. ${updated} document(s) updated.`);
  process.exit(0);
}

clearDefaultCategories().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

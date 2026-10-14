/* eslint-env node */
/**
 * One-time migration script: Seed Kulp household data into Firestore.
 * Run with: node scripts/migrate-household.js
 * 
 * This creates:
 * 1. households/kulp-family document
 * 2. householdId field on both user profile documents
 */
const admin = require('firebase-admin');
const serviceAccount = require('../functions/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'goodstewardbudget'
});

const db = admin.firestore();

async function migrate() {
  console.log('Starting Kulp household migration...');

  // 1. Create the household document
  const householdRef = db.collection('households').doc('kulp-family');
  const existing = await householdRef.get();
  if (existing.exists) {
    console.log('households/kulp-family already exists, skipping creation.');
  } else {
    await householdRef.set({
      name: 'Kulp Family',
      members: ['brian.k.kulp@gmail.com', 'familynflowers@protonmail.com'],
      primaryPlaidUser: 'brian.k.kulp@gmail.com',
      adminEmail: 'brian.k.kulp@gmail.com',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('✅ Created households/kulp-family');
  }

  // 2. Set householdId on user profile documents
  const users = [
    'brian.k.kulp@gmail.com',
    'familynflowers@protonmail.com'
  ];

  for (const email of users) {
    const userRef = db.collection('users').doc(email);
    await userRef.set({ householdId: 'kulp-family' }, { merge: true });
    console.log(`✅ Set householdId on users/${email}`);
  }

  console.log('\nMigration complete! Your existing data is untouched.');
  console.log('All transactions, budgets, and Plaid items remain exactly as they are.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

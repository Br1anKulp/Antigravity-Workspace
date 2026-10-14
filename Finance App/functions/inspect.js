import admin from 'firebase-admin';

async function inspectProject(projectId) {
  console.log(`\n=== Inspecting project: ${projectId} ===`);
  const app = admin.initializeApp({ projectId }, projectId);
  const db = app.firestore();
  
  try {
    // 1. Budgets list
    const budgetsSnapshot = await db.collection('budgets').get();
    console.log(`Total Budget documents: ${budgetsSnapshot.size}`);
    budgetsSnapshot.forEach(doc => {
      console.log(`  - Budget ID: ${doc.id}`);
    });
    
    // 2. Transactions list
    const txSnapshot = await db.collection('transactions').get();
    console.log(`Total Transaction documents: ${txSnapshot.size}`);
    
    const dates = new Set();
    const householdIds = new Set();
    txSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.date) {
        dates.add(String(data.date).substring(0, 7));
      }
      if (data.householdId) {
        householdIds.add(data.householdId);
      }
    });
    console.log(`Transaction months in DB:`, Array.from(dates).sort());
    console.log(`Household IDs in DB:`, Array.from(householdIds));
  } catch (err) {
    console.error(`Error inspecting ${projectId}:`, err.message);
  } finally {
    await app.delete();
  }
}

async function main() {
  // Let gcloud ADC authenticate us automatically
  process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';
  
  await inspectProject('finance-app-a08c0');
  await inspectProject('goodstewardbudget');
}

main().catch(console.error);

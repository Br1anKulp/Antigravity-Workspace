const admin = require('firebase-admin');

// Initialize firebase admin with standard native credentials lookup
admin.initializeApp({
  projectId: 'kulpslate'
});

const db = admin.firestore();

async function run() {
  console.log("Reading allowedUsers from Firestore admin SDK...");
  try {
    const snapshot = await db.collection('allowedUsers').get();
    console.log("Documents in allowedUsers:");
    snapshot.forEach(doc => {
      console.log(`- ${doc.id}:`, doc.data());
    });
  } catch (err) {
    console.error("Admin SDK error reading allowedUsers:", err);
  }
}

run();

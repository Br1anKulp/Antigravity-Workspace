const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });
const { Configuration, PlaidApi, PlaidEnvironments } = require("plaid");

admin.initializeApp();
const db = admin.firestore();

// Helper to initialize Plaid Client dynamically based on environment config
function getPlaidClient() {
  const env = process.env.PLAID_ENV || "development";
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;

  if (!clientId || !secret) {
    throw new Error("Missing PLAID_CLIENT_ID or PLAID_SECRET in environment variables.");
  }

  const configuration = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });

  return new PlaidApi(configuration);
}

/**
 * 1. Create Plaid Link Token
 * Endpoint: POST /createLinkToken
 */
exports.createlinktoken = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "Missing userId" });
      }

      const plaidClient = getPlaidClient();
      const response = await plaidClient.linkTokenCreate({
        user: { client_user_id: userId },
        client_name: "Good Steward Finance",
        products: ["transactions"],
        country_codes: ["US"],
        language: "en",
      });

      return res.status(200).json(response.data);
    } catch (error) {
      console.error("Error creating link token:", error);
      return res.status(500).json({ error: error.message });
    }
  });
});

/**
 * 2. Exchange Public Token and Save Item Credentials
 * Endpoint: POST /exchangePublicToken
 */
exports.exchangepublictoken = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      const { publicToken, userId, institutionName, householdId } = req.body;
      if (!publicToken || !userId || !householdId) {
        return res.status(400).json({ error: "Missing publicToken, userId, or householdId" });
      }

      const plaidClient = getPlaidClient();
      const response = await plaidClient.itemPublicTokenExchange({
        public_token: publicToken,
      });

      const { access_token, item_id } = response.data;

      // Save access token securely in firestore under a subcollection
      const docRef = db.collection("users").doc(userId).collection("plaid_items").doc(item_id);
      await docRef.set({
        accessToken: access_token,
        itemId: item_id,
        institutionName: institutionName || "Bank",
        userId,
        householdId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        cursor: null // Initial transaction sync cursor is null
      });

      return res.status(200).json({ success: true, itemId: item_id });
    } catch (error) {
      console.error("Error exchanging public token:", error);
      return res.status(500).json({ error: error.message });
    }
  });
});

/**
 * 3. Sync Transactions from linked bank account
 * Endpoint: POST /syncTransactions
 */
exports.synctransactions = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      const { userId, householdId } = req.body;
      if (!userId || !householdId) {
        return res.status(400).json({ error: "Missing userId or householdId" });
      }

      const plaidClient = getPlaidClient();
      
      // Fetch all linked plaid items for the user
      const itemsSnapshot = await db.collection("users").doc(userId).collection("plaid_items").get();
      
      if (itemsSnapshot.empty) {
        return res.status(200).json({ message: "No bank accounts linked.", syncedCount: 0 });
      }

      let totalSynced = 0;

      for (const itemDoc of itemsSnapshot.docs) {
        const itemData = itemDoc.data();
        const { accessToken, cursor, institutionName } = itemData;

        let hasMore = true;
        let nextCursor = cursor;
        let addedTxs = [];

        // Loop through pages of transactions from Plaid Sync API
        while (hasMore) {
          const syncResponse = await plaidClient.transactionsSync({
            access_token: accessToken,
            cursor: nextCursor || undefined,
            count: 200,
          });

          const data = syncResponse.data;
          addedTxs = addedTxs.concat(data.added);
          nextCursor = data.next_cursor;
          hasMore = data.has_more;
        }

        // Process and insert new transactions into Firestore
        for (const tx of addedTxs) {
          const txAmount = parseFloat(tx.amount);
          
          // Plaid represents expenses as positive numbers and income as negative.
          // We match this schema (positive for expense, type: 'expense' / positive for income, type: 'income')
          const type = txAmount > 0 ? "expense" : "income";
          const finalAmount = Math.abs(txAmount);

          // Simple default category mapping
          let category = "Uncategorized";
          if (type === "income") {
            category = "Income";
          }

          // Store transaction in firestore
          await db.collection("bank_transactions").add({
            title: tx.name || "Plaid Transaction",
            amount: finalAmount,
            type: type,
            category: category,
            subcategory: "", // Let the user assign subcategory
            user: userId,
            householdId: householdId,
            date: new Date(tx.date + "T12:00:00").toISOString(),
            status: "paid",
            paymentMethod: institutionName || "Linked Bank",
            notes: `Imported from ${institutionName || "bank"}. Ref: ${tx.transaction_id}`,
            plaidTransactionId: tx.transaction_id
          });

          totalSynced++;
        }

        // Update cursor in Firestore to avoid fetching duplicates next time
        await itemDoc.ref.update({
          cursor: nextCursor,
        });
      }

      return res.status(200).json({ success: true, syncedCount: totalSynced });
    } catch (error) {
      console.error("Error syncing transactions:", error);
      return res.status(500).json({ error: error.message });
    }
  });
});

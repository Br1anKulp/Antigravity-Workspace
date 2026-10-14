const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });
const { Configuration, PlaidApi, PlaidEnvironments } = require("plaid");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

// Helper to initialize Plaid Client dynamically based on environment config
function getPlaidClient() {
  const env = process.env.PLAID_ENV || "production";
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;

  if (!clientId || !secret) {
    throw new Error("Missing PLAID_CLIENT_ID or PLAID_SECRET in environment variables.");
  }

  const basePath = PlaidEnvironments[env] || PlaidEnvironments.production || PlaidEnvironments.sandbox;

  const configuration = new Configuration({
    basePath: basePath,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });

  return new PlaidApi(configuration);
}

// Optional Auth Verification Helper
async function verifyAuth(req) {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      return await admin.auth().verifyIdToken(token);
    } catch (err) {
      console.warn("Invalid Auth Token provided:", err.message);
    }
  }
  return null;
}

/**
 * 1. Create Plaid Link Token
 * Endpoint: POST /createLinkToken
 */
exports.createlinktoken = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      const authUser = await verifyAuth(req);
      const userId = authUser ? authUser.email : req.body.userId;

      if (!userId) {
        return res.status(400).json({ error: "Missing userId or valid Auth Token" });
      }

      const plaidClient = getPlaidClient();
      const clientUserId = crypto.createHash("sha256").update(userId).digest("hex");
      const response = await plaidClient.linkTokenCreate({
        user: { client_user_id: clientUserId },
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
      const authUser = await verifyAuth(req);
      const userId = authUser ? authUser.email : req.body.userId;
      const { publicToken, institutionName, householdId } = req.body;

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
      const authUser = await verifyAuth(req);
      const userId = authUser ? authUser.email : req.body.userId;
      const { householdId } = req.body;

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

      // Pre-fetch existing plaid transaction IDs to avoid N+1 queries inside loop
      const existingPlaidIds = new Set();
      const [bankSnap, txSnap] = await Promise.all([
        db.collection("bank_transactions").where("householdId", "==", householdId).get(),
        db.collection("transactions").where("householdId", "==", householdId).get()
      ]);

      bankSnap.forEach(doc => {
        const pid = doc.data().plaidTransactionId;
        if (pid) existingPlaidIds.add(pid);
      });
      txSnap.forEach(doc => {
        const pid = doc.data().plaidTransactionId;
        if (pid) existingPlaidIds.add(pid);
      });

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

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Process and insert new transactions into Firestore
        for (const tx of addedTxs) {
          if (existingPlaidIds.has(tx.transaction_id)) {
            console.log(`Transaction ${tx.transaction_id} already exists. Skipping.`);
            continue;
          }

          const txDate = new Date(tx.date + "T12:00:00");
          if (txDate < thirtyDaysAgo) {
            // Discard transactions older than 30 days
            continue;
          }

          const txAmount = parseFloat(tx.amount);
          
          // Plaid represents expenses as positive numbers and income as negative.
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
            date: txDate.toISOString(),
            status: "paid",
            paymentMethod: institutionName || "Linked Bank",
            notes: `Imported from ${institutionName || "bank"}. Ref: ${tx.transaction_id}`,
            plaidTransactionId: tx.transaction_id
          });

          existingPlaidIds.add(tx.transaction_id);
          totalSynced++;
        }

        // Update cursor in Firestore to avoid fetching duplicates next time
        await itemDoc.ref.update({
          cursor: nextCursor,
        });
      }

      // Clean up / prune any existing bank transactions older than 30 days safely in chunks of 400
      const pruneCutoff = new Date();
      pruneCutoff.setDate(pruneCutoff.getDate() - 30);
      const pruneCutoffStr = pruneCutoff.toISOString();

      const oldTxsSnapshot = await db.collection("bank_transactions")
        .where("householdId", "==", householdId)
        .where("date", "<", pruneCutoffStr)
        .get();

      if (!oldTxsSnapshot.empty) {
        console.log(`Pruning ${oldTxsSnapshot.size} bank transactions older than 30 days.`);
        const docs = oldTxsSnapshot.docs;
        const chunkSize = 400;
        for (let i = 0; i < docs.length; i += chunkSize) {
          const batch = db.batch();
          docs.slice(i, i + chunkSize).forEach((doc) => {
            batch.delete(doc.ref);
          });
          await batch.commit();
        }
      }

      return res.status(200).json({ success: true, syncedCount: totalSynced });
    } catch (error) {
      console.error("Error syncing transactions:", error);
      return res.status(500).json({ error: error.message });
    }
  });
});

/**
 * Helper to compute and deliver pay-period daily SMS balance summary for a user
 */
async function generateAndSendSmsForUser(userId, householdId) {
  const userSettingsDoc = await db.collection("users").doc(userId).collection("settings").doc("notifications").get();
  if (!userSettingsDoc.exists) return { success: false, reason: "No notification settings found." };
  
  const settings = userSettingsDoc.data();
  if (!settings.smsEnabled || !settings.phoneNumber) {
    return { success: false, reason: "SMS notifications not enabled or missing phone number." };
  }

  // Determine current date in Pacific Time (America/Los_Angeles)
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" });
  const [mStr, dStr, yStr] = dateStr.split("/");
  const currentMonthKey = `${yStr}-${mStr.padStart(2, "0")}`;
  const dayOfMonth = parseInt(dStr, 10);

  const isPayPeriod1 = dayOfMonth <= 14;
  const periodLabel = isPayPeriod1 ? "Pay Period 1: Days 1-14" : "Pay Period 2: Days 15-31";

  // Fetch budget doc for this household
  let budgetDoc = await db.collection("budgets").doc(`${householdId}-${currentMonthKey}`).get();
  // Legacy fallback only for kulp-family if historical budget was stored under bare currentMonthKey
  if (!budgetDoc.exists && householdId === "kulp-family") {
    budgetDoc = await db.collection("budgets").doc(currentMonthKey).get();
  }
  const budgets = budgetDoc.exists ? budgetDoc.data() : {};

  // Fetch transactions for this household
  const txSnap = await db.collection("transactions")
    .where("householdId", "==", householdId)
    .get();

  // Calculate spending ONLY for transactions within the active pay period window
  const categorySpent = {};
  txSnap.forEach(d => {
    const data = d.data();
    if (!data.date || !data.date.startsWith(currentMonthKey)) return;
    if (data.type !== "expense" && data.type !== "refund") return;

    // Parse transaction date day without UTC timezone skew
    const txDay = parseInt((data.date.split("T")[0] || "").split("-")[2], 10) || 1;
    const inPeriod = isPayPeriod1 ? txDay <= 14 : txDay >= 15;
    if (!inPeriod) return; // Skip transactions outside this paycheck period

    const sign = data.type === "refund" ? -1 : 1;
    
    if (data.splits && data.splits.length > 0) {
      data.splits.forEach(sp => {
        const cat = sp.category || data.category;
        const sub = sp.subcategory || "";
        const amt = sign * (parseFloat(sp.amount) || 0);
        if (!categorySpent[cat]) categorySpent[cat] = { total: 0, subs: {} };
        categorySpent[cat].total += amt;
        if (sub) {
          categorySpent[cat].subs[sub] = (categorySpent[cat].subs[sub] || 0) + amt;
        }
      });
    } else {
      const cat = data.category;
      const sub = data.subcategory || "";
      const amt = sign * (parseFloat(data.amount) || 0);
      if (!categorySpent[cat]) categorySpent[cat] = { total: 0, subs: {} };
      categorySpent[cat].total += amt;
      if (sub) {
        categorySpent[cat].subs[sub] = (categorySpent[cat].subs[sub] || 0) + amt;
      }
    }
  });

  const formatRemaining = (rem) => {
    if (rem >= 0) return `$${rem.toFixed(2)} left`;
    return `$${Math.abs(rem).toFixed(2)} over`;
  };

  let smsText = `📊 Good Steward Daily Balance\n(${periodLabel}):\n\n`;
  let totalPeriodLimit = 0;
  let totalPeriodSpent = 0;
  let lineCount = 0;

  const categories = Object.keys(budgets).filter(k => !k.startsWith("_"));

  categories.forEach(cat => {
    const catData = budgets[cat];
    const subcategories = catData.subcategories || {};
    const subKeys = Object.keys(subcategories).filter(k => k !== "_order");

    const activeSubLines = [];
    let catPeriodLimit = 0;
    let catPeriodSpent = 0;

    if (subKeys.length > 0) {
      subKeys.forEach(subName => {
        const subVal = subcategories[subName];
        const subData = typeof subVal === "object" ? subVal : { limit: subVal || 0, dueDate: "" };
        const dueDays = String(subData.dueDate || "").split(",").map(d => parseInt(d.trim())).filter(d => !isNaN(d) && d >= 1 && d <= 31);

        if (dueDays.length === 0) {
          let rawLimit = 0;
          if (typeof subData.limit === "object" && subData.limit !== null) {
            rawLimit = Object.values(subData.limit).reduce((s, val) => s + (parseFloat(val) || 0), 0);
          } else {
            rawLimit = parseFloat(subData.limit) || 0;
          }
          const periodLimit = rawLimit / 2; // Pacing 50% for non-dated items
          const spent = categorySpent[cat]?.subs[subName] || 0;
          const remaining = periodLimit - spent;
          catPeriodLimit += periodLimit;
          catPeriodSpent += spent;
          activeSubLines.push(`  • ${subName}: ${formatRemaining(remaining)}`);
        } else {
          const periodDays = dueDays.filter(day => isPayPeriod1 ? day <= 14 : day >= 15);
          if (periodDays.length > 0) {
            const totalSubSpent = categorySpent[cat]?.subs[subName] || 0;
            catPeriodSpent += totalSubSpent;

            periodDays.forEach(day => {
              let limit = 0;
              if (typeof subData.limit === "object" && subData.limit !== null) {
                limit = parseFloat(subData.limit[day]) || 0;
              } else {
                limit = parseFloat(subData.limit) || 0;
              }
              catPeriodLimit += limit;

              const allocatedSpent = periodDays.length > 1 ? (totalSubSpent / periodDays.length) : totalSubSpent;
              const remaining = limit - allocatedSpent;

              const getOrdinal = (n) => {
                const s = ["th", "st", "nd", "rd"];
                const v = n % 100;
                return s[(v - 20) % 10] || s[v] || s[0];
              };

              const instanceLabel = dueDays.length > 1 ? `${subName} (${day}${getOrdinal(day)})` : subName;
              activeSubLines.push(`  • ${instanceLabel}: ${formatRemaining(remaining)}`);
            });
          }
        }
      });
    } else {
      // Category-level due date
      const dueDays = String(catData.dueDate || "").split(",").map(d => parseInt(d.trim())).filter(d => !isNaN(d) && d >= 1 && d <= 31);
      if (dueDays.length === 0) {
        const rawLimit = parseFloat(catData.limit) || 0;
        const periodLimit = rawLimit / 2;
        const spent = categorySpent[cat]?.total || 0;
        const remaining = periodLimit - spent;
        catPeriodLimit += periodLimit;
        catPeriodSpent += spent;
        activeSubLines.push(`  • ${cat}: ${formatRemaining(remaining)}`);
      } else {
        const periodDays = dueDays.filter(day => isPayPeriod1 ? day <= 14 : day >= 15);
        if (periodDays.length > 0) {
          const totalSpent = categorySpent[cat]?.total || 0;
          catPeriodSpent += totalSpent;

          periodDays.forEach(day => {
            const limit = parseFloat(catData.limit) || 0;
            catPeriodLimit += limit;
            const allocatedSpent = periodDays.length > 1 ? (totalSpent / periodDays.length) : totalSpent;
            const remaining = limit - allocatedSpent;
            activeSubLines.push(`  • Main Limit (${day}th): ${formatRemaining(remaining)}`);
          });
        }
      }
    }

    if (activeSubLines.length > 0) {
      const catRemaining = catPeriodLimit - catPeriodSpent;
      smsText += `• ${cat}: ${formatRemaining(catRemaining)}\n`;
      activeSubLines.forEach(line => { smsText += `${line}\n`; });
      smsText += `\n`;
      totalPeriodLimit += catPeriodLimit;
      totalPeriodSpent += catPeriodSpent;
      lineCount++;
    }
  });

  const totalPeriodRemaining = totalPeriodLimit - totalPeriodSpent;
  const totalStr = totalPeriodRemaining >= 0 
    ? `$${totalPeriodRemaining.toFixed(2)} left to spend` 
    : `$${Math.abs(totalPeriodRemaining).toFixed(2)} OVER budget`;
  smsText += `💰 Current Pay Period Balance: ${totalStr}`;

  if (lineCount === 0) {
    smsText = `📊 Good Steward Daily Balance\n(${periodLabel}):\nNo active bills or subcategories scheduled for this pay window.\nTotal Balance: $0.00`;
  }

function getCarrierEmail(phoneNumber, carrier) {
  const digits = String(phoneNumber || "").replace(/\D/g, "");
  const phone10 = digits.length === 11 && digits.startsWith("1") ? digits.substring(1) : digits;

  const map = {
    verizon: "@vtext.com",
    att: "@txt.att.net",
    tmobile: "@tmomail.net",
    sprint: "@messaging.sprintpcs.com",
    cricket: "@mms.cricketwireless.net",
    googlefi: "@msg.fi.google.com",
    mint: "@mailmymobile.net",
    boost: "@myboostmobile.com",
    uscellular: "@email.uscc.net"
  };

  const domain = map[String(carrier || "").toLowerCase()] || "@vtext.com";
  return `${phone10}${domain}`;
}

  const carrier = settings.carrier || "verizon";
  const carrierEmail = getCarrierEmail(settings.phoneNumber, carrier);

  const sendgridKey = process.env.SENDGRID_API_KEY;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  try {
    if (sendgridKey) {
      const sgMail = require("@sendgrid/mail");
      sgMail.setApiKey(sendgridKey);
      await sgMail.send({
        to: carrierEmail,
        from: process.env.SENDGRID_FROM_EMAIL || "notifications@goodstewardbudget.com",
        subject: "Good Steward Balance Summary",
        text: smsText
      });
      return {
        success: true,
        deliveredVia: `SendGrid Gateway (${carrier.toUpperCase()}: ${carrierEmail})`,
        phoneNumber: settings.phoneNumber,
        recipientGateway: carrierEmail,
        text: smsText
      };
    } else if (smtpUser && smtpPass) {
      const nodemailer = require("nodemailer");
      const transporter = nodemailer.createTransport({
        service: process.env.SMTP_SERVICE || "gmail",
        auth: { user: smtpUser, pass: smtpPass }
      });
      await transporter.sendMail({
        from: `"Good Steward" <${smtpUser}>`,
        to: carrierEmail,
        subject: "Good Steward Balance Summary",
        text: smsText
      });
      return {
        success: true,
        deliveredVia: `SMTP Gateway (${carrier.toUpperCase()}: ${carrierEmail})`,
        phoneNumber: settings.phoneNumber,
        recipientGateway: carrierEmail,
        text: smsText
      };
    } else {
      return {
        success: true,
        deliveredVia: `Payload Generated (Carrier Gateway: ${carrierEmail})`,
        phoneNumber: settings.phoneNumber,
        recipientGateway: carrierEmail,
        text: smsText,
        notice: "Outbound carrier emails require a free SendGrid API Key or Gmail App Password in Cloud Functions."
      };
    }
  } catch (emailErr) {
    console.error("Error sending Email-to-SMS gateway message:", emailErr);
    return { success: false, error: emailErr.message, text: smsText };
  }
}

/**
 * 4. HTTP Endpoint: POST /sendDailySmsSummary
 */
exports.senddailysmssummary = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      const authUser = await verifyAuth(req);
      const userId = authUser ? authUser.email : req.body.userId;
      const { householdId } = req.body;

      if (!userId || !householdId) {
        return res.status(400).json({ error: "Missing userId or householdId" });
      }

      const result = await generateAndSendSmsForUser(userId, householdId);
      return res.status(200).json(result);
    } catch (error) {
      console.error("Error generating daily SMS summary:", error);
      return res.status(500).json({ error: error.message });
    }
  });
});

const { onSchedule } = require("firebase-functions/v2/scheduler");

/**
 * 5. Scheduled Daily Cron Job (Runs every morning at 9:00 AM Pacific Time)
 */
exports.scheduleddailysmssummary = onSchedule("0 16 * * *", async (event) => {
  console.log("Starting scheduled daily SMS summary generation...");
  try {
    const settingsSnap = await db.collectionGroup("settings").get();
    console.log(`Found ${settingsSnap.size} user settings documents in collectionGroup.`);

    for (const doc of settingsSnap.docs) {
      if (doc.id === "notifications") {
        const data = doc.data();
        if (data && data.smsEnabled && data.phoneNumber) {
          const userDocRef = doc.ref.parent.parent;
          const userId = userDocRef ? userDocRef.id : null;
          if (userId) {
            const userLower = userId.toLowerCase();
            let householdId = data.householdId;
            if (!householdId) {
              const userSnap = await userDocRef.get();
              if (userSnap.exists && userSnap.data()?.householdId) {
                householdId = userSnap.data().householdId;
              } else if (userLower === "brian.k.kulp@gmail.com" || userLower === "familynflowers@protonmail.com") {
                householdId = "kulp-family";
              }
            }

            if (!householdId) {
              console.log(`Skipping SMS for userId: ${userId} - no householdId configured.`);
              continue;
            }

            console.log(`Sending daily SMS for userId: ${userId}, householdId: ${householdId}`);
            await generateAndSendSmsForUser(userId, householdId);
          }
        }
      }
    }
  } catch (err) {
    console.error("Error in scheduled SMS runner:", err);
  }
});

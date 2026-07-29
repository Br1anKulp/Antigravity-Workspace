import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

admin.initializeApp();

export const fetchIcal = onRequest({ cors: true }, async (req, res) => {
  const targetUrl = (req.query.url as string) || (req.body && req.body.url);
  if (!targetUrl) {
    res.status(400).send('Missing url parameter');
    return;
  }

  let cleanedUrl = targetUrl.trim();
  if (cleanedUrl.startsWith('webcal://')) {
    cleanedUrl = 'https://' + cleanedUrl.slice(9);
  }
  cleanedUrl = cleanedUrl.replace(/%40/gi, '@');

  try {
    const response = await fetch(cleanedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/calendar, text/plain, */*'
      }
    });

    if (!response.ok) {
      res.status(response.status).send(`Failed to fetch iCal feed: HTTP ${response.status} ${response.statusText}`);
      return;
    }

    const text = await response.text();
    if (!text.includes('BEGIN:VCALENDAR')) {
      res.status(422).send('Response did not contain valid VCALENDAR data');
      return;
    }

    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.status(200).send(text);
  } catch (err) {
    console.error('Error fetching iCal in Cloud Function:', err);
    res.status(500).send(`Error fetching iCal: ${err instanceof Error ? err.message : String(err)}`);
  }
});

export const onNotificationCreated = onDocumentCreated(
  'notifications/{notificationId}',
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log('No data associated with the event');
      return;
    }
    
    const notification = snapshot.data();
    const { recipientId, senderId, title, description } = notification;
    
    console.log(`Processing notification ${event.params.notificationId} for recipient ${recipientId} from sender ${senderId}`);

    const db = admin.firestore();
    const tokens: string[] = [];

    // Helper to get tokens for a user ID
    const getUserTokens = async (uid: string) => {
      try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData && Array.isArray(userData.fcmTokens)) {
            return userData.fcmTokens.filter(t => typeof t === 'string' && t.length > 0);
          }
        }
      } catch (err) {
        console.error(`Error fetching tokens for user ${uid}:`, err);
      }
      return [];
    };

    if (recipientId === 'both') {
      // Find all users who are not the sender using query filter
      try {
        const usersSnapshot = await db.collection('users').where(admin.firestore.FieldPath.documentId(), '!=', senderId || '').get();
        for (const doc of usersSnapshot.docs) {
          const userData = doc.data();
          if (userData && Array.isArray(userData.fcmTokens)) {
            tokens.push(...userData.fcmTokens.filter(t => typeof t === 'string' && t.length > 0));
          }
        }
      } catch (err) {
        console.error('Error fetching partner users for both recipient:', err);
      }
    } else if (recipientId && recipientId !== senderId) {
      // Specific recipient
      const userTokens = await getUserTokens(recipientId);
      tokens.push(...userTokens);
    }

    if (tokens.length === 0) {
      console.log('No active FCM tokens found to notify.');
      return;
    }

    // Deduplicate tokens
    const uniqueTokens = Array.from(new Set(tokens));

    // Construct the notification payload
    const payload = {
      notification: {
        title: title || 'Slate Notification',
        body: description || '',
      },
      data: {
        click_action: '/',
        notificationId: event.params.notificationId,
      }
    };

    console.log(`Sending multicast push notification to ${uniqueTokens.length} tokens`);
    
    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: uniqueTokens,
        notification: payload.notification,
        data: payload.data,
      });
      
      console.log(`Successfully sent ${response.successCount} messages; ${response.failureCount} failed.`);
      
      // Clean up tokens that failed due to registration issues (stale tokens)
      if (response.failureCount > 0) {
        const tokensToRemove: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success && resp.error) {
            const code = resp.error.code;
            if (
              code === 'messaging/invalid-registration-token' ||
              code === 'messaging/registration-token-not-registered'
            ) {
              tokensToRemove.push(uniqueTokens[idx]);
            }
          }
        });

        if (tokensToRemove.length > 0) {
          console.log(`Cleaning up ${tokensToRemove.length} stale FCM tokens using targeted queries`);
          for (const token of tokensToRemove) {
            const userSnap = await db.collection('users').where('fcmTokens', 'array-contains', token).get();
            for (const userDoc of userSnap.docs) {
              await userDoc.ref.update({
                fcmTokens: admin.firestore.FieldValue.arrayRemove(token)
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('Error sending multicast message:', err);
    }
  }
);

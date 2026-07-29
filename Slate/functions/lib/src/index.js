"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onNotificationCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
exports.onNotificationCreated = (0, firestore_1.onDocumentCreated)('notifications/{notificationId}', async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        console.log('No data associated with the event');
        return;
    }
    const notification = snapshot.data();
    const { recipientId, senderId, title, description } = notification;
    console.log(`Processing notification ${event.params.notificationId} for recipient ${recipientId} from sender ${senderId}`);
    const db = admin.firestore();
    const tokens = [];
    // Helper to get tokens for a user ID
    const getUserTokens = async (uid) => {
        try {
            const userDoc = await db.collection('users').doc(uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData && Array.isArray(userData.fcmTokens)) {
                    return userData.fcmTokens.filter(t => typeof t === 'string' && t.length > 0);
                }
            }
        }
        catch (err) {
            console.error(`Error fetching tokens for user ${uid}:`, err);
        }
        return [];
    };
    if (recipientId === 'both') {
        // Find all users who are not the sender
        try {
            const usersSnapshot = await db.collection('users').get();
            const userDocs = usersSnapshot.docs;
            for (const doc of userDocs) {
                if (doc.id !== senderId) {
                    const userData = doc.data();
                    if (userData && Array.isArray(userData.fcmTokens)) {
                        tokens.push(...userData.fcmTokens.filter(t => typeof t === 'string' && t.length > 0));
                    }
                }
            }
        }
        catch (err) {
            console.error('Error fetching all users for both recipient:', err);
        }
    }
    else if (recipientId && recipientId !== senderId) {
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
            const tokensToRemove = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success && resp.error) {
                    const code = resp.error.code;
                    if (code === 'messaging/invalid-registration-token' ||
                        code === 'messaging/registration-token-not-registered') {
                        tokensToRemove.push(uniqueTokens[idx]);
                    }
                }
            });
            if (tokensToRemove.length > 0) {
                console.log(`Cleaning up ${tokensToRemove.length} stale FCM tokens`);
                const usersSnapshot = await db.collection('users').get();
                for (const doc of usersSnapshot.docs) {
                    const userData = doc.data();
                    if (userData && Array.isArray(userData.fcmTokens)) {
                        const updatedTokens = userData.fcmTokens.filter((t) => !tokensToRemove.includes(t));
                        if (updatedTokens.length !== userData.fcmTokens.length) {
                            await doc.ref.update({ fcmTokens: updatedTokens });
                        }
                    }
                }
            }
        }
    }
    catch (err) {
        console.error('Error sending multicast message:', err);
    }
});
//# sourceMappingURL=index.js.map
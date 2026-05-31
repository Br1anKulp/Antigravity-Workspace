/**
 * Notifications utility for Flow Finance
 * Checks upcoming bill due dates and fires browser push notifications
 */

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

/**
 * Check all subcategory due dates against today.
 * Fire a notification for any unpaid bill due within `daysAhead` days.
 */
export function checkUpcomingBills(budgets, transactions, selectedMonth) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (!budgets || !transactions) return;

  const today = new Date();
  const [year, month] = selectedMonth.split('-').map(Number);

  Object.entries(budgets).forEach(([catName, catData]) => {
    if (!catData?.subcategories) return;

    Object.entries(catData.subcategories).forEach(([subName, subData]) => {
      if (!subData?.dueDate) return;

      // Parse comma-separated due days e.g. "1, 15"
      const dueDays = String(subData.dueDate)
        .split(',')
        .map(d => parseInt(d.trim()))
        .filter(d => !isNaN(d) && d >= 1 && d <= 31);

      dueDays.forEach(day => {
        const dueDate = new Date(year, month - 1, day);
        
        // Only trigger if today is the exact due date (year, month, and day match)
        const isDueToday = 
          today.getFullYear() === dueDate.getFullYear() &&
          today.getMonth() === dueDate.getMonth() &&
          today.getDate() === dueDate.getDate();

        if (isDueToday) {
          // Check if there's already a paid transaction for this subcategory this month
          const alreadyPaid = transactions.some(
            t =>
              (t.subcategory === subName || (t.splits && t.splits.some(s => s.subcategory === subName))) &&
              t.status === 'paid' &&
              t.date?.startsWith(selectedMonth)
          );

          if (!alreadyPaid) {
            const label = 'due TODAY';
            try {
              new Notification(`💳 Bill Reminder: ${subName}`, {
                body: `${subName} (${catName}) is ${label}. Don't forget to pay!`,
                icon: '/icon-192x192.png',
                tag: `bill-${subName}-${day}`, // prevents duplicates
                badge: '/icon-192x192.png'
              });
            } catch (err) {
              console.warn("Direct Notification constructor failed (expected on iOS), falling back to Service Worker registration:", err);
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(registration => {
                  registration.showNotification(`💳 Bill Reminder: ${subName}`, {
                    body: `${subName} (${catName}) is ${label}. Don't forget to pay!`,
                    icon: '/icon-192x192.png',
                    tag: `bill-${subName}-${day}`, // prevents duplicates
                    badge: '/icon-192x192.png'
                  });
                }).catch(swErr => {
                  console.error("Service worker notification failed:", swErr);
                });
              }
            }
          }
        }
      });
    });
  });
}

import { collection, query, where, getDocs, addDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { parseISO, isSameMonth, isPast, setDate } from 'date-fns'

export const processRecurringTransactions = async (userEmail, householdId) => {
  if (!userEmail && !householdId) return

  try {
    const q = householdId
      ? query(collection(db, 'transactions'), where('householdId', '==', householdId), where('isRecurring', '==', true))
      : query(collection(db, 'transactions'), where('user', '==', userEmail), where('isRecurring', '==', true))
    const snapshot = await getDocs(q)
    
    // Group recurring transactions by title
    const recurringGroups = {}
    snapshot.docs.forEach(doc => {
      const data = doc.data()
      if (!recurringGroups[data.title]) {
        recurringGroups[data.title] = []
      }
      recurringGroups[data.title].push(data)
    })

    const now = new Date()

    // For each unique recurring transaction, check if it needs to be added this month
    for (const [title, txs] of Object.entries(recurringGroups)) {
      // Sort by date descending
      txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      const latestTx = txs[0]
      const latestDate = parseISO(latestTx.date)
      
      // If the latest transaction is not from this month
      if (!isSameMonth(latestDate, now)) {
        const originalDay = parseISO(txs[txs.length - 1].date).getDate()
        const targetDateThisMonth = setDate(now, originalDay)
        
        // If the day has passed or is today, add the transaction
        if (isPast(targetDateThisMonth) || targetDateThisMonth.getDate() === now.getDate()) {
          await addDoc(collection(db, 'transactions'), {
            title: latestTx.title,
            amount: latestTx.amount,
            type: latestTx.type,
            category: latestTx.category,
            subcategory: latestTx.subcategory || null,
            user: userEmail,
            householdId: householdId || latestTx.householdId,
            date: targetDateThisMonth.toISOString(),
            status: latestTx.status || 'paid',
            paymentMethod: latestTx.paymentMethod || 'Navy Federal Checking',
            isRecurring: true
          })
          console.log(`Added recurring transaction for ${title}`)
        }
      }
    }
  } catch (err) {
    console.error("Error processing recurring transactions:", err)
  }
}

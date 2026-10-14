import { useState, useEffect } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { Link, RefreshCw, AlertCircle, Trash2 } from 'lucide-react'
import { collection, query, onSnapshot, where, doc, deleteDoc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'

export default function PlaidConnector({ user, householdId, onOpenBankFeed }) {
  const [linkToken, setLinkToken] = useState(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [linkedAccounts, setLinkedAccounts] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [error, setError] = useState(null)
  const [primaryUser, setPrimaryUser] = useState(user?.email?.toLowerCase() || '')

  // Load the Plaid API URLs dynamically from the active environment variables
  const createlinktokenUrl = import.meta.env.VITE_PLAID_CREATE_LINK_TOKEN_URL
  const exchangepublictokenUrl = import.meta.env.VITE_PLAID_EXCHANGE_PUBLIC_TOKEN_URL
  const synctransactionsUrl = import.meta.env.VITE_PLAID_SYNC_TRANSACTIONS_URL

  // Listen to the household's linked Plaid items from Firestore
  useEffect(() => {
    if (!user || !householdId) return
    const userEmailLower = user.email.toLowerCase()
    let unsubscribePlaid = () => {}

    const setupListener = async () => {
      let targetUser = userEmailLower
      try {
        const householdSnap = await getDoc(doc(db, 'households', householdId))
        if (householdSnap.exists()) {
          const hhData = householdSnap.data()
          if (hhData.primaryPlaidUser) {
            targetUser = hhData.primaryPlaidUser.toLowerCase()
          }
        } else if (userEmailLower === 'familynflowers@protonmail.com' || userEmailLower === 'brian.k.kulp@gmail.com') {
          targetUser = 'brian.k.kulp@gmail.com'
        }
      } catch (err) {
        console.warn('Error fetching household primaryPlaidUser:', err)
        if (userEmailLower === 'familynflowers@protonmail.com' || userEmailLower === 'brian.k.kulp@gmail.com') {
          targetUser = 'brian.k.kulp@gmail.com'
        }
      }

      setPrimaryUser(targetUser)

      const q = query(collection(db, 'users', targetUser, 'plaid_items'))
      unsubscribePlaid = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setLinkedAccounts(items)
      })
    }

    setupListener()
    return () => unsubscribePlaid()
  }, [user, householdId])

  // Listen for the count of pending bank transactions
  useEffect(() => {
    if (!user || !householdId) return
    const q = query(
      collection(db, 'bank_transactions'),
      where('householdId', '==', householdId)
    )
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingCount(snapshot.size)
    })
    return () => unsubscribe()
  }, [user, householdId])

  const getAuthHeaders = async () => {
    const headers = { 'Content-Type': 'application/json' }
    if (user && typeof user.getIdToken === 'function') {
      try {
        const token = await user.getIdToken()
        headers['Authorization'] = `Bearer ${token}`
      } catch (err) {
        console.warn('Failed to fetch Auth ID token:', err)
      }
    }
    return headers
  }

  // 1. Fetch Plaid Link Token from Cloud Function
  const fetchLinkToken = async () => {
    setLoading(true)
    setError(null)
    try {
      const userEmailLower = user.email.toLowerCase()
      const headers = await getAuthHeaders()
      const res = await fetch(createlinktokenUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId: userEmailLower })
      })
      if (!res.ok) throw new Error('Failed to create link token')
      const data = await res.json()
      setLinkToken(data.link_token)
    } catch (err) {
      console.error(err)
      setError('Failed to initiate bank login. Check credentials.')
    } finally {
      setLoading(false)
    }
  }

  // 2. Setup Plaid Link Hook
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken, metadata) => {
      setLoading(true)
      try {
        const userEmailLower = user.email.toLowerCase()
        const targetUserId = primaryUser || userEmailLower
        const headers = await getAuthHeaders()
        const res = await fetch(exchangepublictokenUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            publicToken,
            userId: targetUserId,
            institutionName: metadata.institution?.name || 'Linked Bank',
            householdId
          })
        })
        if (!res.ok) throw new Error('Token exchange failed')

        // If the household document doesn't have primaryPlaidUser set, set it now
        if (householdId) {
          try {
            await updateDoc(doc(db, 'households', householdId), {
              primaryPlaidUser: targetUserId
            })
            setPrimaryUser(targetUserId)
          } catch (e) {
            console.warn('Could not update primaryPlaidUser on household:', e)
          }
        }

        // Automatically trigger a sync after linking
        triggerSync()
      } catch (err) {
        console.error(err)
        setError('Failed to link account')
      } finally {
        setLoading(false)
        setLinkToken(null)
      }
    },
    onExit: () => {
      setLinkToken(null)
    }
  })

  // Trigger Plaid Link to open once the token is loaded
  useEffect(() => {
    if (linkToken && ready) {
      open()
    }
  }, [linkToken, ready, open])

  // 3. Trigger Transaction Sync
  const triggerSync = async () => {
    if (syncing) return
    setSyncing(true)
    setError(null)
    try {
      const userEmailLower = user.email.toLowerCase()
      const headers = await getAuthHeaders()
      const res = await fetch(synctransactionsUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: primaryUser || userEmailLower,
          householdId
        })
      })
      if (!res.ok) throw new Error('Sync failed')
      const data = await res.json()
      alert(`Sync Complete! Imported ${data.syncedCount} new transactions.`)
    } catch (err) {
      console.error(err)
      setError('Sync failed. Please try again.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="plaid-connector" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {linkedAccounts.map(account => (
        <div key={account.id} className="plaid-pill" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--primary-bg)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
          <span style={{ fontWeight: '500' }}>{account.institutionName}</span>
          <button 
            onClick={async (e) => {
              e.stopPropagation();
              if (window.confirm(`Unlink ${account.institutionName}? You will need to link it again to update credentials.`)) {
                try {
                  const userEmailLower = user.email.toLowerCase()
                  const targetUser = primaryUser || userEmailLower
                  await deleteDoc(doc(db, 'users', targetUser, 'plaid_items', account.id));
                } catch (err) {
                  console.error("Error unlinking account:", err);
                  alert("Failed to unlink account.");
                }
              }
            }}
            className="touch-btn"
            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', opacity: 0.7 }}
            title="Unlink account"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      {linkedAccounts.length > 0 && (
        <>
          <button 
            className="btn btn-ghost btn-icon" 
            style={{ 
              color: 'var(--success)', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.85rem'
            }}
            onClick={triggerSync}
            disabled={syncing}
            title={`Sync from: ${linkedAccounts.map(a => a.institutionName).join(', ')}`}
          >
            <RefreshCw size={16} className={syncing ? 'spin-animation' : ''} />
            <span style={{ fontWeight: '600' }}>Sync Bank</span>
          </button>
          
          <button
            className="btn btn-ghost"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              padding: '6px 12px',
              borderRadius: '8px',
              position: 'relative'
            }}
            onClick={onOpenBankFeed}
          >
            <span>Bank Feed</span>
            {pendingCount > 0 && (
              <span style={{
                background: 'var(--danger)',
                color: '#fff',
                fontSize: '0.7rem',
                fontWeight: '700',
                borderRadius: '10px',
                padding: '2px 6px',
                display: 'inline-block',
                lineHeight: '1'
              }}>
                {pendingCount}
              </span>
            )}
          </button>
        </>
      )}

      <button 
        className="btn btn-ghost" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px',
          fontSize: '0.85rem',
          padding: '6px 12px',
          borderRadius: '8px'
        }}
        onClick={fetchLinkToken}
        disabled={loading}
      >
        <Link size={16} />
        <span>{loading ? 'Connecting...' : (linkedAccounts.length > 0 ? '+ Link Another' : 'Link Bank')}</span>
      </button>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', color: 'var(--danger)', gap: '4px', fontSize: '0.8rem' }} title={error}>
          <AlertCircle size={14} />
          <span>Error</span>
        </div>
      )}
    </div>
  )
}

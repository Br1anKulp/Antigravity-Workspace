import React, { useState, useEffect } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { Link, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import { collection, query, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export default function PlaidConnector({ user, householdId }) {
  const [linkToken, setLinkToken] = useState(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [linkedAccounts, setLinkedAccounts] = useState([])
  const [error, setError] = useState(null)

  // Use the Firebase Functions regional endpoints for us-central1
  const functionsBaseUrl = 'https://us-central1-finance-app-a08c0.cloudfunctions.net'

  // Listen to the user's linked Plaid items from Firestore
  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'users', user.email, 'plaid_items'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setLinkedAccounts(items)
    })
    return () => unsubscribe()
  }, [user])

  // 1. Fetch Plaid Link Token from Cloud Function
  const fetchLinkToken = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${functionsBaseUrl}/createlinktoken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.email })
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
        const res = await fetch(`${functionsBaseUrl}/exchangepublictoken`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicToken,
            userId: user.email,
            institutionName: metadata.institution?.name || 'Linked Bank',
            householdId
          })
        })
        if (!res.ok) throw new Error('Token exchange failed')
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
  }, [linkToken, ready])

  // 3. Trigger Transaction Sync
  const triggerSync = async () => {
    if (syncing) return
    setSyncing(true)
    setError(null)
    try {
      const res = await fetch(`${functionsBaseUrl}/synctransactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.email,
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
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {linkedAccounts.length > 0 ? (
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
        </>
      ) : (
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
          <span>{loading ? 'Connecting...' : 'Link Bank'}</span>
        </button>
      )}

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', color: 'var(--danger)', gap: '4px', fontSize: '0.8rem' }} title={error}>
          <AlertCircle size={14} />
          <span>Error</span>
        </div>
      )}
    </div>
  )
}

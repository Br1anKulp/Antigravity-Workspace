import React, { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../firebase'
import { Landmark, ArrowRight, Trash2, Calendar, CreditCard, ChevronRight, X } from 'lucide-react'

export default function BankActivityFeed({ user, householdId, isOpen, onClose }) {
  const [bankTransactions, setBankTransactions] = useState([])

  // Listen to live bank transactions for this household
  useEffect(() => {
    if (!user || !householdId) return
    const q = query(
      collection(db, 'bank_transactions'),
      where('householdId', '==', householdId)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      // Sort newest first
      txs.sort((a, b) => new Date(b.date) - new Date(a.date))
      setBankTransactions(txs)
    })

    return () => unsubscribe()
  }, [user, householdId])

  // Handle pre-filling into manual TransactionForm
  const handleAddToBudget = (tx) => {
    const customEvent = new CustomEvent('prefill-transaction', {
      detail: {
        title: tx.title,
        amount: String(tx.amount),
        date: tx.date ? tx.date.split('T')[0] : new Date().toISOString().split('T')[0],
        paymentMethod: tx.paymentMethod || 'Checking Account',
        notes: tx.notes || '',
        bankTxId: tx.id // Include to delete after submit
      }
    })
    document.dispatchEvent(customEvent)
    
    // Close drawer on mobile for clean flow
    if (window.innerWidth < 768) {
      onClose()
    }
  }

  // Dismiss / delete from feed
  const handleDelete = async (id) => {
    if (!window.confirm("Dismiss this transaction? It won't be added to your budget.")) return
    try {
      await deleteDoc(doc(db, 'bank_transactions', id))
    } catch (err) {
      console.error("Error dismissing bank transaction:", err)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 998
        }}
        onClick={onClose}
      />

      {/* Side Drawer Panel */}
      <div 
        className="glass-panel"
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: 'min(400px, 90vw)',
          zIndex: 999,
          borderRadius: '24px 0 0 24px',
          borderLeft: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          boxSizing: 'border-box',
          animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Landmark size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Bank Feed</h3>
            <span style={{ 
              background: 'var(--primary-bg)', 
              color: 'var(--primary)', 
              fontSize: '0.75rem', 
              fontWeight: '700', 
              padding: '2px 8px', 
              borderRadius: '12px' 
            }}>
              {bankTransactions.length} pending
            </span>
          </div>
          <button 
            className="btn btn-ghost btn-icon" 
            onClick={onClose}
            style={{ minWidth: '32px', minHeight: '32px', padding: '6px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable list of transactions */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
          {bankTransactions.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px', fontSize: '0.9rem' }}>
              <CheckCircle2 size={32} style={{ color: 'var(--success)', margin: '0 auto 12px auto' }} />
              <p style={{ fontWeight: '500' }}>All Caught Up!</p>
              <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Sync your bank to download new transactions.</p>
            </div>
          ) : (
            bankTransactions.map(tx => (
              <div 
                key={tx.id} 
                className="glass-panel" 
                style={{ 
                  padding: '14px', 
                  borderRadius: '12px', 
                  background: 'rgba(255,255,255,0.01)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '70%' }}>
                    <span style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {tx.title}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CreditCard size={12} /> {tx.paymentMethod}
                    </span>
                  </div>
                  <span style={{ 
                    fontWeight: '700', 
                    fontSize: '0.95rem', 
                    color: tx.type === 'expense' ? 'var(--danger)' : 'var(--success)' 
                  }}>
                    {tx.type === 'expense' ? '-' : '+'}${parseFloat(tx.amount).toFixed(2)}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.02)', paddingTop: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={12} /> {new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                      className="btn btn-ghost btn-icon"
                      onClick={() => handleDelete(tx.id)}
                      style={{ minWidth: '28px', minHeight: '28px', padding: '4px', color: 'var(--text-secondary)' }}
                      title="Dismiss charge"
                    >
                      <Trash2 size={12} />
                    </button>
                    <button 
                      className="btn btn-primary"
                      onClick={() => handleAddToBudget(tx)}
                      style={{ 
                        padding: '4px 10px', 
                        fontSize: '0.75rem', 
                        borderRadius: '6px', 
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}
                    >
                      <span>Add to Budget</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}

// Inline checkmark fallback
function CheckCircle2({ size, style }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  )
}

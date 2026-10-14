import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../firebase'
import { Landmark, ArrowRight, Trash2, Calendar, CreditCard, X } from 'lucide-react'

export default function BankActivityFeed({ user, householdId, isOpen, onClose }) {
  const [bankTransactions, setBankTransactions] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [isDeleting, setIsDeleting] = useState(false)

  // Listen to live bank transactions for this household
  useEffect(() => {
    if (!user || !householdId) return
    const q = query(
      collection(db, 'bank_transactions'),
      where('householdId', '==', householdId)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }))
      // Sort newest first
      txs.sort((a, b) => new Date(b.date) - new Date(a.date))
      setBankTransactions(txs)
    })

    return () => unsubscribe()
  }, [user, householdId])

  // Clear selection when drawer closes (using render-phase state sync to comply with React 19 rules)
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen)
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen)
    if (!isOpen) {
      setSelectedIds(new Set())
    }
  }

  // ── Selection helpers ────────────────────────────────────────────────────
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = bankTransactions.length > 0 && selectedIds.size === bankTransactions.length
  const someSelected = selectedIds.size > 0 && !allSelected

  const toggleSelectAll = () => {
    if (allSelected || someSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(bankTransactions.map(tx => tx.id)))
    }
  }

  // ── Delete handlers ──────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm("Dismiss this transaction? It won't be added to your budget.")) return
    try {
      await deleteDoc(doc(db, 'bank_transactions', id))
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n })
    } catch (err) {
      console.error("Error dismissing bank transaction:", err)
    }
  }

  const handleBulkDelete = async () => {
    const count = selectedIds.size
    if (count === 0) return
    if (!window.confirm(`Dismiss ${count} transaction${count > 1 ? 's' : ''}? They won't be added to your budget.`)) return
    setIsDeleting(true)
    try {
      await Promise.all([...selectedIds].map(id => deleteDoc(doc(db, 'bank_transactions', id))))
      setSelectedIds(new Set())
    } catch (err) {
      console.error("Error dismissing bank transactions:", err)
    } finally {
      setIsDeleting(false)
    }
  }

  // Handle pre-filling into manual TransactionForm
  const handleAddToBudget = (tx) => {
    const customEvent = new CustomEvent('prefill-transaction', {
      detail: {
        title: tx.title,
        amount: String(tx.amount),
        date: tx.date ? tx.date.split('T')[0] : new Date().toISOString().split('T')[0],
        paymentMethod: tx.paymentMethod || 'Navy Federal Checking',
        notes: tx.notes || '',
        bankTxId: tx.id,
        plaidTransactionId: tx.plaidTransactionId || null
      }
    })
    document.dispatchEvent(customEvent)
    onClose()
  }

  if (!isOpen) return null

  const hasTx = bankTransactions.length > 0

  return (
    <>
      {/* Backdrop overlay */}
      <div
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
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
          right: 0, top: 0, bottom: 0,
          width: 'min(420px, 92vw)',
          zIndex: 999,
          borderRadius: '24px 0 0 24px',
          borderLeft: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 24px 0 24px',
          boxSizing: 'border-box',
          animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
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

        {/* ── Select-all toolbar (only when there are transactions) ──────── */}
        {hasTx && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '12px',
            padding: '8px 12px',
            background: 'var(--bg-base)',
            borderRadius: '8px',
            border: '1px solid var(--border)'
          }}>
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={toggleSelectAll}
              id="select-all-bank"
            />
            <label
              htmlFor="select-all-bank"
              style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none', flex: 1 }}
            >
              {allSelected ? 'Deselect all' : someSelected ? `${selectedIds.size} selected` : 'Select all'}
            </label>
            {selectedIds.size > 0 && (
              <button
                className="btn btn-ghost"
                onClick={() => setSelectedIds(new Set())}
                style={{ fontSize: '0.75rem', padding: '3px 8px', color: 'var(--text-secondary)' }}
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* ── Scrollable transaction list ───────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px', paddingBottom: '16px' }}>
          {!hasTx ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px', fontSize: '0.9rem' }}>
              <CheckCircle2 size={32} style={{ color: 'var(--success)', margin: '0 auto 12px auto' }} />
              <p style={{ fontWeight: '500' }}>All Caught Up!</p>
              <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Sync your bank to download new transactions.</p>
            </div>
          ) : (
            bankTransactions.map(tx => {
              const isSelected = selectedIds.has(tx.id)
              // Fix UTC date display: anchor to noon local time
              const displayDate = new Date(
                (tx.date || '').includes('T') ? tx.date : (tx.date || '') + 'T12:00:00'
              ).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

              return (
                <div
                  key={tx.id}
                  onClick={() => toggleSelect(tx.id)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: isSelected ? 'var(--primary-bg)' : 'rgba(255,255,255,0.01)',
                    border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    cursor: 'pointer',
                    transition: 'background 0.15s, border-color 0.15s',
                    userSelect: 'none'
                  }}
                >
                  {/* Checkbox */}
                  <div style={{ paddingTop: '2px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onChange={() => toggleSelect(tx.id)}
                      id={`tx-${tx.id}`}
                    />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {/* Top row: title + amount */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                        <span style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tx.title}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><CreditCard size={11} /> {tx.paymentMethod}</span>
                          <span style={{ fontSize: '0.65rem', background: 'var(--warning-bg)', color: 'var(--warning)', padding: '1px 6px', borderRadius: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Pending Review</span>
                        </span>
                      </div>
                      <span style={{
                        fontWeight: '700',
                        fontSize: '0.95rem',
                        flexShrink: 0,
                        color: tx.type === 'expense' ? 'var(--danger)' : 'var(--success)'
                      }}>
                        {tx.type === 'expense' ? '-' : '+'}${parseFloat(tx.amount || 0).toFixed(2)}
                      </span>
                    </div>

                    {/* Bottom row: date + action buttons */}
                    <div
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '6px' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={11} /> {displayDate}
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
                </div>
              )
            })
          )}
        </div>

        {/* ── Sticky bulk-delete bar (slides up when items are selected) ── */}
        <div style={{
          overflow: 'hidden',
          maxHeight: selectedIds.size > 0 ? '72px' : '0',
          transition: 'max-height 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          borderTop: selectedIds.size > 0 ? '1px solid var(--border)' : 'none',
        }}>
          <div style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            padding: '12px 0 20px 0'
          }}>
            <button
              className="btn btn-ghost"
              onClick={() => setSelectedIds(new Set())}
              style={{ flex: 1, fontSize: '0.85rem' }}
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={handleBulkDelete}
              disabled={isDeleting || selectedIds.size === 0}
              style={{
                flex: 2,
                fontSize: '0.85rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: 'var(--danger)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 16px',
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                opacity: isDeleting ? 0.7 : 1
              }}
            >
              <Trash2 size={14} />
              {isDeleting ? 'Deleting…' : `Delete ${selectedIds.size} Selected`}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Checkbox component ────────────────────────────────────────────────────────
function Checkbox({ checked, indeterminate, onChange, id }) {
  return (
    <div
      id={id}
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      tabIndex={0}
      onClick={onChange}
      onKeyDown={e => (e.key === ' ' || e.key === 'Enter') && onChange()}
      style={{
        width: '18px',
        height: '18px',
        borderRadius: '5px',
        border: `2px solid ${checked || indeterminate ? 'var(--primary)' : 'var(--border)'}`,
        background: checked || indeterminate ? 'var(--primary)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 0.15s, border-color 0.15s',
        outline: 'none'
      }}
      onFocus={e => { e.currentTarget.style.boxShadow = '0 0 0 3px var(--primary-bg)' }}
      onBlur={e => { e.currentTarget.style.boxShadow = 'none' }}
    >
      {indeterminate && !checked && (
        <svg width="10" height="2" viewBox="0 0 10 2" fill="none">
          <rect width="10" height="2" rx="1" fill="white" />
        </svg>
      )}
      {checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}

// ── CheckCircle2 fallback ─────────────────────────────────────────────────────
function CheckCircle2({ size, style }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  )
}

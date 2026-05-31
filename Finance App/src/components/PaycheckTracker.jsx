import React, { useState, useMemo } from 'react'
import { Banknote, Pencil, Check, X, ChevronDown } from 'lucide-react'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

const getOrdinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}

const getBarColor = (pct) => {
  if (pct === 0) return 'var(--primary)'
  if (pct < 80) return 'var(--success)'
  if (pct <= 100) return 'var(--warning)'
  return 'var(--danger)'
}

export default function PaycheckTracker({ budgets, user, householdId, selectedMonth, customCategories }) {
  const [editing, setEditing] = useState(null) // 'paycheck1' | 'paycheck2'
  const [editVal, setEditVal] = useState('')
  const [saving, setSaving] = useState(false)
  // Collapsed state persists in localStorage; only affects mobile layout
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('paycheck-collapsed') === 'true')

  const toggleCollapsed = () => {
    const next = !isCollapsed
    setIsCollapsed(next)
    localStorage.setItem('paycheck-collapsed', String(next))
  }

  const paycheckConfig = budgets?._paychecks || {}
  const p1Amount = parseFloat(paycheckConfig?.paycheck1?.amount) || 0
  const p2Amount = parseFloat(paycheckConfig?.paycheck2?.amount) || 0

  // Compute which bills (subcategories with due dates) belong to each paycheck window
  // Days 1–14 → Paycheck 1 | Days 15–31 → Paycheck 2
  const { p1Bills, p2Bills } = useMemo(() => {
    const p1 = []
    const p2 = []

    customCategories.forEach(cat => {
      const catData = budgets?.[cat]
      if (!catData) return

      const subcategories = catData.subcategories || {}
      const subKeys = Object.keys(subcategories).filter(k => k !== '_order')
      const hasSubs = subKeys.length > 0

      if (hasSubs) {
        subKeys.forEach(subName => {
          const subVal = subcategories[subName]
          const subData = typeof subVal === 'object' ? subVal : { limit: subVal || 0, dueDate: '' }
          const dueDays = String(subData.dueDate || '')
            .split(',')
            .map(d => parseInt(d.trim()))
            .filter(d => !isNaN(d) && d >= 1 && d <= 31)

          if (dueDays.length === 0) return // hidden — no due date

          const limit = parseFloat(subData.limit) || 0
          dueDays.forEach(day => {
            const bill = {
              cat,
              name: dueDays.length > 1 ? `${subName} (${day}${getOrdinal(day)})` : subName,
              limit,
              day,
            }
            day <= 14 ? p1.push(bill) : p2.push(bill)
          })
        })
      } else {
        // Category-level due date (no subcategories)
        const dueDays = String(catData.dueDate || '')
          .split(',')
          .map(d => parseInt(d.trim()))
          .filter(d => !isNaN(d) && d >= 1 && d <= 31)

        if (dueDays.length === 0) return

        const limit = parseFloat(catData.limit) || 0
        dueDays.forEach(day => {
          const bill = {
            cat,
            name: dueDays.length > 1 ? `${cat} (${day}${getOrdinal(day)})` : cat,
            limit,
            day,
          }
          day <= 14 ? p1.push(bill) : p2.push(bill)
        })
      }
    })

    p1.sort((a, b) => a.day - b.day)
    p2.sort((a, b) => a.day - b.day)
    return { p1Bills: p1, p2Bills: p2 }
  }, [budgets, customCategories])

  const p1Total = p1Bills.reduce((s, b) => s + b.limit, 0)
  const p2Total = p2Bills.reduce((s, b) => s + b.limit, 0)

  const saveAmount = async (paycheckKey, val) => {
    if (!user) return
    setSaving(true)
    try {
      const amount = parseFloat(val) || 0
      await setDoc(
        doc(db, 'budgets', `${householdId}-${selectedMonth}`),
        { _paychecks: { [paycheckKey]: { amount } } },
        { merge: true }
      )
      setEditing(null)
    } catch (err) {
      console.error('Failed to save paycheck amount:', err)
    } finally {
      setSaving(false)
    }
  }

  const renderCard = (paycheckKey, label, dateRange, amount, bills, total) => {
    const remaining = amount - total
    const pct = amount > 0 ? Math.min(100, (total / amount) * 100) : (total > 0 ? 101 : 0)
    const barColor = getBarColor(pct)
    const isEditing = editing === paycheckKey
    const hasAmount = amount > 0

    return (
      <div
        className="glass-panel"
        style={{ padding: '16px 18px', flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}
      >
        {/* ── Header Row ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          {/* Label + icon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <div style={{
              background: 'var(--primary-bg)',
              color: 'var(--primary)',
              padding: '7px',
              borderRadius: '8px',
              display: 'flex',
              flexShrink: 0,
            }}>
              <Banknote size={15} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: '700', fontSize: '0.88rem', fontFamily: 'var(--font-heading)', whiteSpace: 'nowrap' }}>
                {label}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {dateRange}
              </div>
            </div>
          </div>

          {/* Amount display / edit */}
          {isEditing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600' }}>$</span>
              <input
                type="number"
                autoFocus
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveAmount(paycheckKey, editVal)
                  if (e.key === 'Escape') setEditing(null)
                }}
                className="paycheck-amount-input"
                style={{
                  width: '88px',
                  padding: '4px 6px',
                  borderRadius: '6px',
                  border: '1.5px solid var(--primary)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  fontWeight: '700',
                  fontFamily: 'var(--font-heading)',
                  outline: 'none',
                }}
                inputMode="decimal"
              />
              {/* paycheck-touch-btn only enlarges on mobile via CSS — no desktop change */}
              <button
                onClick={() => saveAmount(paycheckKey, editVal)}
                disabled={saving}
                title="Save"
                className="paycheck-touch-btn"
                style={{ background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
              >
                <Check size={15} />
              </button>
              <button
                onClick={() => setEditing(null)}
                title="Cancel"
                className="paycheck-touch-btn"
                style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, cursor: 'pointer' }}
              onClick={() => { setEditing(paycheckKey); setEditVal(hasAmount ? String(amount) : '') }}
              title="Click to set paycheck amount"
            >
              <span style={{
                fontWeight: '700',
                fontSize: '1.1rem',
                fontFamily: 'var(--font-heading)',
                color: hasAmount ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontStyle: hasAmount ? 'normal' : 'italic',
              }}>
                {hasAmount ? `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Set amount'}
              </span>
              <Pencil size={11} style={{ color: 'var(--text-secondary)', opacity: 0.6 }} />
            </div>
          )}
        </div>

        {/* ── Progress Bar ── */}
        <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, pct)}%`,
            background: barColor,
            borderRadius: '3px',
            transition: 'width 0.4s ease, background-color 0.3s ease',
          }} />
        </div>

        {/* ── Stats Row ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>Budgeted</span>
            <span style={{ fontWeight: '700', color: barColor, fontFamily: 'var(--font-heading)', fontSize: '0.9rem' }}>
              ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', textAlign: 'right' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>Remaining</span>
            <span style={{ fontWeight: '700', fontFamily: 'var(--font-heading)', fontSize: '0.9rem', color: remaining >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* ── Bills List ──
            .paycheck-bills-list: max-height 130px + scroll on desktop,
            no max-height on mobile (via CSS media query) */}
        {bills.length > 0 ? (
          <div className="paycheck-bills-list">
            {bills.map((bill, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 0',
                  borderBottom: i < bills.length - 1 ? '1px solid hsla(var(--hue), 20%, 50%, 0.07)' : 'none',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '26px',
                    height: '18px',
                    borderRadius: '4px',
                    background: 'var(--primary-bg)',
                    color: 'var(--primary)',
                    fontSize: '0.65rem',
                    fontWeight: '700',
                    flexShrink: 0,
                  }}>
                    {bill.day}{getOrdinal(bill.day)}
                  </span>
                  <span style={{
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '65%',
                  }}>
                    {bill.name}
                  </span>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)', flexShrink: 0, fontFamily: 'var(--font-heading)' }}>
                  ${bill.limit.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            borderTop: '1px solid var(--border)',
            paddingTop: '8px',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            fontStyle: 'italic',
            textAlign: 'center',
          }}>
            No bills assigned to this paycheck
          </div>
        )}
      </div>
    )
  }

  const totalIncome = p1Amount + p2Amount
  const totalBudgeted = p1Total + p2Total
  const totalRemaining = totalIncome - totalBudgeted

  return (
    // paycheck-section: on desktop just a flex passthrough; on mobile adds the toggle
    <div className="paycheck-section">

      {/* ── Mobile-only collapse toggle header ── */}
      <div
        className="paycheck-collapse-toggle glass-panel"
        onClick={toggleCollapsed}
        role="button"
        aria-expanded={!isCollapsed}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ background: 'var(--primary-bg)', color: 'var(--primary)', padding: '6px', borderRadius: '7px', display: 'flex', flexShrink: 0 }}>
            <Banknote size={14} />
          </div>
          <span style={{ fontWeight: '700', fontSize: '0.88rem', fontFamily: 'var(--font-heading)' }}>Paychecks</span>
          {totalIncome > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              ${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} total
              {' · '}
              <span style={{ color: totalRemaining >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: '600' }}>
                ${Math.abs(totalRemaining).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} {totalRemaining >= 0 ? 'left' : 'over'}
              </span>
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          style={{
            color: 'var(--text-secondary)',
            transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
            transition: 'transform 0.25s ease',
            flexShrink: 0,
          }}
        />
      </div>

      {/* ── Cards: always visible on desktop; hidden when collapsed on mobile ── */}
      <div className={`paycheck-cards-row${isCollapsed ? ' paycheck-cards-hidden' : ''}`}>
        {renderCard('paycheck1', '1st Paycheck', 'Due 1st – 14th', p1Amount, p1Bills, p1Total)}
        {renderCard('paycheck2', '2nd Paycheck', 'Due 15th – 31st', p2Amount, p2Bills, p2Total)}
      </div>
    </div>
  )
}

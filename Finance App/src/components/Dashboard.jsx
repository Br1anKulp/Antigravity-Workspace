import React from 'react'
import { TrendingUp, TrendingDown, DollarSign, Clock, CreditCard, ShieldCheck, CheckCircle2 } from 'lucide-react'
import AnalyticsChart from './AnalyticsChart'

export default function Dashboard({ transactions, budgets = {}, onUpdateTransaction }) {
  const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0)
  const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0)
  const unpaid = transactions.filter(t => t.type === 'expense' && t.status === 'unpaid').reduce((sum, t) => sum + parseFloat(t.amount), 0)
  const balance = income - expenses

  // Unpaid bills details grouping by card/account
  const unpaidTransactions = transactions.filter(t => t.type === 'expense' && t.status === 'unpaid')
  
  const unpaidByCard = unpaidTransactions.reduce((groups, t) => {
    const card = t.paymentMethod || 'Checking Account';
    if (!groups[card]) groups[card] = [];
    groups[card].push(t);
    return groups;
  }, {});

  // Calculate Left to Budget (Current Balance - Remaining Reserved Budget Limits)
  const unspentReserved = Object.keys(budgets || {}).reduce((total, cat) => {
    if (cat.startsWith('_')) return total;
    const catData = budgets[cat];
    
    // Sum of subcategory limits with due date multiplicity scaling
    const limit = Object.entries(catData?.subcategories || {})
      .filter(([k]) => k !== '_order')
      .reduce((sum, [, sub]) => {
        const subData = typeof sub === 'object' ? sub : { limit: sub || 0, dueDate: '' }
        const dueDays = String(subData.dueDate || '').split(',').map(d => d.trim()).filter(d => !isNaN(d) && d !== '')
        const multiplier = dueDays.length > 0 ? dueDays.length : 1
        return sum + ((parseFloat(subData.limit) || 0) * multiplier)
      }, 0);
    
    // Category limit fallback to main limit if no subcategories, also scaled by due date multiplicity
    const categoryLimit = limit > 0 || Object.keys(catData?.subcategories || {}).length > 0
      ? limit
      : (() => {
          const mainDueDays = String(catData?.dueDate || '').split(',').map(d => d.trim()).filter(d => !isNaN(d) && d !== '')
          const mainMultiplier = mainDueDays.length > 0 ? mainDueDays.length : 1
          return (parseFloat(catData?.limit) || 0) * mainMultiplier
        })();
    
    // Category spent
    const spent = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => {
        if (t.splits?.length > 0) {
          const splitSum = t.splits
            .filter(split => (split.category || t.category) === cat)
            .reduce((sSum, split) => sSum + (parseFloat(split.amount) || 0), 0);
          return sum + splitSum;
        } else if (t.category === cat) {
          return sum + (parseFloat(t.amount) || 0);
        }
        return sum;
      }, 0);
      
    const remaining = Math.max(0, categoryLimit - spent);
    return total + remaining;
  }, 0);
  
  const safeToSpend = balance - unspentReserved;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 4 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '4px', fontSize: '0.95rem' }}>Total Remaining</p>
              <h2 style={{ fontSize: '2.2rem', margin: 0, fontWeight: '700' }}>
                ${balance.toFixed(2)}
              </h2>
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: safeToSpend >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: '500', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)', width: 'fit-content' }}>
                <ShieldCheck size={14} />
                <span>Left to Budget: <strong style={{ fontSize: '0.88rem' }}>${safeToSpend.toFixed(2)}</strong></span>
              </div>
            </div>
            <div style={{ background: 'var(--primary-bg)', color: 'var(--primary)', padding: '12px', borderRadius: '50%' }}>
              <DollarSign size={24} />
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '0.95rem' }}>Total Income</p>
              <h2 style={{ fontSize: '2rem', margin: 0, color: 'var(--success)' }}>
                +${income.toFixed(2)}
              </h2>
            </div>
            <div style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: '12px', borderRadius: '50%' }}>
              <TrendingUp size={24} />
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '0.95rem' }}>Total Spent</p>
              <h2 style={{ fontSize: '2rem', margin: 0, color: 'var(--danger)' }}>
                -${expenses.toFixed(2)}
              </h2>
            </div>
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '12px', borderRadius: '50%' }}>
              <TrendingDown size={24} />
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '0.95rem' }}>Unpaid Bills</p>
              <h2 style={{ fontSize: '2rem', margin: 0, color: 'var(--warning)' }}>
                ${unpaid.toFixed(2)}
              </h2>
            </div>
            <div style={{ background: 'rgba(251, 191, 36, 0.2)', color: 'var(--warning)', padding: '12px', borderRadius: '50%' }}>
              <Clock size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Unpaid Bills Detail Widget */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
          <Clock size={20} style={{ color: 'var(--warning)' }} /> Unpaid Bills by Card
        </h3>
        {unpaidTransactions.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            All bills are paid! 🎉
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {Object.entries(unpaidByCard).map(([card, bills]) => {
              const cardTotal = bills.reduce((sum, b) => sum + parseFloat(b.amount), 0);
              return (
                <div key={card} style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                    <span style={{ fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CreditCard size={16} style={{ color: 'var(--primary)' }} /> {card}
                    </span>
                    <span style={{ fontWeight: '700', color: 'var(--warning)' }}>${cardTotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {bills.map(b => (
                      <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', gap: '12px', padding: '2px 0' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: '500', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {new Date(b.date).toLocaleDateString()} • {b.category} {b.subcategory && `> ${b.subcategory}`}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>${parseFloat(b.amount).toFixed(2)}</span>
                          <button
                            type="button"
                            onClick={() => onUpdateTransaction && onUpdateTransaction(b.id, { ...b, status: 'paid' })}
                            style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: 'var(--success)', opacity: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s, opacity 0.2s' }}
                            title="Mark as Paid"
                            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.opacity = '1' }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.opacity = '0.8' }}
                          >
                            <CheckCircle2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginBottom: '24px' }}>
        <AnalyticsChart transactions={transactions} />
      </div>
    </div>
  )
}

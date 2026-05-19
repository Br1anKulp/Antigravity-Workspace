import React from 'react'
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react'

export default function Dashboard({ transactions }) {
  const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0)
  const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0)
  const balance = income - expenses

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginTop: '24px' }}>
      
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '0.95rem' }}>Total Balance</p>
            <h2 style={{ fontSize: '2.5rem', margin: 0, fontWeight: '700' }}>
              ${balance.toFixed(2)}
            </h2>
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
            <p style={{ color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '0.95rem' }}>Total Expenses</p>
            <h2 style={{ fontSize: '2rem', margin: 0, color: 'var(--danger)' }}>
              -${expenses.toFixed(2)}
            </h2>
          </div>
          <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '12px', borderRadius: '50%' }}>
            <TrendingDown size={24} />
          </div>
        </div>
      </div>

    </div>
  )
}

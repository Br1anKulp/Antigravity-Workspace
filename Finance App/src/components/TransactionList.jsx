import React from 'react'
import { ArrowUpRight, ArrowDownRight, Tag, Calendar, MoreHorizontal } from 'lucide-react'

export default function TransactionList({ transactions }) {
  if (transactions.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', marginTop: '24px' }}>
        <p style={{ color: 'var(--text-secondary)' }}>No transactions yet. Add one to get started!</p>
      </div>
    )
  }

  return (
    <div className="glass-panel" style={{ marginTop: '24px', overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Recent Transactions</h3>
        <button className="btn btn-ghost btn-icon"><MoreHorizontal size={20} /></button>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {transactions.map(t => (
          <div key={t.id} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            padding: '16px 24px',
            borderBottom: '1px solid var(--border)',
            transition: 'background-color 0.2s',
            cursor: 'pointer'
          }}
          onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--bg-base)'}
          onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ 
                background: t.type === 'income' ? 'var(--success-bg)' : 'var(--danger-bg)',
                color: t.type === 'income' ? 'var(--success)' : 'var(--danger)',
                padding: '12px',
                borderRadius: '50%'
              }}>
                {t.type === 'income' ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
              </div>
              
              <div>
                <h4 style={{ margin: '0 0 4px', fontWeight: '500' }}>{t.title}</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Tag size={14} /> {t.category}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={14} /> {new Date(t.date).toLocaleDateString()}
                  </span>
                  {t.user && <span>• By {t.user}</span>}
                </div>
              </div>
            </div>
            
            <div style={{ 
              fontWeight: '600', 
              fontSize: '1.1rem',
              color: t.type === 'income' ? 'var(--success)' : 'var(--text-primary)'
            }}>
              {t.type === 'income' ? '+' : '-'}${parseFloat(t.amount).toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

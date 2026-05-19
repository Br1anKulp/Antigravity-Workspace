import React, { useState } from 'react'

const CATEGORIES = [
  'Home Expenses',
  'Transportation',
  'Daily Living',
  'Entertainment',
  'Health',
  'Personal',
  'Savings',
  'Donations',
  'Misc'
]

export default function TransactionForm({ onAdd }) {
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: CATEGORIES[0],
    type: 'expense'
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.title || !formData.amount) return

    onAdd({
      ...formData,
      amount: parseFloat(formData.amount),
      date: new Date().toISOString(),
      id: crypto.randomUUID()
    })

    setFormData({ ...formData, title: '', amount: '' })
    setIsOpen(false)
  }

  if (!isOpen) {
    return (
      <div style={{ textAlign: 'center', marginTop: '32px' }}>
        <button className="btn btn-primary" onClick={() => setIsOpen(true)}>
          + Add Transaction
        </button>
      </div>
    )
  }

  return (
    <div className="glass-panel" style={{ padding: '24px', marginTop: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0 }}>New Transaction</h3>
        <button className="btn btn-ghost" onClick={() => setIsOpen(false)}>Cancel</button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            type="button"
            style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--danger)', background: formData.type === 'expense' ? 'var(--danger)' : 'transparent', color: formData.type === 'expense' ? '#fff' : 'var(--danger)', cursor: 'pointer', fontWeight: '500' }}
            onClick={() => setFormData({ ...formData, type: 'expense' })}
          >
            Expense
          </button>
          <button 
            type="button"
            style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--success)', background: formData.type === 'income' ? 'var(--success)' : 'transparent', color: formData.type === 'income' ? '#fff' : 'var(--success)', cursor: 'pointer', fontWeight: '500' }}
            onClick={() => setFormData({ ...formData, type: 'income' })}
          >
            Income
          </button>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Title</label>
          <input 
            type="text" 
            required
            value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.target.value })}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '1rem' }}
            placeholder="e.g. Groceries"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Amount</label>
            <input 
              type="number" 
              required
              min="0.01"
              step="0.01"
              value={formData.amount}
              onChange={e => setFormData({ ...formData, amount: e.target.value })}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '1rem' }}
              placeholder="0.00"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Category</label>
            <select 
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '1rem' }}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <button type="submit" className="btn btn-primary" style={{ marginTop: '8px', width: '100%' }}>
          Save Transaction
        </button>
      </form>
    </div>
  )
}

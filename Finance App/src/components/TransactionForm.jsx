import React, { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'

export default function TransactionForm({ onAdd, onUpdate, categoriesConfig, customCategories }) {
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: '', // Start empty to show placeholder
    subcategory: '', // Start empty to show placeholder
    type: 'expense',
    isRecurring: false,
    dates: [new Date().toISOString().split('T')[0]],
    status: 'paid',
    paymentMethod: 'Checking Account',
    notes: ''
  })

  // Split transaction states
  const [isSplit, setIsSplit] = useState(false)
  const [splits, setSplits] = useState([{ subcategory: '', amount: '' }])

  // Clear subcategory when category changes so user must select one
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      subcategory: ''
    }))
  }, [formData.category])

  // Listen for edit requests from the transaction list
  useEffect(() => {
    const handleEdit = (e) => {
      const tx = e.detail;
      setFormData({
        title: tx.title,
        amount: tx.amount,
        category: tx.category,
        subcategory: tx.subcategory || '',
        type: tx.type,
        isRecurring: tx.isRecurring || false,
        status: tx.status || 'paid',
        paymentMethod: tx.paymentMethod || 'Checking Account',
        notes: tx.notes || '',
        dates: [tx.date.split('T')[0]] // Assuming YYYY-MM-DD
      });
      
      if (tx.splits && tx.splits.length > 0) {
        setIsSplit(true);
        setSplits(tx.splits.map(s => ({ subcategory: s.subcategory, amount: String(s.amount) })));
      } else {
        setIsSplit(false);
        setSplits([{ subcategory: '', amount: '' }]);
      }
      
      setEditingId(tx.id);
      setIsOpen(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    document.addEventListener('edit-transaction', handleEdit);
    return () => document.removeEventListener('edit-transaction', handleEdit);
  }, []);

  const resetForm = () => {
    setFormData({ 
      title: '', 
      amount: '', 
      category: '', // Start empty to show placeholder
      subcategory: '', // Start empty to show placeholder
      isRecurring: false,
      dates: [new Date().toISOString().split('T')[0]],
      type: 'expense',
      status: 'paid',
      paymentMethod: 'Checking Account',
      notes: ''
    });
    setIsSplit(false);
    setSplits([{ subcategory: '', amount: '' }]);
    setEditingId(null);
    setIsOpen(false);
  }

  const splitsSum = isSplit ? splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0) : 0;
  const isSumMatching = !isSplit || Math.abs(splitsSum - (parseFloat(formData.amount) || 0)) < 0.01;

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.title || !formData.amount) return
    if (isSplit && !isSumMatching) return;

    const txDataTemplate = {
      ...formData,
      amount: parseFloat(formData.amount),
      category: formData.type === 'income' ? 'Income' : formData.category,
      subcategory: formData.type === 'income' ? '' : (isSplit ? 'Split' : formData.subcategory),
      splits: isSplit ? splits.map(s => ({ subcategory: s.subcategory, amount: parseFloat(s.amount) || 0 })) : null,
      notes: formData.notes.trim()
    };
    delete txDataTemplate.dates; // Remove the array from the payload

    if (editingId && onUpdate) {
      // If editing, we only update the single transaction with the first date
      onUpdate(editingId, { ...txDataTemplate, date: new Date(formData.dates[0] + 'T12:00:00').toISOString() });
    } else {
      // Add a separate transaction for every date selected
      formData.dates.forEach(d => {
        onAdd({ ...txDataTemplate, date: new Date(d + 'T12:00:00').toISOString(), id: crypto.randomUUID() });
      });
    }

    resetForm();
  }

  const handleCancel = () => {
    resetForm();
  }

  const handleAddSplit = () => {
    setSplits(prev => [...prev, { subcategory: '', amount: '' }]);
  }

  const handleRemoveSplit = (idx) => {
    setSplits(prev => prev.filter((_, i) => i !== idx));
  }

  const handleSplitChange = (idx, field, val) => {
    setSplits(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
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
        <h3 style={{ margin: 0 }}>{editingId ? 'Edit Transaction' : 'New Transaction'}</h3>
        <button className="btn btn-ghost" onClick={handleCancel}>Cancel</button>
      </div>

      <form onSubmit={handleSubmit} autoComplete="off" style={{ display: 'grid', gap: '16px' }}>
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
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              {editingId ? 'Date' : 'Dates'}
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {formData.dates.map((d, index) => (
                <div key={index} style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="date" 
                    required
                    value={d}
                    onChange={e => {
                      const newDates = [...formData.dates];
                      newDates[index] = e.target.value;
                      setFormData({ ...formData, dates: newDates });
                    }}
                    style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '1rem' }}
                  />
                  {!editingId && formData.dates.length > 1 && (
                    <button type="button" className="btn btn-ghost btn-icon" onClick={() => {
                      const newDates = formData.dates.filter((_, i) => i !== index);
                      setFormData({ ...formData, dates: newDates });
                    }} style={{ color: 'var(--danger)', padding: '0 12px' }}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              {!editingId && (
                <button 
                  type="button" 
                  className="btn btn-ghost" 
                  onClick={() => setFormData({ ...formData, dates: [...formData.dates, new Date().toISOString().split('T')[0]] })}
                  style={{ fontSize: '0.85rem', padding: '6px', width: 'fit-content', color: 'var(--primary)', marginTop: '-4px' }}
                >
                  <Plus size={14} /> Add another date
                </button>
              )}
            </div>
          </div>
          
          {formData.type === 'expense' && (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Main Category</label>
                <select 
                  value={formData.category}
                  required
                  autoComplete="off"
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '1rem' }}
                >
                  <option value="" disabled>Select Category</option>
                  {customCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              
              {!isSplit ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Subcategory</label>
                    <button 
                      type="button" 
                      onClick={() => {
                        setIsSplit(true);
                        if (splits.length === 1 && !splits[0].subcategory) {
                          setSplits([{ subcategory: formData.subcategory, amount: formData.amount }]);
                        }
                      }}
                      style={{ fontSize: '0.8rem', background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0 }}
                    >
                      Split transaction?
                    </button>
                  </div>
                  <select 
                    value={formData.subcategory}
                    required
                    autoComplete="off"
                    onChange={e => {
                      if (e.target.value === '__custom__') {
                        const custom = prompt('Enter custom subcategory:');
                        if (custom) {
                          setFormData({ ...formData, subcategory: custom });
                        }
                      } else {
                        setFormData({ ...formData, subcategory: e.target.value });
                      }
                    }}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '1rem', appearance: 'auto' }}
                  >
                    <option value="" disabled>Select Subcategory</option>
                    {(categoriesConfig[formData.category] || []).map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                    {formData.subcategory && !(categoriesConfig[formData.category] || []).includes(formData.subcategory) && formData.subcategory !== '__custom__' && (
                      <option value={formData.subcategory}>{formData.subcategory}</option>
                    )}
                    <option value="__custom__">+ Add Custom...</option>
                  </select>
                </div>
              ) : (
                <div style={{ gridColumn: 'span 2', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <label style={{ fontWeight: '600', fontSize: '0.95rem', color: 'var(--text-primary)' }}>Transaction Splits</label>
                    <button 
                      type="button" 
                      onClick={() => setIsSplit(false)}
                      style={{ fontSize: '0.8rem', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0 }}
                    >
                      Cancel Split
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
                    {splits.map((s, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{ flex: 2, position: 'relative' }}>
                          <select 
                            value={s.subcategory}
                            required
                            autoComplete="off"
                            onChange={e => {
                              if (e.target.value === '__custom__') {
                                const custom = prompt('Enter custom subcategory:');
                                if (custom) {
                                  handleSplitChange(idx, 'subcategory', custom);
                                }
                              } else {
                                handleSplitChange(idx, 'subcategory', e.target.value);
                              }
                            }}
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '0.95rem', appearance: 'auto' }}
                          >
                            <option value="" disabled>Select Subcategory</option>
                            {(categoriesConfig[formData.category] || []).map(sub => (
                              <option key={sub} value={sub}>{sub}</option>
                            ))}
                            {s.subcategory && !(categoriesConfig[formData.category] || []).includes(s.subcategory) && s.subcategory !== '__custom__' && (
                              <option value={s.subcategory}>{s.subcategory}</option>
                            )}
                            <option value="__custom__">+ Add Custom...</option>
                          </select>
                        </div>
                        <input 
                          type="number"
                          step="0.01"
                          min="0"
                          value={s.amount}
                          onChange={e => handleSplitChange(idx, 'amount', e.target.value)}
                          style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
                          placeholder="Amount"
                          inputMode="decimal"
                        />
                        {splits.length > 1 && (
                          <button 
                            type="button" 
                            className="btn btn-ghost btn-icon" 
                            onClick={() => handleRemoveSplit(idx)}
                            style={{ color: 'var(--danger)', padding: '8px', flexShrink: 0 }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                    <button 
                      type="button" 
                      className="btn btn-ghost" 
                      onClick={handleAddSplit}
                      style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                    >
                      + Add Split
                    </button>
                    <div style={{ textAlign: 'right', fontSize: '0.9rem' }}>
                      <div style={{ color: 'var(--text-secondary)' }}>
                        Split Total: <span style={{ fontWeight: '600', color: isSumMatching ? 'var(--success)' : 'var(--danger)' }}>${splitsSum.toFixed(2)}</span>
                      </div>
                      {!isSumMatching && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: '4px', fontWeight: '500' }}>
                          ⚠️ Remaining: ${(parseFloat(formData.amount || 0) - splitsSum).toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px', gridColumn: 'span 2' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Status</label>
              <select 
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '1rem' }}
              >
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Payment Method</label>
              <select 
                value={formData.paymentMethod}
                onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '1rem' }}
              >
                <option value="Checking Account">Checking Account</option>
                <option value="American Express">American Express</option>
                <option value="Visa">Visa</option>
                <option value="Capital One">Capital One</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: '16px', gridColumn: 'span 2' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Notes (Optional)</label>
            <textarea 
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              placeholder="e.g. Dinner with Sarah, Confirmation #12345"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '0.95rem', minHeight: '80px', resize: 'vertical' }}
            />
          </div>
        </div>

        {formData.type === 'expense' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.95rem', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={formData.isRecurring}
              onChange={e => setFormData({ ...formData, isRecurring: e.target.checked })}
            />
            Make this a monthly recurring expense
          </label>
        )}

        <button 
          type="submit" 
          className="btn btn-primary" 
          disabled={isSplit && !isSumMatching}
          style={{ marginTop: '8px', width: '100%' }}
        >
          {editingId ? 'Save Changes' : 'Save Transaction'}
        </button>
      </form>
    </div>
  )
}

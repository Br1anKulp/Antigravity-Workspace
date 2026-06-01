import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

// ─── Custom Transaction Date Picker (Monthly Calendar Grid) ─────────────────────
function TransactionDatePicker({ value, onChange, selectedMonth, singleSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const parsedDates = useMemo(() => {
    return Array.isArray(value) ? value : [];
  }, [value]);

  // Use internal state for navigated month/year in the calendar picker
  const [viewYear, setViewYear] = useState(() => {
    const [y] = (selectedMonth || new Date().toISOString().slice(0, 7)).split('-');
    return parseInt(y);
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const [, m] = (selectedMonth || new Date().toISOString().slice(0, 7)).split('-');
    return parseInt(m);
  });

  // Sync viewed month when the parent's selectedMonth changes
  useEffect(() => {
    if (selectedMonth) {
      const [y, m] = selectedMonth.split('-');
      setViewYear(parseInt(y));
      setViewMonth(parseInt(m));
    }
  }, [selectedMonth]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const totalDays = new Date(viewYear, viewMonth, 0).getDate();
  const startDayOfWeek = new Date(viewYear, viewMonth - 1, 1).getDay();

  const toggleDate = (day) => {
    const paddedMonth = String(viewMonth).padStart(2, '0');
    const paddedDay = String(day).padStart(2, '0');
    const dateStr = `${viewYear}-${paddedMonth}-${paddedDay}`;

    if (singleSelect) {
      onChange([dateStr]);
      setIsOpen(false);
    } else {
      if (parsedDates.includes(dateStr)) {
        onChange(parsedDates.filter(d => d !== dateStr));
      } else {
        onChange([...parsedDates, dateStr].sort());
      }
    }
  };

  const selectToday = () => {
    const today = new Date();
    const localDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    onChange([localDateStr]);
    setIsOpen(false);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const daysGrid = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    daysGrid.push({ day: '', fullDate: null, isCurrentMonth: false });
  }
  for (let d = 1; d <= totalDays; d++) {
    const paddedMonth = String(viewMonth).padStart(2, '0');
    const paddedDay = String(d).padStart(2, '0');
    const fullDate = `${viewYear}-${paddedMonth}-${paddedDay}`;
    daysGrid.push({ day: d, fullDate, isCurrentMonth: true });
  }

  const formatReadableDate = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    const mName = monthNames[parseInt(m) - 1]?.slice(0, 3);
    return `${mName} ${parseInt(d)}`;
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div 
        className="glass-panel" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          padding: '10px 12px', 
          borderRadius: '8px', 
          border: '1px solid var(--border)', 
          background: 'var(--bg-base)', 
          color: 'var(--text-primary)', 
          fontSize: '0.95rem',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          minHeight: '44px',
          boxSizing: 'border-box'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>
          {parsedDates.length > 0 
            ? parsedDates.map(d => formatReadableDate(d)).join(', ') 
            : 'Select transaction date...'}
        </span>
        <Calendar size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
      </div>

      {isOpen && (
        <>
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }} 
            onClick={() => setIsOpen(false)}
          />
          <div 
            className="glass-panel" 
            style={{ 
              position: 'absolute', 
              top: '100%', 
              right: 0,
              marginTop: '6px', 
              padding: '14px', 
              zIndex: 1001, 
              width: '280px', 
              boxShadow: 'var(--shadow-lg)',
              border: 'var(--border) 1px solid',
              background: 'var(--bg-surface)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontWeight: '600', fontSize: '0.95rem', color: 'var(--text-primary)', minWidth: '100px', textAlign: 'center' }}>
                  {monthNames[viewMonth - 1]} {viewYear}
                </span>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <button 
                type="button" 
                onClick={selectToday}
                style={{ 
                  background: 'rgba(255,255,255,0.05)', 
                  border: '1px solid var(--border)', 
                  padding: '2px 8px', 
                  borderRadius: '4px', 
                  fontSize: '0.75rem', 
                  color: 'var(--primary)', 
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Today
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                <span key={day} style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  {day}
                </span>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
              {daysGrid.map((item, idx) => {
                if (!item.isCurrentMonth) {
                  return <div key={`empty-${idx}`} style={{ width: '28px', height: '28px' }} />;
                }

                const isSelected = parsedDates.includes(item.fullDate);
                const todayStr = new Date().toISOString().split('T')[0];
                const isToday = item.fullDate === todayStr;

                return (
                  <button
                    key={item.fullDate}
                    type="button"
                    onClick={() => toggleDate(item.day)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      border: isSelected 
                        ? 'none' 
                        : isToday 
                          ? '1px dashed var(--primary)' 
                          : '1px solid transparent',
                      background: isSelected ? 'var(--primary)' : 'transparent',
                      color: isSelected ? '#fff' : 'var(--text-primary)',
                      fontSize: '0.8rem',
                      fontWeight: isSelected || isToday ? '600' : '400',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {item.day}
                  </button>
                );
              })}
            </div>
            
            {!singleSelect && (
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => setIsOpen(false)}
                style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px', width: '100%', marginTop: '4px' }}
              >
                Done
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function TransactionForm({ onAdd, onUpdate, categoriesConfig, customCategories, selectedMonth }) {
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
  const [splits, setSplits] = useState([{ category: '', subcategory: '', amount: '', notes: '' }])

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
        setSplits(tx.splits.map(s => ({ category: s.category || tx.category, subcategory: s.subcategory, amount: String(s.amount), notes: s.notes || '' })));
      } else {
        setIsSplit(false);
        setSplits([{ category: '', subcategory: '', amount: '', notes: '' }]);
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
    setSplits([{ category: '', subcategory: '', amount: '', notes: '' }]);
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
      category: formData.type === 'income' ? 'Income' : (isSplit ? (splits[0]?.category || 'Split') : formData.category),
      subcategory: formData.type === 'income' ? '' : (isSplit ? 'Split' : formData.subcategory),
      splits: isSplit ? splits.map(s => ({ category: s.category, subcategory: s.subcategory, amount: parseFloat(s.amount) || 0, notes: (s.notes || '').trim() })) : null,
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
    setSplits(prev => [...prev, { category: formData.category, subcategory: '', amount: '', notes: '' }]);
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
              {editingId ? 'Transaction Date' : 'Transaction Date(s)'}
            </label>
            <TransactionDatePicker 
              value={formData.dates} 
              onChange={newDates => setFormData({ ...formData, dates: newDates })} 
              selectedMonth={selectedMonth} 
              singleSelect={!!editingId} 
            />
          </div>
          
          {formData.type === 'expense' && (
            <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="checkbox" 
                    checked={isSplit}
                    onChange={e => {
                      setIsSplit(e.target.checked);
                      if (e.target.checked) {
                        setSplits([
                          { category: formData.category, subcategory: formData.subcategory, amount: formData.amount, notes: '' },
                          { category: '', subcategory: '', amount: '', notes: '' }
                        ]);
                      } else {
                        setSplits([{ category: '', subcategory: '', amount: '', notes: '' }]);
                      }
                    }}
                  />
                  Split this transaction?
                </label>
              </div>

              {!isSplit ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Main Category</label>
                    <select 
                      value={formData.category}
                      required={!isSplit}
                      autoComplete="off"
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '1rem' }}
                    >
                      <option value="">Select Category</option>
                      {customCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {customCategories.length === 0 && (
                      <span style={{ display: 'block', marginTop: '6px', fontSize: '0.8rem', color: 'var(--warning)', fontWeight: '500' }}>
                        ⚠️ No categories configured yet. Please set up a budget first.
                      </span>
                    )}
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Subcategory</label>
                    <select 
                      value={formData.subcategory}
                      required={!isSplit}
                      autoComplete="off"
                      onChange={e => {
                        if (e.target.value === '__custom__') {
                          const custom = prompt('Enter custom subcategory:');
                          if (custom) {
                            setFormData({ ...formData, subcategory: custom });
                          } else {
                            setFormData({ ...formData, subcategory: '' });
                          }
                        } else {
                          setFormData({ ...formData, subcategory: e.target.value });
                        }
                      }}
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '1rem', appearance: 'auto' }}
                    >
                      <option value="">Select Subcategory</option>
                      {(categoriesConfig[formData.category] || []).map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                      {formData.subcategory && !(categoriesConfig[formData.category] || []).includes(formData.subcategory) && formData.subcategory !== '__custom__' && (
                        <option value={formData.subcategory}>{formData.subcategory}</option>
                      )}
                      <option value="__custom__">+ Add Custom...</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <label style={{ fontWeight: '600', fontSize: '0.95rem', color: 'var(--text-primary)' }}>Transaction Splits</label>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '12px' }}>
                    {splits.map((s, idx) => (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignItems: 'center' }}>
                          <div>
                            <select
                              value={s.category || ''}
                              required={isSplit}
                              onChange={e => {
                                handleSplitChange(idx, 'category', e.target.value);
                                handleSplitChange(idx, 'subcategory', ''); // Reset subcategory when category changes
                              }}
                              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '0.95rem' }}
                            >
                              <option value="">Select Main Category</option>
                              {customCategories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div style={{ position: 'relative' }}>
                            <select 
                              value={s.subcategory}
                              required={isSplit}
                              autoComplete="off"
                              onChange={e => {
                                if (e.target.value === '__custom__') {
                                  const custom = prompt('Enter custom subcategory:');
                                  if (custom) {
                                    handleSplitChange(idx, 'subcategory', custom);
                                  } else {
                                    handleSplitChange(idx, 'subcategory', '');
                                  }
                                } else {
                                  handleSplitChange(idx, 'subcategory', e.target.value);
                                }
                              }}
                              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '0.95rem', appearance: 'auto' }}
                            >
                              <option value="">Select Subcategory</option>
                              {(categoriesConfig[s.category] || []).map(sub => (
                                <option key={sub} value={sub}>{sub}</option>
                              ))}
                              {s.subcategory && !(categoriesConfig[s.category] || []).includes(s.subcategory) && s.subcategory !== '__custom__' && (
                                <option value={s.subcategory}>{s.subcategory}</option>
                              )}
                              <option value="__custom__">+ Add Custom...</option>
                            </select>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input 
                            type="number"
                            step="0.01"
                            min="0"
                            required={isSplit}
                            value={s.amount}
                            onChange={e => handleSplitChange(idx, 'amount', e.target.value)}
                            style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
                            placeholder="Amount"
                            inputMode="decimal"
                          />
                          <input
                            type="text"
                            value={s.notes || ''}
                            onChange={e => handleSplitChange(idx, 'notes', e.target.value)}
                            placeholder="Split notes (optional)"
                            style={{ flex: 2, padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '0.85rem', boxSizing: 'border-box' }}
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
                        <div style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: '4px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                          <span>⚠️ Remaining: ${(parseFloat(formData.amount || 0) - splitsSum).toFixed(2)}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const remainder = parseFloat(formData.amount || 0) - splitsSum;
                              if (Math.abs(remainder) < 0.01) return;
                              const newSplits = [...splits];
                              const lastSplitIdx = newSplits.length - 1;
                              if (lastSplitIdx >= 0 && (!newSplits[lastSplitIdx].amount || parseFloat(newSplits[lastSplitIdx].amount) === 0)) {
                                newSplits[lastSplitIdx].amount = String(remainder.toFixed(2));
                              } else {
                                newSplits.push({ subcategory: '', amount: String(remainder.toFixed(2)) });
                              }
                              setSplits(newSplits);
                            }}
                            style={{ background: 'var(--primary-bg)', color: 'var(--primary)', border: 'none', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}
                          >
                            Auto-Fill
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
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

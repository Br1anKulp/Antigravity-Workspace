import React, { useState } from 'react'
import { Calendar, ChevronDown, ChevronRight, Plus, Pencil, Save, X, Settings, Trash2 } from 'lucide-react'
import { doc, setDoc, getDoc, updateDoc, deleteField, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

export default function BudgetProgress({ transactions, budgets, user, householdId, customCategories, onManageClick, selectedMonth }) {
  const [expandedCategories, setExpandedCategories] = useState({})
  
  // Add subcat states
  const [addingSubcatTo, setAddingSubcatTo] = useState(null)
  const [newSubName, setNewSubName] = useState('')
  const [newSubLimit, setNewSubLimit] = useState('')
  const [newSubDue, setNewSubDue] = useState('')
  
  // Edit states
  const [editingCat, setEditingCat] = useState(null)
  const [editingSubcat, setEditingSubcat] = useState(null) // {cat, oldName}
  const [editLimit, setEditLimit] = useState('')
  const [editDue, setEditDue] = useState('')
  const [editName, setEditName] = useState('')
  
  const [isSaving, setIsSaving] = useState(false)
  const [isCopying, setIsCopying] = useState(false)

  const getPrevMonth = (curr) => {
    let [year, month] = curr.split('-').map(Number);
    if (month === 1) {
      year -= 1;
      month = 12;
    } else {
      month -= 1;
    }
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  const handleCopyPreviousMonth = async () => {
    if (!user) return;
    setIsCopying(true);
    try {
      const prevMonth = getPrevMonth(selectedMonth);
      const prevDocRef = doc(db, 'budgets', `${householdId}-${prevMonth}`);
      const prevDocSnap = await getDoc(prevDocRef);
      if (prevDocSnap.exists()) {
        await setDoc(doc(db, 'budgets', `${householdId}-${selectedMonth}`), prevDocSnap.data());
      } else {
        alert("No previous budget found to copy.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to copy budget.");
    } finally {
      setIsCopying(false);
    }
  }

  const calculateCatLimit = (catData) => {
    if (!catData?.subcategories) return 0;
    return Object.values(catData.subcategories).reduce((sum, sub) => sum + (parseFloat(sub.limit) || 0), 0);
  };

  const toggleCategory = (cat) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  // Calculate spent per category and subcategory
  const categorySpent = {}
  customCategories.forEach(cat => {
    categorySpent[cat] = { total: 0, subs: {} }
    
    transactions
      .filter(t => t.type === 'expense' && t.category === cat)
      .forEach(t => {
        categorySpent[cat].total += parseFloat(t.amount)
        if (t.splits && t.splits.length > 0) {
          t.splits.forEach(split => {
            if (split.subcategory) {
              categorySpent[cat].subs[split.subcategory] = (categorySpent[cat].subs[split.subcategory] || 0) + parseFloat(split.amount)
            }
          })
        } else if (t.subcategory) {
          categorySpent[cat].subs[t.subcategory] = (categorySpent[cat].subs[t.subcategory] || 0) + parseFloat(t.amount)
        }
      })
  })

  // Only display categories that have an active budget limit > 0 OR have actual transaction spending > 0
  const activeBudgets = customCategories.filter(cat => {
    const catData = budgets && budgets[cat] ? budgets[cat] : { limit: 0, dueDate: '', subcategories: {} };
    const spent = categorySpent[cat]?.total || 0;
    const limit = calculateCatLimit(catData);
    return limit > 0 || spent > 0;
  });

  const renderDueDate = (days) => {
    if (!days) return null;
    const dayArray = String(days).split(',').map(d => d.trim()).filter(d => !isNaN(d) && d !== '');
    if (dayArray.length === 0) return null;
    
    return (
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {dayArray.map((day, idx) => (
          <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', background: 'var(--bg-surface)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
            <Calendar size={10} /> {dayArray.length > 1 ? `${day}${getOrdinal(day)}` : `Due the ${day}${getOrdinal(day)}`}
          </span>
        ))}
      </div>
    )
  }

  const getOrdinal = (n) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  }

  const getColor = (percent) => {
    if (percent === 0) return 'var(--primary)';
    if (percent < 80) return 'var(--success)';
    if (percent <= 100) return 'var(--warning)';
    return 'var(--danger)';
  }

  const handleSaveInlineSubcategory = async (e, cat) => {
    e.preventDefault();
    if (!user || !newSubName) return;
    setIsSaving(true);
    const limit = parseFloat(newSubLimit) || 0;
    try {
      const docRef = doc(db, 'budgets', `${householdId}-${selectedMonth}`);
      await updateDoc(docRef, {
        [`${cat}.subcategories.${newSubName}`]: { limit, dueDate: newSubDue }
      });
      setAddingSubcatTo(null);
      setNewSubName('');
      setNewSubLimit('');
      setNewSubDue('');
    } catch (err) {
      console.error(err);
      alert('Failed to save subcategory.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditCatSave = async (e, cat) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    try {
      const docRef = doc(db, 'budgets', `${householdId}-${selectedMonth}`);
      await updateDoc(docRef, {
        [`${cat}.limit`]: parseFloat(editLimit) || 0,
        [`${cat}.dueDate`]: editDue || ''
      });
      setEditingCat(null);
    } catch (err) {
      console.error(err);
      alert('Failed to save category edit.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSubcatSave = async (e, cat) => {
    e.preventDefault();
    if (!user || !editName) return;
    setIsSaving(true);
    const oldName = editingSubcat.oldName;
    const subcatData = {
      limit: parseFloat(editLimit) || 0,
      dueDate: editDue || ''
    };
    try {
      const docRef = doc(db, 'budgets', `${householdId}-${selectedMonth}`);
      if (oldName !== editName) {
        // Atomic: write new name, delete old name in one call
        await updateDoc(docRef, {
          [`${cat}.subcategories.${editName}`]: subcatData,
          [`${cat}.subcategories.${oldName}`]: deleteField()
        });

        // Query transactions in this category and old subcategory to rename them
        try {
          const q = query(
            collection(db, 'transactions'),
            where('householdId', '==', householdId),
            where('category', '==', cat),
            where('subcategory', '==', oldName)
          );
          const txSnap = await getDocs(q);
          const updatePromises = [];
          txSnap.forEach((docSnap) => {
            const date = docSnap.data().date;
            if (date && date.startsWith(selectedMonth)) {
              updatePromises.push(
                updateDoc(doc(db, 'transactions', docSnap.id), { subcategory: editName })
              );
            }
          });
          if (updatePromises.length > 0) {
            await Promise.all(updatePromises);
          }
        } catch (txErr) {
          console.error('Failed to update renamed subcategory in transactions:', txErr);
        }
      } else {
        await updateDoc(docRef, {
          [`${cat}.subcategories.${editName}`]: subcatData
        });
      }
      setEditingSubcat(null);
    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSubcat = async (cat, subName) => {
    if (!user || !window.confirm(`Delete "${subName}"? This only removes the budget limit, not your transactions.`)) return;
    setIsSaving(true);
    try {
      const docRef = doc(db, 'budgets', `${householdId}-${selectedMonth}`);
      await updateDoc(docRef, {
        [`${cat}.subcategories.${subName}`]: deleteField()
      });

      // Clear the subcategory name on any transactions using this subcategory in this month
      try {
        const q = query(
          collection(db, 'transactions'),
          where('householdId', '==', householdId),
          where('category', '==', cat),
          where('subcategory', '==', subName)
        );
        const txSnap = await getDocs(q);
        const updatePromises = [];
        txSnap.forEach((docSnap) => {
          const date = docSnap.data().date;
          if (date && date.startsWith(selectedMonth)) {
            updatePromises.push(
              updateDoc(doc(db, 'transactions', docSnap.id), { subcategory: '' })
            );
          }
        });
        if (updatePromises.length > 0) {
          await Promise.all(updatePromises);
        }
      } catch (txErr) {
        console.error('Failed to clear deleted subcategory in transactions:', txErr);
      }

      setEditingSubcat(null);
    } catch (err) {
      console.error(err);
      alert('Failed to delete subcategory.');
    } finally {
      setIsSaving(false);
    }
  };

  const startEditCat = (e, cat, catData) => {
    e.stopPropagation();
    setEditLimit(catData.limit || '');
    setEditDue(catData.dueDate || '');
    setEditingCat(cat);
  };

  const startEditSubcat = (e, cat, subName, subData) => {
    e.stopPropagation();
    setEditName(subName);
    setEditLimit(subData.limit || '');
    setEditDue(subData.dueDate || '');
    setEditingSubcat({ cat, oldName: subName });
  };

  if (Object.keys(budgets).length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '32px', textAlign: 'center' }}>
        <h3 style={{ margin: '0 0 16px' }}>No Budget Set</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
          You can start fresh, or copy your entire budget setup from last month to save time.
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={handleCopyPreviousMonth} disabled={isCopying}>
            {isCopying ? 'Copying...' : 'Copy Previous Month'}
          </button>
          <button className="btn btn-ghost" onClick={onManageClick}>
            Start Fresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ margin: 0 }}>Budgets</h3>
        <button 
          className="btn btn-ghost btn-icon" 
          onClick={onManageClick}
          title="Manage Categories & Settings"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Settings size={20} />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {activeBudgets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-secondary)', background: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.95rem' }}>
            No active budgets or spending for this month. Click the gear icon above to set budget limits!
          </div>
        ) : (
          activeBudgets.map(cat => {
          const catData = budgets && budgets[cat] ? budgets[cat] : { limit: 0, dueDate: '', subcategories: {} };
          const spent = categorySpent[cat].total
          const subcategories = catData.subcategories || {}
          
          let limit = calculateCatLimit(catData)
          
          // Avoid division by zero
          const percent = limit > 0 ? (spent / limit) * 100 : (spent > 0 ? 101 : 0)
          const progressPercent = Math.min(100, percent)
          const color = getColor(percent)
          const isExpanded = expandedCategories[cat]
          
          // Show subcategories if they have a budget limit > 0 OR if there's spending on them
          const activeSubs = Object.keys(categorySpent[cat].subs);
          Object.keys(subcategories).forEach(sub => {
             if (!activeSubs.includes(sub)) activeSubs.push(sub);
          });

          return (
            <div key={cat} style={{ background: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
              
                {/* Main Category Accordion Header */}
                <div 
                  onClick={() => { if(editingCat !== cat) toggleCategory(cat) }}
                  style={{ padding: '16px', display: 'flex', flexDirection: 'column', cursor: editingCat === cat ? 'default' : 'pointer', transition: 'background-color 0.2s', position: 'relative' }}
                  onMouseOver={e => {
                    if (editingCat !== cat) e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                    const btn = e.currentTarget.querySelector('.edit-cat-btn');
                    if (btn) btn.style.opacity = '1';
                  }}
                  onMouseOut={e => {
                    if (editingCat !== cat) e.currentTarget.style.backgroundColor = 'transparent';
                    const btn = e.currentTarget.querySelector('.edit-cat-btn');
                    if (btn) btn.style.opacity = '0';
                  }}
                >
                  {editingCat === cat ? (
                    <form onSubmit={(e) => handleEditCatSave(e, cat)} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Editing: {cat}</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="number"
                          placeholder="Amount"
                          min="0" step="0.01"
                          value={editLimit}
                          onChange={e => setEditLimit(e.target.value)}
                          style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '1rem' }}
                          inputMode="decimal"
                        />
                        <input
                          type="text"
                          placeholder="Due day e.g. 1"
                          value={editDue}
                          onChange={e => setEditDue(e.target.value)}
                          style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '1rem' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); setEditingCat(null); }} style={{ flex: 1 }}>
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <Save size={14} /> {isSaving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', fontSize: '1.05rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {activeSubs.length > 0 ? (
                            isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />
                          ) : <div style={{ width: 18 }} />}
                          <div>
                            <div style={{ fontWeight: '600', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {cat}
                              <button 
                                className="btn btn-ghost btn-icon edit-cat-btn"
                                onClick={(e) => startEditCat(e, cat, catData)}
                                style={{ padding: '4px', opacity: 0, transition: 'opacity 0.2s', color: 'var(--text-secondary)' }}
                                title="Edit Category Limit & Due Date"
                              >
                                <Pencil size={12} />
                              </button>
                            </div>
                            {renderDueDate(catData.dueDate)}
                          </div>
                        </div>
                        <span style={{ fontWeight: '500' }}>
                          {spent > 0 ? (
                            <>
                              <span style={{ color: color }}>${spent.toFixed(2)}</span>
                              <span style={{ color: 'var(--text-secondary)', margin: '0 4px' }}>spent /</span>
                              <span style={{ color: 'var(--text-primary)' }}>${limit.toFixed(2)}</span>
                              <span style={{ color: 'var(--text-secondary)', marginLeft: '4px' }}>budgeted</span>
                            </>
                          ) : (
                            <>
                              <span style={{ color: 'var(--text-primary)' }}>${limit.toFixed(2)}</span>
                              <span style={{ color: 'var(--text-secondary)', marginLeft: '4px' }}>budgeted</span>
                            </>
                          )}
                        </span>
                      </div>
                      <div style={{ height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ 
                          height: '100%', 
                          width: `${progressPercent}%`, 
                          background: color,
                          transition: 'width 0.3s ease, background-color 0.3s ease'
                        }} />
                      </div>
                    </>
                  )}
                </div>

              {/* Subcategories (Expanded Content) */}
              {isExpanded && activeSubs.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 16px 16px 42px', borderTop: '1px solid var(--border)', paddingTop: '16px', background: 'var(--bg-surface)' }}>
                  {activeSubs.map(sub => {
                    const subSpent = categorySpent[cat].subs[sub] || 0
                    const subData = typeof subcategories[sub] === 'object' ? subcategories[sub] : { limit: subcategories[sub] || 0, dueDate: '' };
                    const subLimit = subData.limit;
                    
                    const subPercentRaw = subLimit > 0 ? (subSpent / subLimit) * 100 : (subSpent > 0 ? 101 : 0);
                    const subProgressPercent = Math.min(100, subPercentRaw)
                    const subColor = getColor(subPercentRaw)

                    return (
                      <div 
                        key={sub} 
                        style={{ position: 'relative' }}
                        onMouseOver={e => {
                          const btn = e.currentTarget.querySelector('.edit-sub-btn');
                          if (btn) btn.style.opacity = '1';
                        }}
                        onMouseOut={e => {
                          const btn = e.currentTarget.querySelector('.edit-sub-btn');
                          if (btn) btn.style.opacity = '0';
                        }}
                      >
                        {editingSubcat?.cat === cat && editingSubcat?.oldName === sub ? (
                          <form onSubmit={(e) => handleEditSubcatSave(e, cat)} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Editing: {sub}</span>
                            <input
                              type="text"
                              required
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '1rem', boxSizing: 'border-box' }}
                              placeholder="Subcategory name"
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input
                                type="number"
                                placeholder="Amount"
                                min="0" step="0.01"
                                value={editLimit}
                                onChange={e => setEditLimit(e.target.value)}
                                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '1rem' }}
                                inputMode="decimal"
                              />
                              <input
                                type="text"
                                placeholder="Due day e.g. 1"
                                value={editDue}
                                onChange={e => setEditDue(e.target.value)}
                                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '1rem' }}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => setEditingSubcat(null)}
                                style={{ flex: 1 }}
                              >
                                Cancel
                              </button>
                              <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <Save size={14} /> {isSaving ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.9rem' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: '500', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ flex: 1 }}>{sub}</span>
                                  <button
                                    className="btn btn-ghost btn-icon"
                                    onClick={(e) => startEditSubcat(e, cat, sub, subData)}
                                    style={{ padding: '4px', color: 'var(--text-secondary)', flexShrink: 0 }}
                                    title="Edit"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                  <button
                                    className="btn btn-ghost btn-icon"
                                    onClick={(e) => { e.stopPropagation(); handleDeleteSubcat(cat, sub); }}
                                    style={{ padding: '4px', color: 'var(--danger)', flexShrink: 0 }}
                                    title="Delete"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                                {renderDueDate(subData.dueDate)}
                              </div>
                              <span style={{ fontWeight: '500', flexShrink: 0, marginLeft: '8px' }}>
                                <span style={{ color: subColor }}>${subSpent.toFixed(2)}</span>
                                <span style={{ color: 'var(--text-primary)', margin: '0 4px' }}>/</span>
                                <span style={{ color: 'var(--text-primary)' }}>${subLimit.toFixed(2)}</span>
                              </span>
                            </div>
                            <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ 
                                height: '100%', 
                                width: `${subProgressPercent}%`, 
                                background: subColor,
                                transition: 'width 0.3s ease, background-color 0.3s ease'
                              }} />
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                  
                  {addingSubcatTo === cat ? (
                    <form 
                      onSubmit={(e) => handleSaveInlineSubcategory(e, cat)} 
                      style={{ display: 'flex', gap: '8px', marginTop: '8px', padding: '12px', background: 'var(--bg-base)', borderRadius: '6px', border: '1px solid var(--border)' }}
                    >
                      <input 
                        type="text" 
                        placeholder="Name" 
                        required 
                        value={newSubName}
                        onChange={e => setNewSubName(e.target.value)}
                        style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                      />
                      <input 
                        type="number" 
                        placeholder="Amount" 
                        min="0" step="0.01" 
                        value={newSubLimit}
                        onChange={e => setNewSubLimit(e.target.value)}
                        style={{ width: '80px', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                      />
                      <input 
                        type="text" 
                        placeholder="Days e.g. 1, 15" 
                        value={newSubDue}
                        onChange={e => setNewSubDue(e.target.value)}
                        style={{ width: '110px', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                      />
                      <button type="submit" className="btn btn-primary" style={{ padding: '8px 12px', fontSize: '0.85rem' }} disabled={isSaving}>
                        {isSaving ? '...' : 'Save'}
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => { setAddingSubcatTo(null); setNewSubDue(''); }} style={{ padding: '8px 12px', fontSize: '0.85rem' }}>
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <button 
                      className="btn btn-ghost" 
                      onClick={() => {
                        setAddingSubcatTo(cat);
                        setNewSubName('');
                        setNewSubLimit('');
                      }}
                      style={{ marginTop: '8px', padding: '8px', fontSize: '0.85rem', width: 'fit-content' }}
                    >
                      <Plus size={14} /> Add Subcategory
                    </button>
                  )}
                </div>
              )}

            </div>
          )
        }))}
      </div>
    </div>
  )
}

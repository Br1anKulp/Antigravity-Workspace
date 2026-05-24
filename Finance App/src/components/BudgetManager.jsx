import React, { useState, useEffect } from 'react';
import { MAIN_CATEGORIES } from '../config/categories';
import { Save, Plus, Trash2, Calendar } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function BudgetManager({ user, budgets: globalBudgets, isOpen, onClose, selectedMonth, householdId }) {
  const [budgets, setBudgets] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      let initial = JSON.parse(JSON.stringify(globalBudgets || {}));
      setBudgets(initial);
    }
  }, [isOpen, globalBudgets]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const sanitizedBudgets = {};
      Object.keys(budgets).forEach(cat => {
        if (cat === '_migrated_v2') return; // Ignore migration flag to keep database clean
        
        const catData = budgets[cat] || {};
        const subcategories = catData.subcategories || {};
        const activeSubcategories = {};
        
        Object.keys(subcategories).forEach(sub => {
          const subData = typeof subcategories[sub] === 'object'
            ? subcategories[sub]
            : { limit: subcategories[sub] || 0, dueDate: '' };
            
          activeSubcategories[sub] = {
            limit: parseFloat(subData.limit) || 0,
            dueDate: subData.dueDate || ''
          };
        });
        
        sanitizedBudgets[cat] = {
          limit: parseFloat(catData.limit) || 0,
          dueDate: catData.dueDate || '',
          subcategories: activeSubcategories
        };
      });

      const cleanData = JSON.parse(JSON.stringify(sanitizedBudgets, (k, v) => v === undefined ? null : v));
      await setDoc(doc(db, 'budgets', `${householdId}-${selectedMonth}`), cleanData);
      onClose();
    } catch (err) {
      console.error('Error saving budgets:', err);
      alert(`Failed to save budgets: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategory = () => {
    const name = prompt('Enter new Main Category name:');
    if (!name || budgets[name]) return;
    setBudgets(prev => ({ ...prev, [name]: { limit: 0, dueDate: '', subcategories: {} } }));
  };

  const handleDeleteCategory = (cat) => {
    if (!window.confirm(`Delete "${cat}" and all its limits? (Transactions are kept)`)) return;
    setBudgets(prev => {
      const newB = { ...prev };
      delete newB[cat];
      return newB;
    });
  };

  const handleAddSubcategory = (category) => {
    const name = prompt(`New subcategory name for "${category}":`);
    if (!name) return;
    setBudgets(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        subcategories: {
          ...(prev[category]?.subcategories || {}),
          [name]: { limit: 0, dueDate: '' }
        }
      }
    }));
  };

  const handleSubcategoryChange = (category, subName, field, value) => {
    setBudgets(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        subcategories: {
          ...prev[category].subcategories,
          [subName]: {
            ...(prev[category].subcategories[subName] || {}),
            [field]: field === 'dueDate' ? value : (parseFloat(value) || 0)
          }
        }
      }
    }));
  };

  const handleRemoveSubcategory = (category, subName) => {
    setBudgets(prev => {
      const newSubs = { ...prev[category].subcategories };
      delete newSubs[subName];
      return { ...prev, [category]: { ...prev[category], subcategories: newSubs } };
    });
  };

  const calculateCatLimit = (catData) => {
    if (!catData?.subcategories) return 0;
    return Object.values(catData.subcategories).reduce((sum, sub) => {
      const val = typeof sub === 'object' ? (parseFloat(sub.limit) || 0) : (parseFloat(sub) || 0);
      return sum + val;
    }, 0);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(4px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '700px',
        height: '92vh',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '16px 16px 0 0',
        overflow: 'hidden',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
      }}>

        {/* Header with Save button always at top */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          gap: '8px',
        }}>
          <button
            className="btn btn-ghost"
            onClick={onClose}
            style={{ fontWeight: '600', flexShrink: 0 }}
          >
            Cancel
          </button>
          <h3 style={{ margin: 0, fontSize: '0.95rem', flex: 1, textAlign: 'center' }}>
            Budgets
          </h3>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 18px',
              fontSize: '0.95rem',
              fontWeight: '600',
              flexShrink: 0,
            }}
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '16px',
          WebkitOverflowScrolling: 'touch',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {Object.keys(budgets).map(category => {
              if (category === '_migrated_v2') return null;
              const catData = budgets[category] || { subcategories: {} };
              const subNames = Object.keys(catData.subcategories || {});

              return (
                <div key={category} style={{
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  background: 'var(--bg-base)',
                }}>
                  {/* Category row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: subNames.length ? '12px' : 0 }}>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '1rem' }}>{category}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Expected: <strong style={{ color: 'var(--text-primary)' }}>${calculateCatLimit(catData).toFixed(2)}</strong>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        className="btn btn-ghost btn-icon"
                        onClick={() => handleAddSubcategory(category)}
                        style={{ color: 'var(--primary)', padding: '10px' }}
                        title="Add Subcategory"
                      >
                        <Plus size={18} />
                      </button>
                      <button
                        className="btn btn-ghost btn-icon"
                        onClick={() => handleDeleteCategory(category)}
                        style={{ color: 'var(--danger)', padding: '10px' }}
                        title="Delete Category"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Subcategories */}
                  {subNames.length > 0 && (
                    <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {subNames.map(subName => {
                        const subData = typeof catData.subcategories[subName] === 'object'
                          ? catData.subcategories[subName]
                          : { limit: catData.subcategories[subName] || 0, dueDate: '' };

                        return (
                          <div key={subName} style={{ paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', marginBottom: '6px' }}>
                              {subName}
                            </label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={subData.limit || ''}
                                onChange={e => handleSubcategoryChange(category, subName, 'limit', e.target.value)}
                                style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '1rem' }}
                                placeholder="$0.00"
                                inputMode="decimal"
                              />
                              <div style={{ position: 'relative', flex: 1 }}>
                                <Calendar size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                <input
                                  type="text"
                                  value={subData.dueDate || ''}
                                  onChange={e => handleSubcategoryChange(category, subName, 'dueDate', e.target.value)}
                                  style={{ width: '100%', padding: '10px 10px 10px 28px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '1rem', boxSizing: 'border-box' }}
                                  placeholder="Due day e.g. 1"
                                />
                              </div>
                              <button
                                className="btn btn-ghost btn-icon"
                                onClick={() => handleRemoveSubcategory(category, subName)}
                                style={{ color: 'var(--danger)', padding: '10px', flexShrink: 0 }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add Category at bottom of list */}
            <button
              className="btn btn-ghost"
              onClick={handleAddCategory}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', justifyContent: 'center', padding: '14px', width: '100%', marginBottom: '8px' }}
            >
              <Plus size={18} /> Add Main Category
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

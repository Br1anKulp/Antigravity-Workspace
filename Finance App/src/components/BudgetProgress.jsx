import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Calendar, ChevronDown, ChevronRight, Plus, Pencil, Save, Trash2, GripVertical, Copy } from 'lucide-react'
import { doc, setDoc, getDoc, updateDoc, deleteField, collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ─── Monthly Day Grid Calendar Picker ──────────────────────────────────────────
function CalendarDayPicker({ value, onChange, onBlur }) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Parse existing values
  const selectedDays = useMemo(() => {
    return String(value || '')
      .split(',')
      .map(d => parseInt(d.trim()))
      .filter(d => !isNaN(d) && d >= 1 && d <= 31);
  }, [value]);

  const toggleDay = (day) => {
    let newDays;
    if (selectedDays.includes(day)) {
      newDays = selectedDays.filter(d => d !== day);
    } else {
      newDays = [...selectedDays, day].sort((a, b) => a - b);
    }
    const val = newDays.join(', ');
    onChange(val);
  };

  // Generate 31 days
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Visual trigger input */}
      <div 
        className="glass-panel" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          padding: '10px', 
          borderRadius: '6px', 
          border: '1px solid var(--border)', 
          background: 'var(--bg-surface)', 
          color: value ? 'var(--text-primary)' : 'var(--text-secondary)', 
          fontSize: '0.95rem',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          minHeight: '42px',
          boxSizing: 'border-box'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>
          {selectedDays.length > 0 
            ? `Due on: ${selectedDays.map(d => `${d}${d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'}`).join(', ')}` 
            : 'Select due day(s)...'}
        </span>
        <Calendar size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
      </div>

      {isOpen && (
        <>
          {/* Overlay to close picker */}
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }} 
            onClick={() => {
              setIsOpen(false);
              if (onBlur) onBlur();
            }}
          />
          
          {/* Calendar Grid Dropdown */}
          <div 
            className="glass-panel" 
            style={{ 
              position: 'absolute', 
              top: '100%', 
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: '6px', 
              padding: '12px', 
              zIndex: 1001, 
              width: '260px', 
              boxShadow: 'var(--shadow-md)',
              border: 'var(--border) 1px solid',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ textAlign: 'center', fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-secondary)', paddingBottom: '4px', borderBottom: '1px solid var(--border)' }}>
              Select Monthly Due Date(s)
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
              {days.map(day => {
                const isSelected = selectedDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      border: isSelected ? 'none' : '1px solid var(--border)',
                      background: isSelected ? 'var(--primary)' : 'var(--bg-base)',
                      color: isSelected ? '#fff' : 'var(--text-primary)',
                      fontSize: '0.8rem',
                      fontWeight: isSelected ? '600' : '400',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--primary)'; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--border)'; }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={() => {
                setIsOpen(false);
                if (onBlur) onBlur();
              }}
              style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px' }}
            >
              Done
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sortable Category Row ────────────────────────────────────────────────────
function SortableCategoryRow({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, data: { type: 'cat' } })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative',
    zIndex: isDragging ? 10 : 'auto',
  }
  return (
    <div ref={setNodeRef} style={style}>
      {children({ dragHandleProps: { ...attributes, ...listeners } })}
    </div>
  )
}

// ─── Sortable Subcategory Row ─────────────────────────────────────────────────
function SortableSubRow({ id, cat, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, data: { type: 'sub', cat } })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <div ref={setNodeRef} style={style}>
      {children({ dragHandleProps: { ...attributes, ...listeners } })}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BudgetProgress({ transactions, budgets, user, householdId, customCategories, selectedMonth }) {
  const [expandedCategories, setExpandedCategories] = useState({})

  // Ordered lists (derived from budgets._categoryOrder / ._subcategoryOrder)
  const [catOrder, setCatOrder] = useState([])
  const [subOrders, setSubOrders] = useState({}) // { [cat]: [sub1, sub2, ...] }

  // Add subcat states
  const [addingSubcatTo, setAddingSubcatTo] = useState(null)
  const [newSubName, setNewSubName] = useState('')
  const [newSubLimit, setNewSubLimit] = useState('')
  const [newSubDue, setNewSubDue] = useState('')

  // Edit states
  const [editingCat, setEditingCat] = useState(null)
  const [editingSubcat, setEditingSubcat] = useState(null)
  const [editLimit, setEditLimit] = useState('')
  const [editDue, setEditDue] = useState('')
  const [editName, setEditName] = useState('')

  const [isSaving, setIsSaving] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [addingNewCat, setAddingNewCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatDue, setNewCatDue] = useState('')
  const [activeDragId, setActiveDragId] = useState(null)
  const [activeDragType, setActiveDragType] = useState(null) // 'cat' | 'sub'
  const [activeDragCat, setActiveDragCat] = useState(null)

  // ── Sync order from budgets ──────────────────────────────────────────────
  useEffect(() => {
    const storedOrder = budgets?._categoryOrder
    const allCats = customCategories.filter(c => c !== '_categoryOrder' && c !== '_subcategoryOrder')

    if (storedOrder && Array.isArray(storedOrder)) {
      // Merge stored order with any newly added categories
      const ordered = [
        ...storedOrder.filter(c => allCats.includes(c)),
        ...allCats.filter(c => !storedOrder.includes(c)),
      ]
      setCatOrder(ordered)
    } else {
      setCatOrder(allCats)
    }

    // Sub orders — read from _subcategoryOrder (matches saveSubOrder write path)
    const newSubOrders = {}
    allCats.forEach(cat => {
      const subs = Object.keys(budgets?.[cat]?.subcategories || {}).filter(s => s !== '_order')
      const storedSubOrder = budgets?.[cat]?._subcategoryOrder
      if (storedSubOrder && Array.isArray(storedSubOrder)) {
        newSubOrders[cat] = [
          ...storedSubOrder.filter(s => subs.includes(s)),
          ...subs.filter(s => !storedSubOrder.includes(s)),
        ]
      } else {
        newSubOrders[cat] = subs
      }
    })
    setSubOrders(newSubOrders)
  }, [budgets, customCategories])

  // ── Custom collision: only match items of the same type ──────────────────
  const typeSafeCollision = useCallback((args) => {
    const activeId = String(args.active.id)
    const isSubDrag = activeId.includes('::')
    const filtered = {
      ...args,
      droppableContainers: args.droppableContainers.filter(
        ({ id }) => String(id).includes('::') === isSubDrag
      ),
    }
    return closestCenter(filtered)
  }, [])

  // ── DnD sensors ─────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  // ── Persist category order ───────────────────────────────────────────────
  const saveCatOrder = useCallback(async (newOrder) => {
    if (!user) return
    try {
      await updateDoc(doc(db, 'budgets', `${householdId}-${selectedMonth}`), {
        _categoryOrder: newOrder,
      })
    } catch (err) {
      console.error('Failed to save category order:', err)
    }
  }, [user, householdId, selectedMonth])

  // ── Persist subcategory order ────────────────────────────────────────────
  const saveSubOrder = useCallback(async (cat, newOrder) => {
    if (!user) return
    try {
      await updateDoc(doc(db, 'budgets', `${householdId}-${selectedMonth}`), {
        [`${cat}._subcategoryOrder`]: newOrder,
      })
    } catch (err) {
      console.error('Failed to save subcategory order:', err)
    }
  }, [user, householdId, selectedMonth])

  // ── DnD handlers ────────────────────────────────────────────────────────
  const handleDragStart = ({ active }) => {
    setActiveDragId(active.id)
    setActiveDragType(active.data.current?.type)
    setActiveDragCat(active.data.current?.cat)
  }

  const handleDragEnd = ({ active, over }) => {
    setActiveDragId(null)
    setActiveDragType(null)
    setActiveDragCat(null)
    if (!over || active.id === over.id) return

    const type = active.data.current?.type
    if (type === 'cat') {
      const oldIdx = catOrder.indexOf(active.id)
      const newIdx = catOrder.indexOf(over.id)
      if (oldIdx === -1 || newIdx === -1) return
      const newOrder = arrayMove(catOrder, oldIdx, newIdx)
      setCatOrder(newOrder)
      saveCatOrder(newOrder)
    } else if (type === 'sub') {
      const cat = active.data.current?.cat
      const subs = subOrders[cat] || []
      const oldIdx = subs.indexOf(active.id.replace(`${cat}::`, ''))
      const newIdx = subs.indexOf(over.id.replace(`${cat}::`, ''))
      if (oldIdx === -1 || newIdx === -1) return
      const newOrder = arrayMove(subs, oldIdx, newIdx)
      setSubOrders(prev => ({ ...prev, [cat]: newOrder }))
      saveSubOrder(cat, newOrder)
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getSubInstanceSpent = (txsArray = [], subDueDays = [], targetDay = null) => {
    if (!Array.isArray(txsArray)) return 0;
    
    const parsedDays = subDueDays.map(d => parseInt(d)).filter(d => !isNaN(d) && d >= 1 && d <= 31);
    if (parsedDays.length <= 1 || !targetDay) {
      return txsArray.reduce((sum, tx) => sum + tx.amount, 0);
    }
    
    const sortedDays = [...parsedDays].sort((a, b) => a - b);
    const targetDayInt = parseInt(targetDay);
    
    return txsArray
      .filter(tx => {
        const dueDaysLessOrEqual = sortedDays.filter(d => tx.day >= d);
        let assignedDay;
        if (dueDaysLessOrEqual.length > 0) {
          assignedDay = dueDaysLessOrEqual[dueDaysLessOrEqual.length - 1];
        } else {
          assignedDay = sortedDays[0];
        }
        return assignedDay === targetDayInt;
      })
      .reduce((sum, tx) => sum + tx.amount, 0);
  };

  const getPrevMonth = (curr) => {
    let [year, month] = curr.split('-').map(Number)
    if (month === 1) { year -= 1; month = 12 } else { month -= 1 }
    return `${year}-${String(month).padStart(2, '0')}`
  }

  const handleCopyPreviousMonth = async () => {
    if (!user) return
    if (!window.confirm("Are you sure you want to copy the previous month's budget? This will completely replace your current budget categories, subcategories, and limits for this month.")) return
    
    setIsCopying(true)
    try {
      const prevMonth = getPrevMonth(selectedMonth)
      const prevDocSnap = await getDoc(doc(db, 'budgets', `${householdId}-${prevMonth}`))
      if (prevDocSnap.exists()) {
        await setDoc(doc(db, 'budgets', `${householdId}-${selectedMonth}`), prevDocSnap.data())
      } else {
        alert('No previous budget found to copy.')
      }
    } catch (err) {
      console.error(err)
      alert('Failed to copy budget.')
    } finally {
      setIsCopying(false)
    }
  }

  const calculateCatLimit = (catData) => {
    const subLimitSum = Object.entries(catData?.subcategories || {})
      .filter(([k]) => k !== '_order')
      .reduce((sum, [, sub]) => {
        const subData = typeof sub === 'object' ? sub : { limit: sub || 0, dueDate: '' }
        const dueDays = String(subData.dueDate || '').split(',').map(d => d.trim()).filter(d => !isNaN(d) && d !== '')
        const multiplier = dueDays.length > 0 ? dueDays.length : 1
        return sum + ((parseFloat(subData.limit) || 0) * multiplier)
      }, 0);
    if (subLimitSum > 0 || Object.keys(catData?.subcategories || {}).length > 0) {
      return subLimitSum;
    }
    const mainDueDays = String(catData?.dueDate || '').split(',').map(d => d.trim()).filter(d => !isNaN(d) && d !== '')
    const mainMultiplier = mainDueDays.length > 0 ? mainDueDays.length : 1
    return (parseFloat(catData?.limit) || 0) * mainMultiplier;
  }

  const toggleCategory = (cat) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  const renderDueDate = (days) => {
    if (!days) return null
    const dayArray = String(days).split(',').map(d => d.trim()).filter(d => !isNaN(d) && d !== '')
    if (dayArray.length === 0) return null
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
    const s = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return s[(v - 20) % 10] || s[v] || s[0]
  }

  const getColor = (percent) => {
    if (percent === 0) return 'var(--primary)'
    if (percent < 80) return 'var(--success)'
    if (percent <= 100) return 'var(--warning)'
    return 'var(--danger)'
  }

  // ── Firestore write helpers ──────────────────────────────────────────────
  const handleSaveInlineSubcategory = async (e, cat) => {
    e.preventDefault()
    if (!user || !newSubName) return
    setIsSaving(true)
    const limit = parseFloat(newSubLimit) || 0
    try {
      await updateDoc(doc(db, 'budgets', `${householdId}-${selectedMonth}`), {
        [`${cat}.subcategories.${newSubName}`]: { limit, dueDate: newSubDue }
      })
      // Append to sub order
      const newSubOrder = [...(subOrders[cat] || []), newSubName]
      await saveSubOrder(cat, newSubOrder)
      setAddingSubcatTo(null)
      setNewSubName('')
      setNewSubLimit('')
      setNewSubDue('')
    } catch (err) {
      console.error(err)
      alert('Failed to save subcategory.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditCatSaveDirect = async (cat, limitVal, dueVal) => {
    if (!user) return
    try {
      await updateDoc(doc(db, 'budgets', `${householdId}-${selectedMonth}`), {
        [`${cat}.limit`]: parseFloat(limitVal) || 0,
        [`${cat}.dueDate`]: dueVal || ''
      })
    } catch (err) {
      console.error(err)
    }
  }

  const handleEditSubcatSaveDirect = async (cat, subName, limitVal, dueVal) => {
    if (!user) return
    const subcatData = { limit: parseFloat(limitVal) || 0, dueDate: dueVal || '' }
    try {
      await updateDoc(doc(db, 'budgets', `${householdId}-${selectedMonth}`), {
        [`${cat}.subcategories.${subName}`]: subcatData
      })
    } catch (err) {
      console.error(err)
    }
  }

  const handleEditCatSave = async (e, cat) => {
    e.preventDefault()
    if (!user) return
    setIsSaving(true)
    try {
      await updateDoc(doc(db, 'budgets', `${householdId}-${selectedMonth}`), {
        [`${cat}.limit`]: parseFloat(editLimit) || 0,
        [`${cat}.dueDate`]: editDue || ''
      })
      setEditingCat(null)
    } catch (err) {
      console.error(err)
      alert('Failed to save category edit.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditSubcatSave = async (e, cat) => {
    e.preventDefault()
    if (!user || !editName) return
    setIsSaving(true)
    const oldName = editingSubcat.oldName
    const subcatData = { limit: parseFloat(editLimit) || 0, dueDate: editDue || '' }
    try {
      const docRef = doc(db, 'budgets', `${householdId}-${selectedMonth}`)
      if (oldName !== editName) {
        await updateDoc(docRef, {
          [`${cat}.subcategories.${editName}`]: subcatData,
          [`${cat}.subcategories.${oldName}`]: deleteField()
        })
        // Rename in subOrder
        const newSubOrder = (subOrders[cat] || []).map(s => s === oldName ? editName : s)
        await saveSubOrder(cat, newSubOrder)
        // Rename in transactions
        try {
          const txSnap = await getDocs(
            query(collection(db, 'transactions'),
              where('householdId', '==', householdId),
              where('category', '==', cat),
              where('subcategory', '==', oldName)
            )
          )
          const ups = []
          txSnap.forEach(ds => { if (ds.data().date?.startsWith(selectedMonth)) ups.push(updateDoc(doc(db, 'transactions', ds.id), { subcategory: editName })) })
          if (ups.length) await Promise.all(ups)
        } catch (txErr) { console.error(txErr) }
      } else {
        await updateDoc(docRef, { [`${cat}.subcategories.${editName}`]: subcatData })
      }
      setEditingSubcat(null)
    } catch (err) {
      console.error(err)
      alert('Failed to save: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteSubcat = async (cat, subName) => {
    if (!user || !window.confirm(`Delete "${subName}"? This only removes the budget limit, not your transactions.`)) return
    setIsSaving(true)
    try {
      await updateDoc(doc(db, 'budgets', `${householdId}-${selectedMonth}`), {
        [`${cat}.subcategories.${subName}`]: deleteField()
      })
      // Remove from subOrder
      const newSubOrder = (subOrders[cat] || []).filter(s => s !== subName)
      await saveSubOrder(cat, newSubOrder)
      setEditingSubcat(null)
    } catch (err) {
      console.error(err)
      alert('Failed to delete subcategory.')
    } finally {
      setIsSaving(false)
    }
  }

  const startEditCat = (e, cat, catData) => {
    e.stopPropagation()
    setEditLimit(catData.limit || '')
    setEditDue(catData.dueDate || '')
    setEditingCat(cat)
  }

  const startEditSubcat = (e, cat, subName, subData) => {
    e.stopPropagation()
    setEditName(subName)
    setEditLimit(subData.limit || '')
    setEditDue(subData.dueDate || '')
    setEditingSubcat({ cat, oldName: subName })
  }

  const handleAddCategory = async (e) => {
    e.preventDefault()
    if (!user || !newCatName.trim()) return
    const name = newCatName.trim()
    if (budgets?.[name]) { alert('A category with that name already exists.'); return }
    setIsSaving(true)
    try {
      const docRef = doc(db, 'budgets', `${householdId}-${selectedMonth}`)
      await setDoc(docRef, {
        [`${name}`]: { limit: 0, dueDate: newCatDue || '', subcategories: {} }
      }, { merge: true })
      
      const newOrder = [...catOrder, name]
      await saveCatOrder(newOrder)
      setAddingNewCat(false)
      setNewCatName('')
      setNewCatDue('')
    } catch (err) {
      console.error(err)
      alert('Failed to add category.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteCategory = async (e, cat) => {
    e.stopPropagation()
    if (!user || !window.confirm(`Delete "${cat}"? Your transactions won't be affected.`)) return
    setIsSaving(true)
    try {
      await updateDoc(doc(db, 'budgets', `${householdId}-${selectedMonth}`), {
        [`${cat}`]: deleteField()
      })
      const newOrder = catOrder.filter(c => c !== cat)
      await saveCatOrder(newOrder)
    } catch (err) {
      console.error(err)
      alert('Failed to delete category.')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Calculate spending ───────────────────────────────────────────────────
  const categorySpent = {}
  customCategories.forEach(cat => {
    categorySpent[cat] = { total: 0, subs: {} }
  })

  transactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      // Parse transaction date day
      const txDay = t.date ? new Date(t.date).getDate() : 1;

      if (t.splits?.length > 0) {
        t.splits.forEach(split => {
          const splitCat = split.category || t.category;
          const amt = parseFloat(split.amount) || 0;
          if (categorySpent[splitCat]) {
            categorySpent[splitCat].total += amt;
            if (split.subcategory) {
              if (!categorySpent[splitCat].subs[split.subcategory]) {
                categorySpent[splitCat].subs[split.subcategory] = [];
              }
              categorySpent[splitCat].subs[split.subcategory].push({ amount: amt, day: txDay });
            }
          }
        });
      } else {
        const amt = parseFloat(t.amount) || 0;
        const cat = t.category;
        if (categorySpent[cat]) {
          categorySpent[cat].total += amt;
          if (t.subcategory) {
            if (!categorySpent[cat].subs[t.subcategory]) {
              categorySpent[cat].subs[t.subcategory] = [];
            }
            categorySpent[cat].subs[t.subcategory].push({ amount: amt, day: txDay });
          }
        }
      }
    })

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0 }}>Budgets</h3>
        <button
          className="btn btn-ghost"
          onClick={handleCopyPreviousMonth}
          disabled={isCopying}
          style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)', padding: '6px 10px' }}
          title="Copy budget setup from previous month"
        >
          <Copy size={14} /> {isCopying ? 'Copying...' : 'Copy Previous Month'}
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={typeSafeCollision}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={catOrder} strategy={verticalListSortingStrategy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {catOrder.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 16px', color: 'var(--text-secondary)', background: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem' }}>
                No categories yet — add one below or copy from last month.
              </div>
            )}
            {catOrder.map(cat => {
              const catData = budgets?.[cat] ?? { limit: 0, dueDate: '', subcategories: {} }
              const spent = categorySpent[cat]?.total || 0
              const subcategories = catData.subcategories || {}
              const limit = calculateCatLimit(catData)
              const percent = limit > 0 ? (spent / limit) * 100 : (spent > 0 ? 101 : 0)
              const progressPercent = Math.min(100, percent)
              const color = getColor(percent)
              const isExpanded = expandedCategories[cat]

              // Ordered subs for this category
              const orderedSubs = subOrders[cat] || []
              // Also include any subs that have spending but aren't in budgets yet
              const spentSubs = Object.keys(categorySpent[cat]?.subs || {})
              const allSubs = [...new Set([...orderedSubs, ...spentSubs])].filter(s => s !== '_order')

              return (
                <SortableCategoryRow key={cat} id={cat}>
                  {({ dragHandleProps }) => (
                    <div style={{ background: 'var(--bg-base)', borderRadius: '10px', border: '1px solid var(--border)', overflow: 'hidden' }}>

                      {/* ── Category Header ─── */}
                      <div
                        onClick={() => { if (editingCat !== cat) toggleCategory(cat) }}
                        style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', cursor: editingCat === cat ? 'default' : 'pointer', transition: 'background-color 0.2s', position: 'relative' }}
                        onMouseEnter={e => { if (editingCat !== cat) e.currentTarget.style.backgroundColor = 'var(--bg-surface)' }}
                        onMouseLeave={e => { if (editingCat !== cat) e.currentTarget.style.backgroundColor = 'transparent' }}
                      >
                        {editingCat === cat ? (
                          <form onSubmit={(e) => handleEditCatSave(e, cat)} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <span style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Editing: {cat}</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input type="number" placeholder="Amount" min="0" step="0.01" value={editLimit} onChange={e => setEditLimit(e.target.value)}
                                onBlur={() => handleEditCatSaveDirect(cat, editLimit, editDue)}
                                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '1rem' }} inputMode="decimal" />
                              <CalendarDayPicker 
                                value={editDue} 
                                onChange={(val) => {
                                  setEditDue(val);
                                  handleEditCatSaveDirect(cat, editLimit, val);
                                }} 
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button type="button" className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); setEditingCat(null) }} style={{ flex: 1 }}>Done</button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                                {/* Drag handle */}
                                <button
                                  {...dragHandleProps}
                                  onClick={e => e.stopPropagation()}
                                  style={{ cursor: 'grab', color: 'var(--text-secondary)', background: 'none', border: 'none', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0, touchAction: 'none' }}
                                  title="Drag to reorder"
                                >
                                  <GripVertical size={16} />
                                </button>

                                {/* Expand chevron */}
                                <div style={{ flexShrink: 0, color: 'var(--text-secondary)' }}>
                                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: '600', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                    <span style={{ flexShrink: 0 }}>{cat}</span>
                                    <button
                                      className="btn btn-ghost btn-icon"
                                      onClick={(e) => startEditCat(e, cat, catData)}
                                      style={{ padding: '3px', color: 'var(--text-secondary)', opacity: 0.6 }}
                                      title="Edit due date"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                    <button
                                      className="btn btn-ghost btn-icon"
                                      onClick={(e) => handleDeleteCategory(e, cat)}
                                      style={{ padding: '3px', color: 'var(--danger)', opacity: 0.6 }}
                                      title="Delete category"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                  {renderDueDate(catData.dueDate)}
                                </div>
                              </div>

                              <span style={{ fontWeight: '500', fontSize: '0.9rem', flexShrink: 0, marginLeft: '8px', textAlign: 'right' }}>
                                {spent > 0 ? (
                                  <>
                                    <span style={{ color }}>${spent.toFixed(2)}</span>
                                    <span style={{ color: 'var(--text-secondary)', margin: '0 3px' }}>/</span>
                                    <span style={{ color: 'var(--text-primary)' }}>${limit.toFixed(2)}</span>
                                  </>
                                ) : (
                                  <span style={{ color: 'var(--text-primary)' }}>${limit.toFixed(2)} budgeted</span>
                                )}
                              </span>
                            </div>

                            {/* Progress bar */}
                            <div style={{ height: '7px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${progressPercent}%`, background: color, transition: 'width 0.3s ease, background-color 0.3s ease' }} />
                            </div>
                          </>
                        )}
                      </div>

                      {/* ── Expanded Subcategories ─── */}
                      {isExpanded && (
                        <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)', padding: '12px 16px 14px 16px' }}>
                          {allSubs.length === 0 && addingSubcatTo !== cat && (
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic', marginBottom: '10px' }}>
                              No subcategories yet. Add one below.
                            </div>
                          )}

                          {(() => {
                             const sortableItems = [];
                             allSubs.forEach(sub => {
                               const subData = typeof subcategories[sub] === 'object' ? subcategories[sub] : { limit: subcategories[sub] || 0, dueDate: '' };
                               const subDueDays = String(subData.dueDate || '').split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d) && d >= 1 && d <= 31);
                               const sortedDays = [...subDueDays].sort((a, b) => a - b);
                               if (sortedDays.length > 1) {
                                 sortedDays.forEach(day => sortableItems.push(`${cat}::${sub}::${day}`));
                               } else {
                                 sortableItems.push(`${cat}::${sub}`);
                               }
                             });

                             return (
                               <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
                                 <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                   {(() => {
                                     const renderedElements = [];
                                     
                                     allSubs.forEach(sub => {
                                       const subData = typeof subcategories[sub] === 'object'
                                         ? subcategories[sub]
                                         : { limit: subcategories[sub] || 0, dueDate: '' }
                                       
                                       const subDueDays = String(subData.dueDate || '')
                                         .split(',')
                                         .map(d => parseInt(d.trim()))
                                         .filter(d => !isNaN(d) && d >= 1 && d <= 31);
                                       
                                       const sortedDays = [...subDueDays].sort((a, b) => a - b);
                                       
                                       const instances = sortedDays.length > 1
                                         ? sortedDays.map(day => ({ subName: sub, day, isSplitInstance: true }))
                                         : [{ subName: sub, day: sortedDays[0] || null, isSplitInstance: false }];
                                       
                                       instances.forEach((inst, instIdx) => {
                                         const displaySubName = inst.isSplitInstance ? `${sub} (${inst.day}${getOrdinal(inst.day)})` : sub;
                                         const subSpent = getSubInstanceSpent(categorySpent[cat]?.subs[sub], sortedDays, inst.day);
                                         const subLimit = parseFloat(subData.limit) || 0;
                                         const subPercentRaw = subLimit > 0 ? (subSpent / subLimit) * 100 : (subSpent > 0 ? 101 : 0)
                                         const subColor = getColor(subPercentRaw)
                                         
                                         const sortableId = inst.isSplitInstance ? `${cat}::${sub}::${inst.day}` : `${cat}::${sub}`;
                                         
                                         renderedElements.push(
                                           <SortableSubRow key={sortableId} id={sortableId} cat={cat}>
                                             {({ dragHandleProps: subDragProps }) => (
                                               <div>
                                                 {editingSubcat?.cat === cat && editingSubcat?.oldName === sub ? (
                                                   <form onSubmit={(e) => handleEditSubcatSave(e, cat)} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', background: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                                     <span style={{ fontWeight: '600', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Editing: {sub}</span>
                                                     <input type="text" required value={editName} onChange={e => setEditName(e.target.value)}
                                                       style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '0.95rem', boxSizing: 'border-box' }}
                                                       placeholder="Subcategory name" />
                                                     <div style={{ display: 'flex', gap: '8px' }}>
                                                       <input type="number" placeholder="Amount" min="0" step="0.01" value={editLimit} onChange={e => setEditLimit(e.target.value)}
                                                         onBlur={() => handleEditSubcatSaveDirect(cat, editName, editLimit, editDue)}
                                                         style={{ flex: 1, padding: '9px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '0.95rem' }} inputMode="decimal" />
                                                       <CalendarDayPicker 
                                                         value={editDue} 
                                                         onChange={(val) => {
                                                           setEditDue(val);
                                                           handleEditSubcatSaveDirect(cat, editName, editLimit, val);
                                                         }} 
                                                       />
                                                     </div>
                                                     <div style={{ display: 'flex', gap: '8px' }}>
                                                       <button type="button" className="btn btn-ghost" onClick={() => setEditingSubcat(null)} style={{ flex: 1 }}>Done</button>
                                                     </div>
                                                     <button type="button" className="btn btn-ghost" onClick={() => handleDeleteSubcat(cat, sub)}
                                                       style={{ color: 'var(--danger)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                       <Trash2 size={12} /> Delete Subcategory
                                                     </button>
                                                   </form>
                                                 ) : (
                                                   <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                     <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                       {/* Sub drag handle */}
                                                       <button
                                                         {...subDragProps}
                                                         onClick={e => e.stopPropagation()}
                                                         style={{ cursor: 'grab', color: 'var(--text-secondary)', background: 'none', border: 'none', padding: '2px', display: 'flex', alignItems: 'center', opacity: 0.5, flexShrink: 0, touchAction: 'none' }}
                                                         title="Drag to reorder"
                                                       >
                                                         <GripVertical size={14} />
                                                       </button>

                                                       <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: '500' }}>{displaySubName}</span>

                                                       <span style={{ fontSize: '0.85rem', fontWeight: '500', flexShrink: 0 }}>
                                                         <span style={{ color: subColor }}>${subSpent.toFixed(2)}</span>
                                                         <span style={{ color: 'var(--text-secondary)', margin: '0 3px' }}>/</span>
                                                         <span style={{ color: 'var(--text-primary)' }}>${subLimit.toFixed(2)}</span>
                                                       </span>

                                                       <button className="btn btn-ghost btn-icon" onClick={(e) => startEditSubcat(e, cat, sub, subData)}
                                                         style={{ padding: '3px', color: 'var(--text-secondary)', flexShrink: 0 }} title="Edit">
                                                         <Pencil size={12} />
                                                       </button>
                                                     </div>

                                                     {renderDueDate(inst.day)}

                                                     <div style={{ height: '5px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                                                       <div style={{ height: '100%', width: `${Math.min(100, subPercentRaw)}%`, background: subColor, transition: 'width 0.3s ease' }} />
                                                     </div>
                                                   </div>
                                                 )}
                                               </div>
                                             )}
                                           </SortableSubRow>
                                         );
                                       });
                                     });
                                     return renderedElements;
                                   })()}
                                 </div>
                               </SortableContext>
                             );
                           })()}

                          {/* Add Subcategory */}
                          {addingSubcatTo === cat ? (
                            <form onSubmit={(e) => handleSaveInlineSubcategory(e, cat)}
                              style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', padding: '12px', background: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                              <span style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>New Subcategory</span>
                              <input type="text" placeholder="Subcategory name" required autoFocus value={newSubName} onChange={e => setNewSubName(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '1rem', boxSizing: 'border-box' }} />
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <input type="number" placeholder="Budget amount" min="0" step="0.01" value={newSubLimit} onChange={e => setNewSubLimit(e.target.value)}
                                  style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '1rem' }} inputMode="decimal" />
                                <CalendarDayPicker 
                                  value={newSubDue} 
                                  onChange={setNewSubDue} 
                                />
                              </div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => { setAddingSubcatTo(null); setNewSubName(''); setNewSubLimit(''); setNewSubDue('') }} style={{ flex: 1 }}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                  <Save size={14} /> {isSaving ? 'Saving...' : 'Save Subcategory'}
                                </button>
                              </div>
                            </form>
                          ) : (
                            <button className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); setAddingSubcatTo(cat); setNewSubName(''); setNewSubLimit(''); setNewSubDue('') }}
                              style={{ marginTop: '10px', padding: '7px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Plus size={14} /> Add Subcategory
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </SortableCategoryRow>
              )
            })}
          </div>

          {/* ── Add Category Form ─── */}
          {addingNewCat ? (
            <form onSubmit={handleAddCategory}
              style={{ marginTop: '4px', padding: '14px', background: 'var(--bg-base)', borderRadius: '10px', border: '1px solid var(--primary)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>New Category</span>
              <input
                type="text"
                placeholder="Category name (e.g. Housing)"
                required
                autoFocus
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '1rem', boxSizing: 'border-box' }}
              />
              <CalendarDayPicker 
                value={newCatDue} 
                onChange={setNewCatDue} 
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => { setAddingNewCat(false); setNewCatName(''); setNewCatDue('') }} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Save size={14} /> {isSaving ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </form>
          ) : (
            <button
              className="btn btn-ghost"
              onClick={() => { setAddingNewCat(true); setNewCatName(''); setNewCatDue('') }}
              style={{ marginTop: '4px', width: '100%', padding: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', fontSize: '0.9rem', border: '1px dashed var(--border)', borderRadius: '10px' }}
            >
              <Plus size={16} /> Add Category
            </button>
          )}
        </SortableContext>

        {/* Drag overlay for visual feedback */}
        <DragOverlay>
          {activeDragId && activeDragType === 'cat' && (
            <div style={{ background: 'var(--bg-surface)', borderRadius: '10px', border: '2px solid var(--primary)', padding: '14px 16px', fontWeight: '600', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', opacity: 0.95 }}>
              {activeDragId}
            </div>
          )}
          {activeDragId && activeDragType === 'sub' && (
            <div style={{ background: 'var(--bg-base)', borderRadius: '8px', border: '2px solid var(--primary)', padding: '10px 14px', fontSize: '0.9rem', fontWeight: '500', boxShadow: '0 6px 20px rgba(0,0,0,0.25)', opacity: 0.95 }}>
              {activeDragId.replace(`${activeDragCat}::`, '')}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

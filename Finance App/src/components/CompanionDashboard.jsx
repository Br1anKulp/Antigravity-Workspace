import { useState, useMemo } from 'react';
import { ArrowLeft, AlertCircle, CheckCircle, ShieldAlert, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';

// Calculate budget limits for each category based on period pacing rules
const getPeriodSubLimit = (subData, period) => {
  const isObj = typeof subData === 'object' && subData !== null;
  const rawLimit = isObj ? subData.limit : subData;
  const dueDate = isObj ? subData.dueDate : '';
  
  const dueDays = String(dueDate || '')
    .split(',')
    .map(d => parseInt(d.trim(), 10))
    .filter(d => !isNaN(d) && d >= 1 && d <= 31);
    
  if (period === 'month') {
    if (typeof rawLimit === 'object' && rawLimit !== null) {
      return Object.values(rawLimit).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
    }
    const mult = dueDays.length > 0 ? dueDays.length : 1;
    return (parseFloat(rawLimit) || 0) * mult;
  }

  if (period === 'paycheck1') {
    if (dueDays.length > 0) {
      const p1Days = dueDays.filter(d => d <= 14);
      if (p1Days.length === 0) return 0;
      if (typeof rawLimit === 'object' && rawLimit !== null) {
        return p1Days.reduce((sum, d) => sum + (parseFloat(rawLimit[d]) || 0), 0);
      }
      return (parseFloat(rawLimit) || 0) * p1Days.length;
    }
    return (parseFloat(rawLimit) || 0) / 2; // Pacing: 50% allocation
  } else {
    if (dueDays.length > 0) {
      const p2Days = dueDays.filter(d => d >= 15);
      if (p2Days.length === 0) return 0;
      if (typeof rawLimit === 'object' && rawLimit !== null) {
        return p2Days.reduce((sum, d) => sum + (parseFloat(rawLimit[d]) || 0), 0);
      }
      return (parseFloat(rawLimit) || 0) * p2Days.length;
    }
    return (parseFloat(rawLimit) || 0) / 2; // Pacing: 50% allocation
  }
};

const getPeriodCatLimit = (catData, period) => {
  const subcategories = catData.subcategories || {};
  const subKeys = Object.keys(subcategories).filter(k => k !== '_order');
  if (subKeys.length > 0) {
    return subKeys.reduce((sum, key) => sum + getPeriodSubLimit(subcategories[key], period), 0);
  }
  
  const rawLimit = catData.limit;
  const dueDate = catData.dueDate || '';
  const dueDays = String(dueDate || '')
    .split(',')
    .map(d => parseInt(d.trim(), 10))
    .filter(d => !isNaN(d) && d >= 1 && d <= 31);
  
  if (period === 'month') {
    const mult = dueDays.length > 0 ? dueDays.length : 1;
    return (parseFloat(rawLimit) || 0) * mult;
  }

  if (period === 'paycheck1') {
    if (dueDays.length > 0) {
      const p1Days = dueDays.filter(d => d <= 14);
      return p1Days.length > 0 ? (parseFloat(rawLimit) || 0) * p1Days.length : 0;
    }
    return (parseFloat(rawLimit) || 0) / 2;
  } else {
    if (dueDays.length > 0) {
      const p2Days = dueDays.filter(d => d >= 15);
      return p2Days.length > 0 ? (parseFloat(rawLimit) || 0) * p2Days.length : 0;
    }
    return (parseFloat(rawLimit) || 0) / 2;
  }
};

const getOrdinal = (d) => {
  if (d > 3 && d < 21) return 'th';
  switch (d % 10) {
    case 1:  return "st";
    case 2:  return "nd";
    case 3:  return "rd";
    default: return "th";
  }
};

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

export default function CompanionDashboard({ transactions, budgets, customCategories, onExit }) {
  const today = new Date();
  const currentDay = today.getDate();
  const year = today.getFullYear();
  const month = today.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Default to Full Month view to match Main Dashboard
  const [period, setPeriod] = useState('month');
  
  // Toggle subcategories display state
  const [expandedCategories, setExpandedCategories] = useState({});

  const toggleCategory = (cat) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Time elapsed in the active view
  const timeElapsedPercent = useMemo(() => {
    if (period === 'month') {
      return Math.round((currentDay / totalDays) * 100);
    } else if (period === 'paycheck1') {
      const elapsed = Math.min(14, currentDay);
      return Math.round((elapsed / 14) * 100);
    } else {
      const elapsed = Math.max(0, currentDay - 14);
      const totalP2Days = totalDays - 14;
      return Math.round((Math.min(totalP2Days, elapsed) / totalP2Days) * 100);
    }
  }, [period, currentDay, totalDays]);

  // Helper labels
  const periodLabel = period === 'month' 
    ? 'Full Month' 
    : (period === 'paycheck1' ? '1st Paycheck (1st – 14th)' : '2nd Paycheck (15th – End)');

  // Calculate spent totals for the selected period
  const categorySpent = useMemo(() => {
    const spentObj = {};
    customCategories.forEach(cat => {
      spentObj[cat] = { total: 0, subs: {}, subItems: {} };
    });

    transactions
      .filter(t => t.type === 'expense' || t.type === 'refund')
      .filter(t => {
        if (period === 'month') return true;
        const txDay = t.date ? (parseInt((t.date.split('T')[0] || '').split('-')[2], 10) || 1) : 1;
        if (period === 'paycheck1') return txDay <= 14;
        return txDay >= 15;
      })
      .forEach(t => {
        const isRefund = t.type === 'refund';
        const txDay = t.date ? (parseInt((t.date.split('T')[0] || '').split('-')[2], 10) || 1) : 1;
        if (t.splits?.length > 0) {
          t.splits.forEach(split => {
            const splitCat = split.category || t.category;
            let amt = parseFloat(split.amount) || 0;
            if (isRefund) amt = -amt;
            if (spentObj[splitCat] !== undefined) {
              spentObj[splitCat].total += amt;
              if (split.subcategory) {
                if (!spentObj[splitCat].subs[split.subcategory]) {
                  spentObj[splitCat].subs[split.subcategory] = 0;
                  spentObj[splitCat].subItems[split.subcategory] = [];
                }
                spentObj[splitCat].subs[split.subcategory] += amt;
                spentObj[splitCat].subItems[split.subcategory].push({ amount: amt, day: txDay });
              }
            }
          });
        } else {
          let amt = parseFloat(t.amount) || 0;
          if (isRefund) amt = -amt;
          if (spentObj[t.category] !== undefined) {
            spentObj[t.category].total += amt;
            if (t.subcategory) {
              if (!spentObj[t.category].subs[t.subcategory]) {
                spentObj[t.category].subs[t.subcategory] = 0;
                spentObj[t.category].subItems[t.subcategory] = [];
              }
              spentObj[t.category].subs[t.subcategory] += amt;
              spentObj[t.category].subItems[t.subcategory].push({ amount: amt, day: txDay });
            }
          }
        }
      });
    return spentObj;
  }, [transactions, period, customCategories]);

  // Aggregate values
  const totalLimit = useMemo(() => {
    return customCategories.reduce((sum, cat) => {
      const catData = budgets?.[cat] ?? { limit: 0, subcategories: {} };
      return sum + getPeriodCatLimit(catData, period);
    }, 0);
  }, [budgets, customCategories, period]);

  const totalSpent = useMemo(() => {
    return Object.values(categorySpent).reduce((sum, val) => sum + val.total, 0);
  }, [categorySpent]);

  const totalRemaining = totalLimit - totalSpent;
  const isOverBudget = totalRemaining < 0;

  // Custom coloring/progress style
  const getProgressColor = (percent) => {
    if (percent >= 100) return 'var(--danger)';
    if (percent >= 85) return 'var(--warning)';
    return 'var(--success)';
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at top left, #1a1e36, #0e111a)',
      color: 'var(--text-primary)',
      padding: '24px',
      fontFamily: 'var(--font-body)',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px'
    }}>
      {/* Top Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            className="btn btn-ghost btn-icon" 
            onClick={onExit}
            style={{ color: 'var(--text-secondary)' }}
            title="Return to standard dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700', fontFamily: 'var(--font-heading)' }}>Pacing Dashboard</h2>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#fff', background: 'var(--primary)', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Sparkles size={10} /> Live Real-Time
              </span>
            </div>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Distraction-free real-time budget pacing</p>
          </div>
        </div>

        {/* Toggle Button Group */}
        <div className="companion-toggle-group" style={{ display: 'flex', gap: '8px', background: 'rgba(255, 255, 255, 0.03)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <button 
            className="btn"
            onClick={() => setPeriod('month')}
            style={{
              padding: '8px 14px',
              fontSize: '0.82rem',
              fontWeight: '600',
              borderRadius: '6px',
              border: 'none',
              background: period === 'month' ? 'var(--primary)' : 'transparent',
              color: period === 'month' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Full Month
          </button>
          <button 
            className="btn"
            onClick={() => setPeriod('paycheck1')}
            style={{
              padding: '8px 14px',
              fontSize: '0.82rem',
              fontWeight: '600',
              borderRadius: '6px',
              border: 'none',
              background: period === 'paycheck1' ? 'var(--primary)' : 'transparent',
              color: period === 'paycheck1' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            1st Paycheck
          </button>
          <button 
            className="btn"
            onClick={() => setPeriod('paycheck2')}
            style={{
              padding: '8px 14px',
              fontSize: '0.82rem',
              fontWeight: '600',
              borderRadius: '6px',
              border: 'none',
              background: period === 'paycheck2' ? 'var(--primary)' : 'transparent',
              color: period === 'paycheck2' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            2nd Paycheck
          </button>
        </div>
      </div>

      {/* Main Stats Card */}
      <div className="glass-panel companion-main-card" style={{
        padding: '30px',
        background: isOverBudget 
          ? 'radial-gradient(circle at top right, rgba(239, 68, 68, 0.08), rgba(255, 255, 255, 0.02))' 
          : 'radial-gradient(circle at top right, rgba(16, 185, 129, 0.08), rgba(255, 255, 255, 0.02))',
        border: isOverBudget ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <span style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {periodLabel} Balance
            </span>
            <h1 className="companion-balance-display" style={{
              fontSize: '3rem',
              margin: '8px 0 0 0',
              fontWeight: '800',
              color: isOverBudget ? 'var(--danger)' : 'var(--success)',
              letterSpacing: '-1px'
            }}>
              ${totalRemaining.toFixed(2)}
              <span className="companion-balance-suffix" style={{ fontSize: '1.2rem', fontWeight: '500', marginLeft: '8px', color: 'var(--text-secondary)' }}>
                {isOverBudget ? 'over spent' : 'remaining'}
              </span>
            </h1>
          </div>

          {/* Icon Badge */}
          <div style={{
            background: isOverBudget ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            padding: '16px',
            borderRadius: '12px',
            color: isOverBudget ? 'var(--danger)' : 'var(--success)',
            border: '1px solid currentColor'
          }}>
            {isOverBudget ? <ShieldAlert size={28} /> : <CheckCircle size={28} />}
          </div>
        </div>

        {/* Window Pacing Progress */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            <span>Time elapsed ({periodLabel})</span>
            <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{timeElapsedPercent}%</span>
          </div>
          <div style={{ height: '6px', background: 'var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, timeElapsedPercent)}%`,
              background: 'var(--primary)',
              borderRadius: '10px'
            }} />
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginTop: '6px' }}>
            Day {currentDay} of {totalDays} in current month
          </span>
        </div>
      </div>

      {/* Grid of details */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '20px' }}>
        <div className="glass-panel companion-stats-card" style={{ padding: '20px', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Period Limit</span>
          <h3 style={{ margin: '4px 0 0 0', fontSize: '1.6rem', fontWeight: '700' }}>${totalLimit.toFixed(2)}</h3>
        </div>
        <div className="glass-panel companion-stats-card" style={{ padding: '20px', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Period Spent</span>
          <h3 style={{ margin: '4px 0 0 0', fontSize: '1.6rem', fontWeight: '700', color: isOverBudget ? 'var(--danger)' : 'inherit' }}>${totalSpent.toFixed(2)}</h3>
        </div>
      </div>

      {/* Category Balances Section */}
      <div style={{ marginTop: '10px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: '700', fontFamily: 'var(--font-heading)', letterSpacing: '0.5px' }}>
          Category Balances ({periodLabel})
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {customCategories.map(cat => {
            const catData = budgets?.[cat] ?? { limit: 0, subcategories: {} };
            const limit = getPeriodCatLimit(catData, period);
            const spent = categorySpent[cat]?.total || 0;
            const remaining = limit - spent;
            const percent = limit > 0 ? (spent / limit) * 100 : (spent > 0 ? 101 : 0);
            const color = getProgressColor(percent);
            const isExpanded = !!expandedCategories[cat];

            const subcategories = catData.subcategories || {};
            const subKeys = Object.keys(subcategories).filter(k => k !== '_order');
            
            const subInstances = [];
            subKeys.forEach(subName => {
              const subVal = subcategories[subName];
              const subData = typeof subVal === 'object' ? subVal : { limit: subVal || 0, dueDate: '' };
              
              const dueDays = String(subData.dueDate || '')
                .split(',')
                .map(d => parseInt(d.trim(), 10))
                .filter(d => !isNaN(d) && d >= 1 && d <= 31);
                
              const sortedDays = [...dueDays].sort((a, b) => a - b);
              const instances = sortedDays.length > 1
                ? sortedDays.map(day => ({ subName, day, isSplitInstance: true }))
                : [{ subName, day: sortedDays[0] || null, isSplitInstance: false }];
                
              instances.forEach(inst => {
                if (period === 'paycheck1' && inst.day !== null && inst.day > 14) return;
                if (period === 'paycheck2' && inst.day !== null && inst.day < 15) return;
                
                const getSubLimitVal = () => {
                  if (typeof subData.limit === 'object' && subData.limit !== null) {
                    if (period === 'month') {
                      return inst.isSplitInstance && inst.day !== null && subData.limit[inst.day] !== undefined
                        ? (parseFloat(subData.limit[inst.day]) || 0)
                        : Object.values(subData.limit).reduce((s, v) => s + (parseFloat(v) || 0), 0);
                    }
                    return (inst.day !== null && subData.limit[inst.day] !== undefined)
                      ? (parseFloat(subData.limit[inst.day]) || 0)
                      : 0;
                  }
                  const baseVal = parseFloat(subData.limit) || 0;
                  if (period === 'month') {
                    return inst.isSplitInstance ? baseVal : baseVal * (dueDays.length > 0 ? dueDays.length : 1);
                  }
                  return inst.day !== null ? baseVal : baseVal / 2;
                };
                const subLimit = getSubLimitVal();
                
                const subSpent = inst.isSplitInstance
                  ? getSubInstanceSpent(categorySpent[cat]?.subItems?.[subName], sortedDays, inst.day)
                  : (categorySpent[cat]?.subs[subName] || 0);
                const subRemaining = subLimit - subSpent;
                const subPercent = subLimit > 0 ? (subSpent / subLimit) * 100 : (subSpent > 0 ? 101 : 0);
                const subColor = getProgressColor(subPercent);
                const displayName = inst.isSplitInstance ? `${subName} (${inst.day}${getOrdinal(inst.day)})` : subName;

                subInstances.push({
                  name: displayName,
                  limit: subLimit,
                  spent: subSpent,
                  remaining: subRemaining,
                  percent: subPercent,
                  color: subColor
                });
              });
            });

            return (
              <div key={cat} className="glass-panel" style={{
                borderRadius: '12px',
                border: remaining < 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border)',
                animation: remaining < 0 ? 'pulseGlow 2s infinite' : 'none',
                overflow: 'hidden'
              }}>
                {/* Category Main Row */}
                <div 
                  onClick={() => toggleCategory(cat)}
                  style={{
                    padding: '20px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </span>
                      <span style={{ fontWeight: '700', fontSize: '1rem' }}>{cat}</span>
                      {remaining < 0 && (
                        <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: '600' }}>
                          <AlertCircle size={12} /> Over Limit
                        </span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        fontWeight: '700',
                        fontSize: '0.92rem',
                        color: remaining >= 0 ? 'var(--text-primary)' : 'var(--danger)'
                      }}>
                        {remaining >= 0 ? `$${remaining.toFixed(2)} left` : `$${Math.abs(remaining).toFixed(2)} over`}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                        ${spent.toFixed(2)} spent of ${limit.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div style={{ height: '8px', background: 'var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, percent)}%`,
                      background: color,
                      borderRadius: '10px'
                    }} />
                  </div>
                </div>

                {/* Subcategories Dropdown Area */}
                {isExpanded && subInstances.length > 0 && (
                  <div className="companion-sub-list" style={{
                    background: 'var(--bg-surface)',
                    borderTop: '1px solid var(--border)',
                    padding: '12px 20px 20px 42px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                  }}>
                    {subInstances.map((sub, sIdx) => (
                      <div key={sIdx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                          <span style={{ fontWeight: '500' }}>{sub.name}</span>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{
                              fontWeight: '600',
                              fontSize: '0.85rem',
                              color: sub.remaining >= 0 ? 'var(--text-primary)' : 'var(--danger)'
                            }}>
                              {sub.remaining >= 0 ? `$${sub.remaining.toFixed(2)} left` : `$${Math.abs(sub.remaining).toFixed(2)} over`}
                            </span>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '1px' }}>
                              ${sub.spent.toFixed(2)} / ${sub.limit.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div style={{ height: '6px', background: 'var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(100, sub.percent)}%`,
                            background: sub.color,
                            borderRadius: '10px'
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.15); }
          70% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>
    </div>
  );
}

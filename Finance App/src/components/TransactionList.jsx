import React, { useState } from 'react'
import { ArrowUpRight, ArrowDownRight, Tag, Calendar, Search, Filter, Trash2, Pencil, Download, CreditCard, Clock, List, LayoutGrid } from 'lucide-react'
import CalendarView from './CalendarView'

export default function TransactionList({ transactions, onDelete, onEditRequest, categories = [], selectedMonth }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [viewMode, setViewMode] = useState('list')

  if (transactions.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', marginTop: '24px' }}>
        <p style={{ color: 'var(--text-secondary)' }}>No transactions yet. Add one to get started!</p>
      </div>
    )
  }

  const filterCategories = ['All', ...categories]

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (t.subcategory && t.subcategory.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (t.splits && t.splits.some(s => s.subcategory && s.subcategory.toLowerCase().includes(searchTerm.toLowerCase())))
    const matchesCategory = categoryFilter === 'All' || t.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) return;
    
    const headers = ['Date', 'Title', 'Amount', 'Type', 'Category', 'Subcategory', 'User'];
    const rows = filteredTransactions.map(t => [
      new Date(t.date).toLocaleDateString(),
      `"${t.title.replace(/"/g, '""')}"`,
      t.amount,
      t.type,
      `"${t.category}"`,
      `"${t.subcategory || ''}"`,
      `"${t.user || ''}"`
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `flow_transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="glass-panel" style={{ marginTop: '24px', overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Recent Transactions</h3>
        
        <div style={{ display: 'flex', gap: '12px', flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
          <div style={{ position: 'relative', maxWidth: '200px', width: '100%' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              placeholder="Search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
            />
          </div>
          
          <div style={{ position: 'relative' }}>
            <Filter size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <select 
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              style={{ padding: '8px 12px 8px 36px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', appearance: 'none', cursor: 'pointer' }}
            >
              {filterCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          
          <button 
            className="btn btn-ghost btn-icon" 
            onClick={handleExportCSV}
            title="Export to CSV"
            style={{ color: 'var(--primary)' }}
          >
            <Download size={18} />
          </button>
          
          <div style={{ display: 'flex', background: 'var(--bg-base)', borderRadius: '8px', padding: '4px' }}>
            <button 
              className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              onClick={() => setViewMode('list')}
            >
              <List size={16} />
            </button>
            <button 
              className={`btn ${viewMode === 'calendar' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              onClick={() => setViewMode('calendar')}
            >
              <Calendar size={16} />
            </button>
          </div>
        </div>
      </div>
      
      {viewMode === 'calendar' ? (
        <div style={{ padding: '0 24px 24px' }}>
          <CalendarView transactions={filteredTransactions} selectedMonth={selectedMonth} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
        {filteredTransactions.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No transactions found.</div>
        ) : filteredTransactions.map(t => (
          <div key={t.id} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            padding: '16px 24px',
            borderBottom: '1px solid var(--border)',
            transition: 'background-color 0.2s',
            position: 'relative'
          }}
          onMouseOver={e => {
            e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
            const actions = e.currentTarget.querySelector('.tx-actions');
            if (actions) actions.style.opacity = '1';
          }}
          onMouseOut={e => {
            e.currentTarget.style.backgroundColor = 'transparent';
            const actions = e.currentTarget.querySelector('.tx-actions');
            if (actions) actions.style.opacity = '0';
          }}
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
              
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '500' }}>
                    {t.title}
                    {t.isRecurring && <span style={{ fontSize: '0.8rem', background: 'var(--primary-bg)', color: 'var(--primary)', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>↺</span>}
                  </h4>
                  {t.status === 'unpaid' && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 6px', borderRadius: '12px', fontSize: '0.7rem', background: 'var(--warning)', color: '#000', fontWeight: '600' }}>
                      <Clock size={10} /> Unpaid
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Tag size={12} /> {t.category} 
                    {t.splits && t.splits.length > 0 ? (
                      <span style={{ fontStyle: 'italic', opacity: 0.9 }}>
                        {` > Split: `}
                        {t.splits.map(s => `${s.subcategory} ($${parseFloat(s.amount).toFixed(2)})`).join(', ')}
                      </span>
                    ) : (
                      t.subcategory && ` > ${t.subcategory}`
                    )}
                  </span>
                  {t.paymentMethod && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CreditCard size={12} /> {t.paymentMethod}
                    </span>
                  )}
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={12} /> {new Date(t.date).toLocaleDateString()}
                  </span>
                  {t.user && <span>• By {t.user.split('@')[0]}</span>}
                </div>
                {t.notes && (
                  <div style={{ marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', paddingLeft: '8px', borderLeft: '2px solid var(--border)' }}>
                    {t.notes}
                  </div>
                )}
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ 
                fontWeight: '600', 
                fontSize: '1.1rem',
                color: t.type === 'income' ? 'var(--success)' : 'var(--text-primary)'
              }}>
                {t.type === 'income' ? '+' : '-'}${parseFloat(t.amount).toFixed(2)}
              </div>
              
              <div className="tx-actions" style={{ display: 'flex', gap: '8px', opacity: 0, transition: 'opacity 0.2s' }}>
                <button 
                  className="btn btn-ghost btn-icon" 
                  onClick={() => onEditRequest && onEditRequest(t)}
                  style={{ padding: '6px', color: 'var(--text-secondary)' }}
                  title="Edit Transaction"
                >
                  <Pencil size={16} />
                </button>
                <button 
                  className="btn btn-ghost btn-icon" 
                  onClick={() => onDelete && onDelete(t.id)}
                  style={{ padding: '6px', color: 'var(--danger)' }}
                  title="Delete Transaction"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  )
}

import React from 'react';
import { ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';

export default function CalendarView({ transactions, selectedMonth }) {
  const [year, month] = selectedMonth.split('-').map(Number);
  
  // Calculate days in month and first day of month
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0 = Sunday
  
  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const getDayTransactions = (day) => {
    if (!day) return [];
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return transactions.filter(t => t.date.startsWith(dateStr));
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div style={{ marginTop: '16px', overflowX: 'auto' }}>
      <div style={{ minWidth: '600px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '8px' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontWeight: '600', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {d}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
          {days.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} style={{ minHeight: '100px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }} />;
            
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayTxs = getDayTransactions(day);
            const isToday = dateStr === todayStr;

            return (
              <div key={`day-${day}`} style={{ 
                minHeight: '100px', 
                background: isToday ? 'var(--bg-surface)' : 'var(--bg-base)', 
                border: isToday ? '1px solid var(--primary)' : '1px solid var(--border)',
                borderRadius: '8px',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{ 
                  fontWeight: isToday ? '700' : '500', 
                  color: isToday ? 'var(--primary)' : 'var(--text-secondary)',
                  marginBottom: '8px',
                  fontSize: '0.9rem'
                }}>
                  {day}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {dayTxs.map(t => {
                    let color = 'var(--text-primary)';
                    let icon = null;
                    
                    if (t.type === 'income') {
                      color = 'var(--success)';
                      icon = <ArrowUpRight size={10} />;
                    } else if (t.status === 'unpaid') {
                      color = 'var(--warning)';
                      icon = <Clock size={10} />;
                    } else {
                      color = 'var(--text-secondary)';
                      icon = <ArrowDownRight size={10} />;
                    }

                    return (
                      <div key={t.id} style={{ 
                        fontSize: '0.7rem', 
                        padding: '4px',
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: color,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }} title={`${t.title}: $${t.amount}`}>
                        {icon}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
}

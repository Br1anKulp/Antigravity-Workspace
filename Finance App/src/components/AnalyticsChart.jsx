import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function AnalyticsChart({ transactions }) {
  const data = useMemo(() => {
    const categoryTotals = {};
    
    // Initialize with 0 to maintain consistent color mapping, or just build dynamically
    transactions.forEach(t => {
      if (t.type === 'expense') {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + parseFloat(t.amount);
      }
    });

    return Object.entries(categoryTotals)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value); // Sort by largest expense
  }, [transactions]);

  // A sleek color palette for the donut chart
  const COLORS = [
    'hsl(220, 85%, 65%)', // Blue
    'hsl(340, 85%, 65%)', // Pink/Red
    'hsl(280, 85%, 65%)', // Purple
    'hsl(40, 95%, 60%)',  // Yellow
    'hsl(150, 70%, 50%)', // Green
    'hsl(20, 90%, 65%)',  // Orange
    'hsl(180, 80%, 50%)', // Cyan
    'hsl(300, 70%, 60%)', // Magenta
    'hsl(250, 70%, 60%)', // Indigo
  ];

  if (data.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <p style={{ color: 'var(--text-secondary)' }}>No expense data for this month to chart yet.</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: '8px', boxShadow: 'var(--shadow-md)' }}>
          <p style={{ margin: 0, fontWeight: '600', color: 'var(--text-primary)' }}>{payload[0].name}</p>
          <p style={{ margin: 0, color: payload[0].payload.fill }}>${payload[0].value.toFixed(2)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-panel" style={{ padding: '24px', minHeight: '340px' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>Spending Breakdown</h3>
      <div style={{ width: '100%', height: '280px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={100}
              paddingAngle={4}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              verticalAlign="bottom" 
              height={36} 
              iconType="circle"
              wrapperStyle={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

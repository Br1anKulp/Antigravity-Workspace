import React, { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Sector
} from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, Award } from 'lucide-react'

const CATEGORY_COLORS = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#84cc16'
]

const formatCurrency = (v) => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: '8px', padding: '12px', fontSize: '0.85rem'
    }}>
      <p style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>{label}</p>
      {payload.map((entry, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: entry.fill }} />
          <span>{entry.name}:</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Insights({ transactions, budgets, customCategories }) {
  // Build last 6 months
  const last6Months = useMemo(() => {
    const months = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleString('default', { month: 'short', year: '2-digit' })
      months.push({ key, label })
    }
    return months
  }, [])

  // Bar chart data — spending per category per month
  const barData = useMemo(() => {
    return last6Months.map(({ key, label }) => {
      const row = { month: label }
      customCategories.forEach(cat => {
        const spent = transactions
          .filter(t => t.type === 'expense' && t.category === cat && t.date?.startsWith(key))
          .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
        if (spent > 0) row[cat] = parseFloat(spent.toFixed(2))
      })
      return row
    })
  }, [transactions, customCategories, last6Months])

  // Current month for pie chart
  const currentMonthKey = last6Months[last6Months.length - 1].key
  const currentMonthLabel = last6Months[last6Months.length - 1].label

  const pieData = useMemo(() => {
    return customCategories
      .map(cat => ({
        name: cat,
        value: parseFloat(
          transactions
            .filter(t => t.type === 'expense' && t.category === cat && t.date?.startsWith(currentMonthKey))
            .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
            .toFixed(2)
        )
      }))
      .filter(d => d.value > 0)
  }, [transactions, customCategories, currentMonthKey])

  // Summary stats
  const stats = useMemo(() => {
    const currMonthExpenses = transactions.filter(t => t.type === 'expense' && t.date?.startsWith(currentMonthKey))
    const prevMonthKey = last6Months[last6Months.length - 2]?.key
    const prevMonthExpenses = transactions.filter(t => t.type === 'expense' && t.date?.startsWith(prevMonthKey))

    const currTotal = currMonthExpenses.reduce((s, t) => s + parseFloat(t.amount || 0), 0)
    const prevTotal = prevMonthExpenses.reduce((s, t) => s + parseFloat(t.amount || 0), 0)

    const biggestCat = pieData.reduce((max, d) => d.value > (max?.value || 0) ? d : max, null)

    const catChanges = customCategories.map(cat => {
      const curr = currMonthExpenses.filter(t => t.category === cat).reduce((s, t) => s + parseFloat(t.amount || 0), 0)
      const prev = prevMonthExpenses.filter(t => t.category === cat).reduce((s, t) => s + parseFloat(t.amount || 0), 0)
      return { cat, change: curr - prev }
    })
    const biggestIncrease = catChanges.filter(c => c.change > 0).sort((a, b) => b.change - a.change)[0]

    return { currTotal, prevTotal, biggestCat, biggestIncrease }
  }, [transactions, customCategories, currentMonthKey, last6Months, pieData])

  const activeCats = customCategories.filter(cat =>
    barData.some(row => row[cat] > 0)
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Summary Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <DollarSign size={18} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>This Month Spent</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            {formatCurrency(stats.currTotal)}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            {stats.currTotal <= stats.prevTotal
              ? <TrendingDown size={18} style={{ color: 'var(--success)' }} />
              : <TrendingUp size={18} style={{ color: 'var(--danger)' }} />}
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>vs Last Month</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: '700', color: stats.currTotal <= stats.prevTotal ? 'var(--success)' : 'var(--danger)' }}>
            {stats.prevTotal > 0
              ? `${stats.currTotal <= stats.prevTotal ? '↓' : '↑'} ${formatCurrency(Math.abs(stats.currTotal - stats.prevTotal))}`
              : '—'}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <Award size={18} style={{ color: 'var(--warning)' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Top Category</span>
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            {stats.biggestCat ? `${stats.biggestCat.name}` : '—'}
          </div>
          {stats.biggestCat && (
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{formatCurrency(stats.biggestCat.value)}</div>
          )}
        </div>

        {stats.biggestIncrease && (
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <TrendingUp size={18} style={{ color: 'var(--danger)' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Biggest Increase</span>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--danger)' }}>
              {stats.biggestIncrease.cat}
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              +{formatCurrency(stats.biggestIncrease.change)} vs last month
            </div>
          </div>
        )}
      </div>

      {/* Bar Chart */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '1rem' }}>📊 Monthly Spending by Category</h3>
        {barData.every(row => Object.keys(row).length <= 1) ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            No expense transactions yet. Add some transactions to see your trends!
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
              <YAxis tickFormatter={formatCurrency} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} width={70} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }} />
              {activeCats.map((cat, i) => (
                <Bar key={cat} dataKey={cat} stackId="a" fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} radius={i === activeCats.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Pie Chart */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '1rem' }}>🥧 {currentMonthLabel} Spending Breakdown</h3>
        {pieData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            No expenses this month yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width={260} height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={`cell-${i}`} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pieData.map((entry, i) => (
                <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: 12, height: 12, borderRadius: '3px', background: CATEGORY_COLORS[i % CATEGORY_COLORS.length], flexShrink: 0 }} />
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{entry.name}</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)', marginLeft: 'auto' }}>{formatCurrency(entry.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import React from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { getCurrentPeriod, isDateInPeriod } from '../utils/periods'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#a255ff', '#ff5592', '#55ffc4', '#55a2ff', '#ffc455']

export default function Analytics({ transactions }) {
  const period = getCurrentPeriod()
  const periodTransactions = transactions.filter(t => t.type === 'expense' && isDateInPeriod(t.date, period))

  const categoryTotals = periodTransactions.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount)
    return acc
  }, {})

  const data = Object.keys(categoryTotals).map(key => ({
    name: key,
    value: categoryTotals[key]
  })).sort((a, b) => b.value - a.value)

  if (data.length === 0) {
    return null
  }

  return (
    <div className="glass-panel" style={{ padding: '24px', marginTop: '24px' }}>
      <h3 style={{ margin: '0 0 24px' }}>Expenses by Category (Current Period)</h3>
      <div style={{ height: '300px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

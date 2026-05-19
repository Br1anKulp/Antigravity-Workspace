import { useState, useEffect } from 'react'
import { Wallet, Sun, Moon, LogOut } from 'lucide-react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './firebase'

import Dashboard from './components/Dashboard'
import TransactionList from './components/TransactionList'
import TransactionForm from './components/TransactionForm'
import Auth from './components/Auth'

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('finance-theme') || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  })
  
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState([])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('finance-theme', theme)
  }, [theme])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) {
      setTransactions([])
      return
    }

    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convert Firestore Timestamp to ISO string for rendering if it exists
        date: doc.data().date?.toDate ? doc.data().date.toDate().toISOString() : new Date().toISOString()
      }))
      setTransactions(txs)
    })

    return () => unsubscribe()
  }, [user])

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  const handleAddTransaction = async (newTx) => {
    if (!user) return
    try {
      await addDoc(collection(db, 'transactions'), {
        title: newTx.title,
        amount: newTx.amount,
        type: newTx.type,
        category: newTx.category,
        user: user.email,
        date: serverTimestamp() // Let Firestore handle the exact time
      })
    } catch (err) {
      console.error("Error adding document: ", err)
      alert("Failed to add transaction. Check console.")
    }
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>
  }

  if (!user) {
    return <Auth />
  }

  return (
    <div className="app-container">
      <header className="header glass-panel">
        <div className="brand">
          <Wallet size={28} />
          <span>Flow</span>
        </div>
        <div className="header-actions">
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginRight: '8px', display: 'none' }}>
            {user.email}
          </span>
          <button 
            className="btn btn-ghost btn-icon" 
            onClick={toggleTheme}
            title="Toggle Theme"
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          <button 
            className="btn btn-ghost btn-icon"
            onClick={() => signOut(auth)}
            title="Sign Out"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main>
        <Dashboard transactions={transactions} />
        <TransactionForm onAdd={handleAddTransaction} />
        <TransactionList transactions={transactions} />
      </main>
    </div>
  )
}

export default App

import { useState, useEffect, useMemo } from 'react'
import { Wallet, Sun, Moon, LogOut, ChevronLeft, ChevronRight, LayoutDashboard, BarChart2 } from 'lucide-react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, updateDoc, getDocs, setDoc, where, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

import Dashboard from './components/Dashboard'
import TransactionList from './components/TransactionList'
import TransactionForm from './components/TransactionForm'
import Auth from './components/Auth'
import BudgetProgress from './components/BudgetProgress'
import Insights from './components/Insights'
import { requestNotificationPermission, checkUpcomingBills } from './utils/notifications'

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('finance-theme') || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  })
  
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState([])
  const [budgets, setBudgets] = useState({})
  const [loadingBudgets, setLoadingBudgets] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('finance-theme', theme)
  }, [theme])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)
      if (currentUser) {
        requestNotificationPermission();
      }
    })
    return () => unsubscribe()
  }, [])

  const householdId = (user?.email === 'brian.k.kulp@gmail.com' || user?.email === 'familynflowers@protonmail.com') 
    ? 'kulp-family' 
    : user?.email;

  useEffect(() => {
    if (!user) {
      setTransactions([])
      setBudgets({})
      setLoadingBudgets(false)
      return
    }

    setLoadingBudgets(true)

    // Household Migration: Ensure all transactions have a householdId
    const migrateData = async () => {
      try {
        const allTxQuery = query(collection(db, 'transactions'));
        const snapshot = await getDocs(allTxQuery);
        snapshot.forEach(async (docSnap) => {
          if (!docSnap.data().householdId) {
            await updateDoc(doc(db, 'transactions', docSnap.id), { householdId: 'kulp-family' });
          }
        });
      } catch (err) {
        console.error("Migration error", err);
      }
    };
    migrateData();

    // Query transactions by householdId
    const q = query(collection(db, 'transactions'), where('householdId', '==', householdId))
    const unsubscribeTx = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate ? doc.data().date.toDate().toISOString() : doc.data().date || new Date().toISOString()
      }))
      txs.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(txs)
    })

    const unsubscribeBudgets = onSnapshot(doc(db, 'budgets', `${householdId}-${selectedMonth}`), (docSnap) => {
      if (docSnap.exists()) {
        setBudgets(docSnap.data())
      } else {
        setBudgets({})
      }
      setLoadingBudgets(false)
    })

    return () => {
      unsubscribeTx()
      unsubscribeBudgets()
    }
  }, [user, selectedMonth, householdId])

  // Fire bill due date notifications when budgets or transactions change
  useEffect(() => {
    if (user && Object.keys(budgets).length > 0) {
      checkUpcomingBills(budgets, transactions, selectedMonth);
    }
  }, [budgets, transactions, selectedMonth, user])

  // One-time budget path migration: copy from old bare selectedMonth path to new householdId-selectedMonth path
  useEffect(() => {
    if (!user || !householdId) return;
    const migrateBudgetPath = async () => {
      try {
        const newRef = doc(db, 'budgets', `${householdId}-${selectedMonth}`);
        const newSnap = await getDoc(newRef);
        if (!newSnap.exists()) {
          // Try to copy from old bare path
          const oldRef = doc(db, 'budgets', selectedMonth);
          const oldSnap = await getDoc(oldRef);
          if (oldSnap.exists()) {
            await setDoc(newRef, oldSnap.data());
            console.log('Budget migrated from old path to household path.');
          }
        }
      } catch (err) {
        console.error('Budget path migration error:', err);
      }
    };
    migrateBudgetPath();
  }, [user, householdId, selectedMonth]);

  // One-time cleanup: remove all hardcoded default categories from Firestore
  useEffect(() => {
    if (!user || !householdId) return;
    const flagKey = `gs_defaults_purged_${householdId}`;
    if (localStorage.getItem(flagKey)) return; // Already done

    const DEFAULT_CATEGORIES = [
      'Home Expenses', 'Transportation', 'Daily Living',
      'Entertainment', 'Health', 'Personal', 'Savings', 'Donations', 'Misc'
    ];

    const purgeDefaults = async () => {
      try {
        // Get all budget docs for this household
        const snapshot = await getDocs(collection(db, 'budgets'));
        const promises = [];
        snapshot.forEach(docSnap => {
          if (!docSnap.id.startsWith(householdId)) return;
          const data = docSnap.data();
          let modified = false;
          const newData = { ...data };

          // Remove hardcoded defaults AND any corrupted numeric keys
          Object.keys(newData).forEach(k => {
            if (DEFAULT_CATEGORIES.includes(k) || (!isNaN(k) && k !== '')) {
              delete newData[k];
              modified = true;
              console.log(`Purging default category "${k}" from ${docSnap.id}`);
            }
          });

          if (modified) {
            promises.push(setDoc(doc(db, 'budgets', docSnap.id), newData));
          }
        });

        await Promise.all(promises);
        localStorage.setItem(flagKey, 'true');
        console.log('Default category purge complete.');
      } catch (err) {
        console.error('Purge error:', err);
      }
    };

    purgeDefaults();
  }, [user, householdId]);



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
        subcategory: newTx.subcategory,
        user: user.email,
        householdId,
        date: newTx.date || new Date().toISOString(),
        status: newTx.status || 'paid',
        paymentMethod: newTx.paymentMethod || 'Checking Account',
        notes: newTx.notes || ''
      })
    } catch (err) {
      console.error("Error adding document: ", err)
      alert("Failed to add transaction. Check console.")
    }
  }

  const handleUpdateTransaction = async (id, updatedTx) => {
    if (!user) return
    try {
      const txRef = doc(db, 'transactions', id);
      await updateDoc(txRef, {
        title: updatedTx.title,
        amount: updatedTx.amount,
        type: updatedTx.type,
        category: updatedTx.category,
        subcategory: updatedTx.subcategory,
        date: updatedTx.date || new Date().toISOString(),
        status: updatedTx.status || 'paid',
        paymentMethod: updatedTx.paymentMethod || 'Checking Account'
      });
    } catch (err) {
      console.error("Error updating document: ", err)
      alert("Failed to update transaction.")
    }
  }

  const handleDeleteTransaction = async (id) => {
    if (!user || !window.confirm("Are you sure you want to delete this transaction?")) return;
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (err) {
      console.error("Error deleting document: ", err);
      alert("Failed to delete transaction.");
    }
  }

  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const d = new Date(year, month - 2, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const d = new Date(year, month, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => t.date && t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  const displayMonthName = new Date(selectedMonth + "-02").toLocaleString('default', { month: 'long', year: 'numeric' });

  const categoriesConfig = useMemo(() => {
    const config = {};
    
    // Pull categories and subcategories ONLY from your active budget document
    if (budgets && Object.keys(budgets).length > 0) {
      Object.keys(budgets).forEach(c => {
        if (c.startsWith('_')) return; // Ignore internal properties like _categoryOrder, _subcategoryOrder, _migrated_v2
        
        const dbSubcategories = Object.keys(budgets[c]?.subcategories || {});
        config[c] = dbSubcategories;
      });
    }

    return config;
  }, [budgets]);

  const customCategories = Object.keys(categoriesConfig);

  if (loading || (user && loadingBudgets)) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>
  }

  if (!user) {
    return <Auth />
  }

  return (
    <div className="app-container">
      <header className="header glass-panel">
        <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo.png" alt="Good Steward" style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'cover' }} />
          <span style={{ fontWeight: '700', fontSize: '1.25rem', letterSpacing: '0.5px' }}>Good Steward</span>
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
        <div className="glass-panel" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '12px', marginBottom: '24px', gap: '16px' }}>
          <button className="btn btn-ghost btn-icon" onClick={handlePrevMonth}>
            <ChevronLeft size={20} />
          </button>
          <h2 style={{ margin: 0, minWidth: '180px', textAlign: 'center', fontSize: '1.2rem', fontWeight: '600' }}>
            {displayMonthName}
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={handleNextMonth}>
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="glass-panel" style={{ display: 'flex', gap: '8px', padding: '8px', marginBottom: '24px' }}>
          <button
            className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={16} /> Dashboard
          </button>
          <button
            className={`btn ${activeTab === 'insights' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            onClick={() => setActiveTab('insights')}
          >
            <BarChart2 size={16} /> Insights
          </button>
        </div>

        {activeTab === 'insights' ? (
          <Insights
            transactions={transactions}
            budgets={budgets}
            customCategories={customCategories}
          />
        ) : (
          <>
            <Dashboard 
              transactions={filteredTransactions} 
              budgets={budgets} 
              onUpdateTransaction={handleUpdateTransaction} 
            />
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', alignItems: 'flex-start' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px', alignItems: 'flex-start' }}>
            
            {/* Left Column: Categories */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <BudgetProgress 
                budgets={budgets} 
                transactions={filteredTransactions} 
                user={user} 
                householdId={householdId}
                customCategories={customCategories} 
                selectedMonth={selectedMonth}
              />
            </div>

            {/* Right Column: Transactions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <TransactionForm onAdd={handleAddTransaction} onUpdate={handleUpdateTransaction} categoriesConfig={categoriesConfig} customCategories={customCategories} />
            <TransactionList 
              transactions={filteredTransactions} 
              onDelete={handleDeleteTransaction}
              onEditRequest={(tx) => document.dispatchEvent(new CustomEvent('edit-transaction', { detail: tx }))}
              onUpdateTransaction={handleUpdateTransaction}
              categories={customCategories}
              selectedMonth={selectedMonth}
            />
            </div>
          </div>
        </div>
        </>)}
      </main>
    </div>
  )
}

export default App

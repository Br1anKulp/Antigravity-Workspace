import { useState, useEffect, useMemo, useRef } from 'react'
import { Wallet, Sun, Moon, LogOut, ChevronLeft, ChevronRight, LayoutDashboard, BarChart2, ChevronDown, Calendar } from 'lucide-react'
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
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const initializingRef = useRef(null);

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

    const unsubscribeBudgets = onSnapshot(doc(db, 'budgets', `${householdId}-${selectedMonth}`), async (docSnap) => {
      if (docSnap.exists()) {
        setBudgets(docSnap.data())
        setLoadingBudgets(false)
      } else {
        if (initializingRef.current === selectedMonth) return;
        initializingRef.current = selectedMonth;

        // Automatically initialize categories from the most recent month
        try {
          const budgetsSnap = await getDocs(collection(db, 'budgets'));
          let mostRecentDoc = null;
          let mostRecentMonth = '';
          
          budgetsSnap.forEach(snap => {
            if (!snap.id.startsWith(householdId)) return;
            const parts = snap.id.split('-');
            const monthStr = parts.slice(parts.length - 2).join('-'); // YYYY-MM
            if (monthStr < selectedMonth && monthStr > mostRecentMonth) {
              mostRecentMonth = monthStr;
              mostRecentDoc = snap;
            }
          });

          if (mostRecentDoc) {
            const data = mostRecentDoc.data();
            await setDoc(doc(db, 'budgets', `${householdId}-${selectedMonth}`), data);
            console.log(`Automatically initialized current month budget from ${mostRecentMonth}`);
            // Do NOT call setBudgets or setLoadingBudgets here. Let the real-time onSnapshot listener
            // fire when setDoc completes, keeping state updates perfectly linear and safe.
          } else {
            setBudgets({});
            setLoadingBudgets(false);
          }
        } catch (err) {
          console.error("Auto budget initialization failed:", err);
          setBudgets({});
          setLoadingBudgets(false);
        }
      }
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



  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => t.date && t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  const displayMonthName = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const d = new Date(year, month - 1, 2);
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

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
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div 
            className="glass-panel" 
            style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              padding: '12px 24px', 
              cursor: 'pointer', 
              gap: '10px',
              userSelect: 'none',
              transition: 'all 0.2s ease',
              boxShadow: 'var(--shadow-sm)',
            }}
            onClick={() => {
              setShowMonthPicker(!showMonthPicker);
              const [y] = selectedMonth.split('-').map(Number);
              setPickerYear(y);
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
          >
            <Calendar size={18} style={{ color: 'var(--primary)' }} />
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {displayMonthName}
              <ChevronDown size={16} style={{ 
                transform: showMonthPicker ? 'rotate(180deg)' : 'rotate(0deg)', 
                transition: 'transform 0.2s ease',
                color: 'var(--text-secondary)'
              }} />
            </h2>
          </div>

          {showMonthPicker && (
            <>
              {/* Overlay backdrop to close picker when clicking outside */}
              <div 
                style={{ 
                  position: 'fixed', 
                  top: 0, 
                  left: 0, 
                  right: 0, 
                  bottom: 0, 
                  zIndex: 998 
                }} 
                onClick={() => setShowMonthPicker(false)}
              />
              
              {/* Dropdown Month Picker */}
              <div 
                className="glass-panel" 
                style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginTop: '8px', 
                  padding: '16px', 
                  zIndex: 999, 
                  width: '290px',
                  boxShadow: 'var(--shadow-md)',
                  border: 'var(--border) 1px solid',
                  animation: 'fadeIn 0.2s ease-out',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                {/* Year Selection Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                  <button 
                    className="btn btn-ghost btn-icon" 
                    style={{ minWidth: '36px', minHeight: '36px', padding: '6px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPickerYear(y => y - 1);
                    }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ fontWeight: '700', fontSize: '1.15rem', color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                    {pickerYear}
                  </span>
                  <button 
                    className="btn btn-ghost btn-icon" 
                    style={{ minWidth: '36px', minHeight: '36px', padding: '6px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPickerYear(y => y + 1);
                    }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                {/* 3x4 Month Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((monName, idx) => {
                    const monthValStr = String(idx + 1).padStart(2, '0');
                    const targetMonthStr = `${pickerYear}-${monthValStr}`;
                    const isSelected = selectedMonth === targetMonthStr;
                    
                    return (
                      <button
                        key={monName}
                        className={`btn ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ 
                          padding: '8px 4px', 
                          fontSize: '0.9rem', 
                          borderRadius: '8px',
                          fontWeight: isSelected ? '600' : '400',
                          border: isSelected ? 'none' : '1px solid var(--border)',
                          minHeight: '36px'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMonth(targetMonthStr);
                          setShowMonthPicker(false);
                        }}
                      >
                        {monName}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
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

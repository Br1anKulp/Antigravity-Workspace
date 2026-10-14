import { useState, useEffect, useMemo, useRef, Component } from 'react'
import { Sun, Moon, LogOut, ChevronLeft, ChevronRight, LayoutDashboard, BarChart2, ChevronDown, Calendar, Tv, Bell, Users, Plus, PlusCircle, PieChart } from 'lucide-react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, updateDoc, getDocs, setDoc, where, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import { processRecurringTransactions } from './utils/recurring'

import Dashboard from './components/Dashboard'
import TransactionList from './components/TransactionList'
import TransactionForm from './components/TransactionForm'
import Auth from './components/Auth'
import BudgetProgress from './components/BudgetProgress'
import Insights from './components/Insights'
import PaycheckTracker from './components/PaycheckTracker'
import CompanionDashboard from './components/CompanionDashboard'
import { requestNotificationPermission, checkUpcomingBills } from './utils/notifications'
import PlaidConnector from './components/PlaidConnector'
import BankActivityFeed from './components/BankActivityFeed'
import HouseholdSetup from './components/HouseholdSetup'
import HouseholdModal from './components/HouseholdModal'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-panel" style={{ padding: '32px', margin: '24px', textAlign: 'center', border: '1px solid var(--danger)', background: 'rgba(239, 68, 68, 0.05)' }}>
          <h3 style={{ color: 'var(--danger)', marginBottom: '12px', fontWeight: '600' }}>Something went wrong loading this section</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px', wordBreak: 'break-all', fontFamily: 'monospace' }}>
            {this.state.error?.toString() || 'Unknown rendering error'}
          </p>
          <button 
            className="btn btn-primary" 
            onClick={() => window.location.reload()}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('finance-theme') || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  })
  
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [householdId, setHouseholdId] = useState(null)
  const [householdData, setHouseholdData] = useState(null)
  const [loadingHousehold, setLoadingHousehold] = useState(true)
  const userEmailLower = user?.email?.toLowerCase() || ''
  const [transactions, setTransactions] = useState([])
  const [budgets, setBudgets] = useState({})
  const [loadingBudgets, setLoadingBudgets] = useState(true)
  const [activeTab, setActiveTab] = useState(() => {
    if (window.location.hash === '#companion') return 'companion';
    return 'dashboard';
  })
  const [mobileSubTab, setMobileSubTab] = useState('transactions')
  const [isMobile, setIsMobile] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth <= 768 : false;
  })
  const [isBankFeedOpen, setIsBankFeedOpen] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const saved = localStorage.getItem('selected-month');
    if (saved && typeof saved === 'string' && saved.includes('-') && saved.split('-').length === 2) {
      const [y, m] = saved.split('-');
      if (!isNaN(y) && !isNaN(m)) {
        console.log('Loaded selectedMonth from localStorage:', saved);
        return saved;
      }
    }
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    console.log('No valid saved month, using default:', defaultMonth);
    return defaultMonth;
  });

  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const initializingRef = useRef(null);

  const [showSmsModal, setShowSmsModal] = useState(false);
  const [showHouseholdModal, setShowHouseholdModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [carrier, setCarrier] = useState('verizon');
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [savingSms, setSavingSms] = useState(false);
  const [testingSms, setTestingSms] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchSmsSettings = async () => {
      if (!user) {
        if (isMounted) {
          setPhoneNumber('');
          setCarrier('verizon');
          setSmsEnabled(false);
        }
        return;
      }
      try {
        const docRef = doc(db, 'users', user.email.toLowerCase(), 'settings', 'notifications');
        const snap = await getDoc(docRef);
        if (isMounted) {
          if (snap.exists()) {
            setPhoneNumber(snap.data().phoneNumber || '');
            setCarrier(snap.data().carrier || 'verizon');
            setSmsEnabled(!!snap.data().smsEnabled);
          } else {
            setPhoneNumber('');
            setCarrier('verizon');
            setSmsEnabled(false);
          }
        }
      } catch (err) {
        console.error('Error loading SMS settings:', err);
      }
    };
    fetchSmsSettings();
    return () => { isMounted = false; };
  }, [user]);

  const handleSaveSmsSettings = async (e) => {
    e.preventDefault();
    if (!user) return;
    setSavingSms(true);
    try {
      const userDocRef = doc(db, 'users', userEmailLower);
      await setDoc(userDocRef, { email: userEmailLower, updatedAt: new Date().toISOString() }, { merge: true });

      const docRef = doc(db, 'users', userEmailLower, 'settings', 'notifications');
      await setDoc(docRef, {
        phoneNumber: phoneNumber.trim(),
        carrier,
        smsEnabled,
        householdId,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      alert('Notification settings saved successfully!');
      setShowSmsModal(false);
    } catch (err) {
      console.error(err);
      alert('Failed to save notification settings.');
    } finally {
      setSavingSms(false);
    }
  };

  const handleSendTestSms = async () => {
    if (!user) return;
    setTestingSms(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('https://senddailysmssummary-xsbyruakjq-uc.a.run.app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          userId: userEmailLower,
          householdId
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Test SMS Execution Complete!\nDelivered Via: ${data.deliveredVia}\n\nGenerated Payload:\n${data.text}`);
      } else {
        alert(`Failed to trigger test SMS: ${data.reason || data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error triggering test SMS endpoint.');
    } finally {
      setTestingSms(false);
    }
  };

  const [prevSelectedMonth, setPrevSelectedMonth] = useState(selectedMonth)
  const [prevUser, setPrevUser] = useState(user)

  if (selectedMonth !== prevSelectedMonth || user !== prevUser) {
    setPrevSelectedMonth(selectedMonth)
    setPrevUser(user)
    if (user) {
      setLoadingBudgets(true)
    }
  }

  // Persist selected month across sessions
  useEffect(() => {
    localStorage.setItem('selected-month', selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('finance-theme', theme)
  }, [theme])

  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#companion') {
        setActiveTab('companion');
      } else if (activeTab === 'companion') {
        setActiveTab('dashboard');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeTab]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)
      if (currentUser) {
        requestNotificationPermission();
      } else {
        setHouseholdId(null)
        setHouseholdData(null)
        setLoadingHousehold(false)
        setTransactions([])
        setBudgets({})
        setLoadingBudgets(false)
      }
    })
    return () => unsubscribe()
  }, [])

  // Dynamic household resolution from Firestore
  useEffect(() => {
    let isMounted = true;
    const resolveHousehold = async () => {
      if (!user) {
        if (isMounted) {
          setHouseholdId(null);
          setHouseholdData(null);
          setLoadingHousehold(false);
        }
        return;
      }

      setLoadingHousehold(true);
      const email = user.email.toLowerCase();

      try {
        const userDocRef = doc(db, 'users', email);
        const userSnap = await getDoc(userDocRef);

        let hId = userSnap.exists() ? userSnap.data()?.householdId : null;

        // Auto-provisioning & safeguard for Kulp family:
        // Guarantees zero downtime and zero disruption for your existing setup
        if (email === 'brian.k.kulp@gmail.com' || email === 'familynflowers@protonmail.com') {
          hId = 'kulp-family';
          const hhRef = doc(db, 'households', 'kulp-family');
          const hhSnap = await getDoc(hhRef);
          if (!hhSnap.exists()) {
            await setDoc(hhRef, {
              name: 'Kulp Family',
              members: ['brian.k.kulp@gmail.com', 'familynflowers@protonmail.com'],
              adminEmail: 'brian.k.kulp@gmail.com',
              primaryPlaidUser: 'brian.k.kulp@gmail.com',
              createdAt: new Date().toISOString()
            }, { merge: true });
          }
          if (!userSnap.exists() || userSnap.data()?.householdId !== 'kulp-family') {
            await setDoc(userDocRef, {
              email,
              householdId: 'kulp-family',
              updatedAt: new Date().toISOString()
            }, { merge: true });
          }
        }

        if (hId) {
          const hhDoc = await getDoc(doc(db, 'households', hId));
          if (isMounted) {
            setHouseholdId(hId);
            setHouseholdData(hhDoc.exists() ? hhDoc.data() : { name: hId });
            setLoadingHousehold(false);
          }
        } else {
          // New user who needs to create or join a household (e.g. the Hollands)
          if (isMounted) {
            setHouseholdId(null);
            setHouseholdData(null);
            setLoadingHousehold(false);
          }
        }
      } catch (err) {
        console.error('Error resolving household:', err);
        if (email === 'brian.k.kulp@gmail.com' || email === 'familynflowers@protonmail.com') {
          if (isMounted) {
            setHouseholdId('kulp-family');
            setHouseholdData({ name: 'Kulp Family' });
          }
        }
        if (isMounted) setLoadingHousehold(false);
      }
    };

    resolveHousehold();
    return () => { isMounted = false; };
  }, [user]);

  // Process recurring transactions once user and householdId are both resolved
  useEffect(() => {
    if (user && householdId) {
      processRecurringTransactions(user.email.toLowerCase(), householdId).catch(err => {
        console.error("Error processing recurring transactions:", err);
      });
    }
  }, [user, householdId]);

  useEffect(() => {
    if (!user || !householdId) return

    // Household Migration: Ensure all transactions have a householdId
    const migrateData = async () => {
      try {
        const userTxQuery = query(collection(db, 'transactions'), where('user', '==', userEmailLower));
        const snapshot = await getDocs(userTxQuery);
        const updates = [];
        snapshot.forEach(docSnap => {
          if (!docSnap.data().householdId) {
            updates.push(updateDoc(doc(db, 'transactions', docSnap.id), { householdId }));
          }
        });
        if (updates.length) await Promise.all(updates);
      } catch (err) {
        console.error("Migration error", err);
      }
    };
    migrateData();

    // Query transactions by householdId
    const q = query(collection(db, 'transactions'), where('householdId', '==', householdId))
    const unsubscribeTx = onSnapshot(q, 
      (snapshot) => {
        const txs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate ? doc.data().date.toDate().toISOString() : doc.data().date || new Date().toISOString()
        }))
        txs.sort((a, b) => new Date(b.date) - new Date(a.date));
        setTransactions(txs)
      },
      (err) => {
        console.error("Transactions listener failed:", err);
      }
    )

    const unsubscribeBudgets = onSnapshot(doc(db, 'budgets', `${householdId}-${selectedMonth}`), 
      async (docSnap) => {
        if (docSnap.exists()) {
          setBudgets(docSnap.data())
          setLoadingBudgets(false)
        } else {
          if (initializingRef.current === selectedMonth) return;
          initializingRef.current = selectedMonth;

          // Automatically initialize categories from the previous month directly using safe, single-doc getDoc
          try {
            const [year, month] = selectedMonth.split('-').map(Number);
            const prevMonthStr = month === 1 
              ? `${year - 1}-12` 
              : `${year}-${String(month - 1).padStart(2, '0')}`;
            
            const prevDocSnap = await getDoc(doc(db, 'budgets', `${householdId}-${prevMonthStr}`));
            
            if (prevDocSnap.exists()) {
              const data = prevDocSnap.data();
              await setDoc(doc(db, 'budgets', `${householdId}-${selectedMonth}`), data);
              console.log(`Automatically initialized current month budget from previous month ${prevMonthStr}`);
            } else {
              // Search two months back if previous month doesn't exist
              const prevMonth2Str = month <= 2
                ? `${year - 1}-${String(month + 10).padStart(2, '0')}`
                : `${year}-${String(month - 2).padStart(2, '0')}`;
                
              const prev2DocSnap = await getDoc(doc(db, 'budgets', `${householdId}-${prevMonth2Str}`));
              if (prev2DocSnap.exists()) {
                const data = prev2DocSnap.data();
                await setDoc(doc(db, 'budgets', `${householdId}-${selectedMonth}`), data);
                console.log(`Automatically initialized current month budget from two months back ${prevMonth2Str}`);
              } else {
                setBudgets({});
                setLoadingBudgets(false);
              }
            }
          } catch (err) {
            console.error("Auto budget initialization failed:", err);
            setBudgets({});
            setLoadingBudgets(false);
          }
        }
      },
      (err) => {
        console.error("Budgets listener failed:", err);
        setBudgets({});
        setLoadingBudgets(false);
      }
    )

    return () => {
      unsubscribeTx()
      unsubscribeBudgets()
    }
  }, [user, selectedMonth, householdId, userEmailLower])

  // Fire bill due date notifications when budgets or transactions change
  useEffect(() => {
    if (user && Object.keys(budgets).length > 0) {
      checkUpcomingBills(budgets, transactions, selectedMonth);
    }
  }, [budgets, transactions, selectedMonth, user])

  // One-time budget path migration: copy from old bare selectedMonth path to new householdId-selectedMonth path (Kulp family legacy only)
  useEffect(() => {
    if (!user || householdId !== 'kulp-family') return;
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
  }, [user, householdId, selectedMonth, userEmailLower]);





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
        user: userEmailLower,
        householdId,
        date: newTx.date || new Date().toISOString(),
        status: newTx.status || 'paid',
        paymentMethod: newTx.paymentMethod || 'Navy Federal Checking',
        notes: newTx.notes || '',
        splits: newTx.splits || null,
        plaidTransactionId: newTx.plaidTransactionId || null,
        isRecurring: newTx.isRecurring || false
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
      const updateData = {};
      
      if (updatedTx.title !== undefined) updateData.title = updatedTx.title;
      if (updatedTx.amount !== undefined) updateData.amount = updatedTx.amount;
      if (updatedTx.type !== undefined) updateData.type = updatedTx.type;
      if (updatedTx.category !== undefined) updateData.category = updatedTx.category;
      if (updatedTx.subcategory !== undefined) updateData.subcategory = updatedTx.subcategory;
      if (updatedTx.date !== undefined) updateData.date = updatedTx.date;
      if (updatedTx.status !== undefined) updateData.status = updatedTx.status;
      if (updatedTx.paymentMethod !== undefined) updateData.paymentMethod = updatedTx.paymentMethod;
      if (updatedTx.notes !== undefined) updateData.notes = updatedTx.notes;
      if (updatedTx.splits !== undefined) updateData.splits = updatedTx.splits;
      if (updatedTx.plaidTransactionId !== undefined) updateData.plaidTransactionId = updatedTx.plaidTransactionId;
      if (updatedTx.isRecurring !== undefined) updateData.isRecurring = updatedTx.isRecurring;
      
      await updateDoc(txRef, updateData);
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

  if (loading || (user && loadingHousehold)) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-secondary)' }}>Loading...</div>
  }

  if (!user) {
    return <Auth />
  }

  if (!householdId) {
    return (
      <HouseholdSetup 
        user={user} 
        onComplete={(newHouseholdId) => {
          setHouseholdId(newHouseholdId);
          setLoadingBudgets(true);
        }} 
      />
    )
  }

  if (loadingBudgets) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-secondary)' }}>Loading budgets...</div>
  }

  if (activeTab === 'companion') {
    return (
      <CompanionDashboard 
        transactions={filteredTransactions} 
        budgets={budgets} 
        customCategories={customCategories} 
        onExit={() => {
          window.location.hash = '';
          setActiveTab('dashboard');
        }} 
      />
    )
  }

  return (
    <div className="app-container">
      <header className="header glass-panel">
        <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo.png" alt="Good Steward" style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'cover' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: '700', fontSize: '1.25rem', letterSpacing: '0.5px', lineHeight: '1.2' }}>Good Steward</span>
            {householdData?.name && (
              <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: '600', letterSpacing: '0.3px' }}>
                {householdData.name}
              </span>
            )}
          </div>
        </div>
        <div className="header-actions">
          <PlaidConnector 
            user={user} 
            householdId={householdId} 
            onOpenBankFeed={() => setIsBankFeedOpen(true)} 
          />
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginRight: '8px', display: 'none' }}>
            {user.email}
          </span>
          <button 
            className="btn btn-ghost btn-icon" 
            onClick={() => setShowSmsModal(true)}
            title="Daily SMS Notification Settings"
            style={{ position: 'relative' }}
          >
            <Bell size={20} />
            {smsEnabled && (
              <span style={{
                position: 'absolute',
                top: '6px',
                right: '6px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--success)'
              }} />
            )}
          </button>
          <button 
            className="btn btn-ghost btn-icon" 
            onClick={() => setShowHouseholdModal(true)}
            title="Household Settings & Members"
          >
            <Users size={20} />
          </button>
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
        {/* ── On Mobile: Add Transaction is placed at the very top so it's the first thing you see ── */}
        {isMobile && (
          <div className="mobile-top-tx-container">
            <TransactionForm 
              onAdd={handleAddTransaction} 
              onUpdate={handleUpdateTransaction} 
              categoriesConfig={categoriesConfig} 
              customCategories={customCategories} 
              selectedMonth={selectedMonth} 
            />
          </div>
        )}

        {/* ── Top Row: Paycheck Tracker (left) + Month Picker (far right) ── */}
        <div className="paycheck-top-row">

          {/* Paycheck Tracker – fills available space */}
          <PaycheckTracker
            budgets={budgets}
            user={user}
            householdId={householdId}
            selectedMonth={selectedMonth}
            customCategories={customCategories}
          />

          {/* Month / Year Picker – anchored to the far right */}
          <div className="paycheck-month-picker">
            <div
              className="glass-panel"
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '12px 20px',
                cursor: 'pointer',
                gap: '10px',
                userSelect: 'none',
                transition: 'all 0.2s ease',
                boxShadow: 'var(--shadow-sm)',
                height: '100%',
                minHeight: '56px',
              }}
              onClick={() => {
                setShowMonthPicker(!showMonthPicker);
                const [y] = selectedMonth.split('-').map(Number);
                setPickerYear(y);
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
            >
              <Calendar size={17} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <span style={{ margin: 0, fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-heading)', whiteSpace: 'nowrap' }}>
                {displayMonthName}
                <ChevronDown size={15} style={{
                  transform: showMonthPicker ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                  color: 'var(--text-secondary)'
                }} />
              </span>
            </div>

            {showMonthPicker && (
              <>
                {/* Overlay backdrop to close picker when clicking outside */}
                <div
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }}
                  onClick={() => setShowMonthPicker(false)}
                />

                {/* Dropdown Month Picker */}
                <div
                  className="glass-panel month-picker-dropdown"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
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
                      onClick={(e) => { e.stopPropagation(); setPickerYear(y => y - 1); }}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span style={{ fontWeight: '700', fontSize: '1.15rem', color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                      {pickerYear}
                    </span>
                    <button
                      className="btn btn-ghost btn-icon"
                      style={{ minWidth: '36px', minHeight: '36px', padding: '6px' }}
                      onClick={(e) => { e.stopPropagation(); setPickerYear(y => y + 1); }}
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
        </div>

        {/* Tab Navigation */}
        <div className="glass-panel tab-nav" style={{ display: 'flex', gap: '8px', padding: '8px', marginBottom: '24px' }}>
          <button
            className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={16} /> <span className="tab-label-long">Dashboard</span><span className="tab-label-short">Home</span>
          </button>
          <button
            className={`btn ${activeTab === 'insights' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            onClick={() => setActiveTab('insights')}
          >
            <BarChart2 size={16} /> Insights
          </button>
          <button
            className={`btn ${activeTab === 'companion' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            onClick={() => {
              window.location.hash = '#companion';
              setActiveTab('companion');
            }}
            title="Open fullscreen pacing dashboard"
          >
            <Tv size={16} /> <span className="tab-label-long">Companion Mode</span><span className="tab-label-short">Pacing</span>
          </button>
        </div>

        <ErrorBoundary>
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
        
            {/* Mobile Sub-View Switcher: lets mobile users focus immediately on adding/tracking transactions */}
            <div className="mobile-view-toggle glass-panel">
              <button 
                type="button"
                className={`btn ${mobileSubTab === 'transactions' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => {
                  setMobileSubTab('transactions');
                  setTimeout(() => {
                    document.dispatchEvent(new CustomEvent('open-transaction-form'));
                  }, 50);
                }}
              >
                <PlusCircle size={16} /> Log & Activity
              </button>
              <button 
                type="button"
                className={`btn ${mobileSubTab === 'budgets' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setMobileSubTab('budgets')}
              >
                <PieChart size={16} /> Budgets & Pacing
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', alignItems: 'flex-start' }}>
              <div className={`main-grid mobile-subtab-${mobileSubTab}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))', gap: '24px', alignItems: 'flex-start' }}>
                
                {/* Left Column: Categories */}
                <div className="budgets-column" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
                <div className="transactions-column" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {!isMobile && (
                    <TransactionForm 
                      onAdd={handleAddTransaction} 
                      onUpdate={handleUpdateTransaction} 
                      categoriesConfig={categoriesConfig} 
                      customCategories={customCategories} 
                      selectedMonth={selectedMonth} 
                    />
                  )}
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
        </ErrorBoundary>
      </main>

      <BankActivityFeed 
        user={user} 
        householdId={householdId} 
        isOpen={isBankFeedOpen} 
        onClose={() => setIsBankFeedOpen(false)} 
      />

      {/* ── SMS Notification Settings Modal ── */}
      {showSmsModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div className="glass-panel sms-modal-content" style={{
            width: '100%',
            maxWidth: '460px',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={20} style={{ color: 'var(--primary)' }} />
                SMS Daily Balance Summary
              </h3>
              <button 
                className="btn btn-ghost btn-icon" 
                onClick={() => setShowSmsModal(false)}
                style={{ padding: '4px' }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0, lineHeight: '1.4' }}>
              Receive an automated text message every morning listing the remaining balances of categories and subcategories scheduled for your <strong>current pay period</strong> (Days 1–14 or Days 15–31).
            </p>

            <form onSubmit={handleSaveSmsSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Mobile Phone Number
                </label>
                <input 
                  type="tel" 
                  placeholder="+1 (555) 019-2834"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Mobile Carrier (for Free Text Gateway)
                </label>
                <select 
                  value={carrier}
                  onChange={e => setCarrier(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem'
                  }}
                >
                  <option value="verizon">Verizon (@vtext.com)</option>
                  <option value="att">AT&T (@txt.att.net)</option>
                  <option value="tmobile">T-Mobile (@tmomail.net)</option>
                  <option value="sprint">Sprint (@messaging.sprintpcs.com)</option>
                  <option value="cricket">Cricket Wireless (@mms.cricketwireless.net)</option>
                  <option value="googlefi">Google Fi (@msg.fi.google.com)</option>
                  <option value="mint">Mint Mobile (@mailmymobile.net)</option>
                  <option value="boost">Boost Mobile (@myboostmobile.com)</option>
                  <option value="uscellular">U.S. Cellular (@email.uscc.net)</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input 
                  type="checkbox"
                  id="smsEnabledToggle"
                  checked={smsEnabled}
                  onChange={e => setSmsEnabled(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="smsEnabledToggle" style={{ fontSize: '0.9rem', cursor: 'pointer', fontWeight: '500' }}>
                  Enable Daily Pay Period SMS Text Summary
                </label>
              </div>

              <div className="sms-modal-actions" style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button 
                  type="button" 
                  className="btn btn-ghost" 
                  onClick={handleSendTestSms}
                  disabled={testingSms}
                  style={{ flex: 1, fontSize: '0.85rem' }}
                >
                  {testingSms ? 'Generating Test...' : 'Send Test Summary'}
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={savingSms}
                  style={{ flex: 1, fontSize: '0.85rem' }}
                >
                  {savingSms ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Household Management Modal ── */}
      {showHouseholdModal && (
        <HouseholdModal
          user={user}
          householdId={householdId}
          householdData={householdData}
          onClose={() => setShowHouseholdModal(false)}
          onHouseholdUpdated={(updated) => setHouseholdData(updated)}
        />
      )}

      {/* ── Sticky Mobile Floating Action Button (FAB) ── */}
      {activeTab !== 'companion' && (
        <button
          type="button"
          className="mobile-fab"
          onClick={() => {
            if (activeTab !== 'dashboard') {
              setActiveTab('dashboard');
            }
            setMobileSubTab('transactions');
            setTimeout(() => {
              document.dispatchEvent(new CustomEvent('open-transaction-form'));
            }, 50);
          }}
          title="Log Transaction"
          aria-label="Add Transaction"
        >
          <Plus size={20} strokeWidth={2.5} />
          <span className="mobile-fab-label">Log</span>
        </button>
      )}
    </div>
  )
}

export default App

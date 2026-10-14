import { useState } from 'react'
import { Home, Users, ArrowRight, Loader2, Shield } from 'lucide-react'
import { doc, setDoc, getDoc, updateDoc, arrayUnion, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

function generateJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // No ambiguous chars (0/O, 1/I/L)
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

function generateHouseholdId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 30) + '-family'
}

export default function HouseholdSetup({ user, onComplete }) {
  const [mode, setMode] = useState(null) // null | 'create' | 'join'
  const [householdName, setHouseholdName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [createdCode, setCreatedCode] = useState(null) // After creation, show the join code

  const userEmail = user.email.toLowerCase()

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!householdName.trim()) return
    setLoading(true)
    setError(null)

    try {
      const householdId = generateHouseholdId(householdName)
      
      // Check if household ID already exists
      const existingDoc = await getDoc(doc(db, 'households', householdId))
      if (existingDoc.exists()) {
        setError(`A household named "${householdName}" already exists. Try a different name.`)
        setLoading(false)
        return
      }

      // Generate join code with 5-minute expiry
      const code = generateJoinCode()
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

      // Create the household document
      await setDoc(doc(db, 'households', householdId), {
        name: householdName.trim(),
        members: [userEmail],
        adminEmail: userEmail,
        primaryPlaidUser: userEmail,
        joinCode: code,
        joinCodeExpiresAt: expiresAt,
        createdAt: serverTimestamp()
      })

      // Set household on user profile
      await setDoc(doc(db, 'users', userEmail), {
        householdId,
        email: userEmail,
        updatedAt: new Date().toISOString()
      }, { merge: true })

      setCreatedCode(code)
    } catch (err) {
      console.error('Error creating household:', err)
      setError('Failed to create household. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async (e) => {
    e.preventDefault()
    if (!joinCode.trim()) return
    setLoading(true)
    setError(null)

    try {
      const codeUpper = joinCode.trim().toUpperCase()

      // Search all households for matching join code
      const householdsSnap = await getDocs(
        query(collection(db, 'households'), where('joinCode', '==', codeUpper))
      )

      if (householdsSnap.empty) {
        setError('Invalid join code. Please check and try again.')
        setLoading(false)
        return
      }

      const householdDoc = householdsSnap.docs[0]
      const householdData = householdDoc.data()
      const householdId = householdDoc.id

      // Check expiry
      if (householdData.joinCodeExpiresAt) {
        const expiresAt = new Date(householdData.joinCodeExpiresAt)
        if (new Date() > expiresAt) {
          setError('This join code has expired. Ask the household admin to generate a new one.')
          setLoading(false)
          return
        }
      }

      // Check if already a member
      if (householdData.members?.includes(userEmail)) {
        // Already a member, just set the profile
        await setDoc(doc(db, 'users', userEmail), {
          householdId,
          email: userEmail,
          updatedAt: new Date().toISOString()
        }, { merge: true })
        onComplete(householdId)
        return
      }

      // Add user to household members
      await updateDoc(doc(db, 'households', householdId), {
        members: arrayUnion(userEmail)
      })

      // Set household on user profile
      await setDoc(doc(db, 'users', userEmail), {
        householdId,
        email: userEmail,
        updatedAt: new Date().toISOString()
      }, { merge: true })

      // Invalidate the join code after use (one-time use)
      await updateDoc(doc(db, 'households', householdId), {
        joinCode: null,
        joinCodeExpiresAt: null
      })

      onComplete(householdId)
    } catch (err) {
      console.error('Error joining household:', err)
      setError('Failed to join household. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // After successful creation, show the join code
  if (createdCode) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg-base)',
        padding: '24px'
      }}>
        <div className="glass-panel" style={{
          maxWidth: '480px',
          width: '100%',
          padding: '40px 32px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          <div style={{ fontSize: '3rem' }}>🎉</div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>Household Created!</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem', lineHeight: '1.5' }}>
            Share this join code with your household members. They can use it to join your household when they sign up.
          </p>

          <div style={{
            background: 'var(--primary-bg)',
            border: '2px dashed var(--primary)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Join Code</span>
            <span style={{
              fontSize: '2.5rem',
              fontWeight: '800',
              letterSpacing: '6px',
              color: 'var(--primary)',
              fontFamily: 'var(--font-heading)'
            }}>
              {createdCode}
            </span>
            <span style={{
              fontSize: '0.8rem',
              color: 'var(--danger)',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}>
              ⏱ Expires in 5 minutes
            </span>
          </div>

          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem' }}>
            You can generate a new code anytime from the household settings.
          </p>

          <button
            className="btn btn-primary"
            onClick={() => onComplete(generateHouseholdId(householdName))}
            style={{ padding: '14px', fontSize: '1rem', fontWeight: '600' }}
          >
            Continue to Dashboard <ArrowRight size={18} style={{ marginLeft: '8px' }} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg-base)',
      padding: '24px'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '480px',
        width: '100%',
        padding: '40px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <img src="/logo.png" alt="Good Steward" style={{ width: '48px', height: '48px', borderRadius: '12px', marginBottom: '16px' }} />
          <h2 style={{ margin: '0 0 8px', fontSize: '1.5rem', fontWeight: '700' }}>Welcome to Good Steward!</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
            Set up your household to start tracking your family budget.
          </p>
        </div>

        {!mode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              className="glass-panel"
              onClick={() => setMode('create')}
              style={{
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                cursor: 'pointer',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                background: 'var(--bg-surface)',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ background: 'var(--primary-bg)', color: 'var(--primary)', padding: '12px', borderRadius: '50%' }}>
                <Home size={24} />
              </div>
              <div>
                <div style={{ fontWeight: '600', fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Create New Household
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Set up your family budget from scratch
                </div>
              </div>
            </button>

            <button
              className="glass-panel"
              onClick={() => setMode('join')}
              style={{
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                cursor: 'pointer',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                background: 'var(--bg-surface)',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: '12px', borderRadius: '50%' }}>
                <Users size={24} />
              </div>
              <div>
                <div style={{ fontWeight: '600', fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Join Existing Household
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Someone shared a join code with you
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Create Household Form */}
        {mode === 'create' && (
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                Household Name
              </label>
              <input
                type="text"
                placeholder='e.g., "Holland" or "Smith Family"'
                value={householdName}
                onChange={e => setHouseholdName(e.target.value)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '1rem'
                }}
                required
                autoFocus
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                This will be your household's display name.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => { setMode(null); setError(null); }}
                style={{ flex: 1 }}
              >
                Back
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !householdName.trim()}
                style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {loading ? <><Loader2 size={16} className="spin-animation" /> Creating...</> : <>Create Household <ArrowRight size={16} /></>}
              </button>
            </div>
          </form>
        )}

        {/* Join Household Form */}
        {mode === 'join' && (
          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                Join Code
              </label>
              <input
                type="text"
                placeholder="e.g., X7K9M2"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '1.5rem',
                  textAlign: 'center',
                  letterSpacing: '6px',
                  fontWeight: '700',
                  fontFamily: 'var(--font-heading)'
                }}
                required
                autoFocus
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Get this code from your household admin.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => { setMode(null); setError(null); }}
                style={{ flex: 1 }}
              >
                Back
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || joinCode.trim().length < 6}
                style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {loading ? <><Loader2 size={16} className="spin-animation" /> Joining...</> : <>Join Household <ArrowRight size={16} /></>}
              </button>
            </div>
          </form>
        )}

        {error && (
          <div style={{
            padding: '12px',
            borderRadius: '8px',
            background: 'var(--danger-bg)',
            color: 'var(--danger)',
            fontSize: '0.88rem',
            textAlign: 'center',
            fontWeight: '500'
          }}>
            {error}
          </div>
        )}

        <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <Shield size={12} /> Signed in as {userEmail}
        </div>
      </div>
    </div>
  )
}
